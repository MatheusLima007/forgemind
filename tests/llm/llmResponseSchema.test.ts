import { describe, expect, it } from "vitest";
import { validateLLMOutputSchema } from "../../src/core/validation/llmResponseSchema.js";

describe("validateLLMOutputSchema", () => {
  it("accepts valid structured LLM output", () => {
    const payload = {
      enrichedContent: {
        "docs/agent-first.md": "extra text"
      },
      metadata: {
        provider: "openai-compatible",
        model: "local-model",
        baseUrl: "http://localhost:11434/v1",
        tokensUsed: 42
      }
    };

    expect(validateLLMOutputSchema(payload)).toBe(true);
  });

  it("rejects malformed metadata", () => {
    const payload = {
      enrichedContent: {
        "docs/agent-first.md": "extra text"
      },
      metadata: {
        provider: "openai",
        model: ""
      }
    };

    expect(validateLLMOutputSchema(payload)).toBe(false);
  });
});
