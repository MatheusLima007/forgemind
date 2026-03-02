import { describe, expect, it } from "vitest";
import { RedundancyFilter } from "../../src/core/generators/documents/redundancyFilter.js";
import type { LLMRequest } from "../../src/core/types/index.js";
import type { LLMProvider } from "../../src/llm/provider.interface.js";

class MockProvider implements LLMProvider {
  public lastRequest: LLMRequest | null = null;

  async chat(request: LLMRequest) {
    this.lastRequest = request;
    return {
      content: "```markdown\n## Kept\n- Important [CLAIM:hyp-1]\n```",
      metadata: {
        provider: "gemini",
        model: "mock"
      }
    };
  }
}

describe("RedundancyFilter", () => {
  it("enforces claim-preservation and unsupported-assertion filtering rules in prompt", async () => {
    const provider = new MockProvider();
    const filter = new RedundancyFilter(provider);

    const result = await filter.filter("## Raw\nProject has src folder", "system-ontology", ["domain-invariants"]);

    expect(result).toContain("[CLAIM:hyp-1]");
    const systemPrompt = provider.lastRequest?.messages[0].content ?? "";
    expect(systemPrompt).toContain("Never remove lines that include [CLAIM:<id>] tags");
    expect(systemPrompt).toContain("Unsupported assertions");
  });
});
