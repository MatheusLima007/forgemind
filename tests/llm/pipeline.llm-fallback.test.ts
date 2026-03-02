import { afterEach, describe, expect, it } from "vitest";
import { LLMOrchestrator } from "../../src/llm/llm.orchestrator.js";

const originalOpenAIKey = process.env.OPENAI_API_KEY;

afterEach(() => {
  if (originalOpenAIKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalOpenAIKey;
  }
});

describe("LLMOrchestrator fallback behavior", () => {
  it("resolves with skip reason when provider credentials are missing", () => {
    delete process.env.OPENAI_API_KEY;

    const orchestrator = new LLMOrchestrator({
      config: {
        provider: "openai",
        model: "gpt-5-mini",
        temperature: 0.2,
        maxTokensBudget: 5000
      }
    });

    const resolution = orchestrator.resolve();
    expect(resolution.provider).toBeNull();
    expect(resolution.skipReason).toBe("missing-api-key");
  });

  it("throws a clear error when provider is required but unavailable", () => {
    delete process.env.OPENAI_API_KEY;

    const orchestrator = new LLMOrchestrator({
      config: {
        provider: "openai",
        model: "gpt-5-mini",
        temperature: 0.2,
        maxTokensBudget: 5000
      }
    });

    expect(() => orchestrator.getProvider()).toThrow("LLM provider is required but unavailable");
  });

  it("creates provider when explicit apiKey is configured", () => {
    const orchestrator = new LLMOrchestrator({
      config: {
        provider: "openai",
        model: "gpt-5-mini",
        temperature: 0.2,
        apiKey: "configured-key",
        maxTokensBudget: 5000
      }
    });

    const resolution = orchestrator.resolve();
    expect(resolution.provider).not.toBeNull();
    expect(resolution.skipReason).toBeUndefined();
  });
});
