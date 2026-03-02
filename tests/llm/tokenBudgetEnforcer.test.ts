import { describe, expect, it } from "vitest";
import { TokenBudgetEnforcer } from "../../src/core/runtime/tokenBudgetEnforcer.js";
import { TokenBudgetExceededError } from "../../src/core/errors/pipelineErrors.js";
import type { LLMProvider } from "../../src/llm/provider.interface.js";

describe("TokenBudgetEnforcer", () => {
  it("stops execution when budget is exhausted", async () => {
    const enforcer = new TokenBudgetEnforcer(5);
    enforcer.setStage("hypotheses");

    const provider: LLMProvider = {
      async chat() {
        return {
          content: "{}",
          metadata: { provider: "gemini", model: "mock", tokensUsed: 4 }
        };
      }
    };

    const wrapped = enforcer.wrapProvider(provider);

    await expect(
      wrapped.chat({
        messages: [{ role: "user", content: "this prompt is large enough to exceed budget" }],
        jsonMode: true
      })
    ).rejects.toBeInstanceOf(TokenBudgetExceededError);
  });

  it("tracks usage per stage with estimated and actual totals", async () => {
    const enforcer = new TokenBudgetEnforcer(200);
    const provider: LLMProvider = {
      async chat() {
        return {
          content: "{\"ok\":true}",
          metadata: { provider: "gemini", model: "mock", tokensUsed: 10 }
        };
      }
    };

    const wrapped = enforcer.wrapProvider(provider);

    enforcer.setStage("hypotheses");
    await wrapped.chat({ messages: [{ role: "user", content: "abc" }] });

    enforcer.setStage("consolidation");
    await wrapped.chat({ messages: [{ role: "user", content: "defghi" }] });

    const report = enforcer.getReport();
    expect(report.actualTotal).toBe(20);
    expect(report.used).toBeGreaterThan(0);
    expect(report.byStage.hypotheses.calls).toBe(1);
    expect(report.byStage.consolidation.calls).toBe(1);
  });
});
