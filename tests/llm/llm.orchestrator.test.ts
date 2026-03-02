import { afterEach, describe, expect, it, vi } from "vitest";
import { LLMOrchestrator } from "../../src/llm/llm.orchestrator.js";

const originalFetch = globalThis.fetch;
const originalOpenAiKey = process.env.OPENAI_API_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalOpenAiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  }
  vi.restoreAllMocks();
});

describe("LLMOrchestrator", () => {
  it("throws when provider is unavailable", () => {
    delete process.env.OPENAI_API_KEY;

    const orchestrator = new LLMOrchestrator({
      config: {
        provider: "openai",
        model: "gpt-5-mini",
        temperature: 0.2,
        maxTokensBudget: 1000
      }
    });

    expect(() => orchestrator.getProvider()).toThrow("LLM provider is required but unavailable");
  });

  it("tracks token usage by stage across provider calls", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"ok":true}' } }],
        usage: { total_tokens: 12 }
      })
    } as Response);

    const orchestrator = new LLMOrchestrator({
      config: {
        provider: "openai",
        model: "gpt-5-mini",
        temperature: 0.2,
        maxTokensBudget: 1000
      }
    });

    const provider = orchestrator.getProvider();

    orchestrator.setStage("hypotheses");
    await provider.chat({
      messages: [{ role: "user", content: "Generate hypotheses" }],
      jsonMode: true
    });

    orchestrator.setStage("consolidation");
    await provider.chat({
      messages: [{ role: "user", content: "Consolidate knowledge" }],
      jsonMode: true
    });

    const report = orchestrator.getTokenUsageReport();
    expect(report.actualTotal).toBe(24);
    expect(report.byStage.hypotheses.calls).toBe(1);
    expect(report.byStage.consolidation.calls).toBe(1);
    expect(orchestrator.getProviderName()).toBe("openai");
    expect(orchestrator.getModelName()).toBe("gpt-5-mini");
  });
});
