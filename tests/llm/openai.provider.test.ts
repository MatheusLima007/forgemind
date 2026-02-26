import { afterEach, describe, expect, it, vi } from "vitest";
import type { LLMInput } from "../../src/core/types/index.js";
import { OpenAIProvider } from "../../src/llm/openai.provider.js";
import { LLMProviderError } from "../../src/llm/provider.interface.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function createInput(): LLMInput {
  return {
    repoFacts: {
      languages: ["typescript"],
      frameworks: ["nestjs"],
      topLevelStructure: ["src"],
      dependencySummary: {
        files: ["package.json"],
        packageDependenciesCount: 1,
        composerDependenciesCount: 0
      },
      architecturalSignals: ["node-project"],
      complianceLevel: "L1"
    },
    contractData: {
      arrcVersion: "1.0.0",
      version: "1.0.0",
      generatedAt: "2026-01-01T00:00:00.000Z",
      complianceLevel: "L1",
      scanSummary: {
        languages: ["typescript"],
        frameworks: ["nestjs"],
        dependencyFiles: ["package.json"]
      },
      fingerprint: {
        version: "1.0.0",
        generatedAt: "2026-01-01T00:00:00.000Z",
        structureHash: "a".repeat(64),
        dependenciesHash: "b".repeat(64),
        docsHash: "c".repeat(64),
        fingerprint: "d".repeat(64)
      }
    },
    currentDocs: {
      "docs/agent-first.md": "# Base"
    },
    generationType: "docs"
  };
}

describe("OpenAIProvider", () => {
  it("parses successful JSON response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({ enrichedContent: { "docs/agent-first.md": "extra" } })
            }
          }
        ],
        usage: { total_tokens: 123 }
      })
    } as Response);

    const provider = new OpenAIProvider({
      apiKey: "test",
      model: "gpt-5-mini",
      temperature: 0.2,
      baseUrl: "https://api.openai.com/v1",
      providerName: "openai"
    });
    const output = await provider.generate(createInput());

    expect(output.enrichedContent["docs/agent-first.md"]).toBe("extra");
    expect(output.metadata.tokensUsed).toBe(123);
  });

  it("throws provider error for unauthorized status", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401
    } as Response);

    const provider = new OpenAIProvider({
      apiKey: "test",
      model: "gpt-5-mini",
      temperature: 0.2,
      baseUrl: "https://api.openai.com/v1",
      providerName: "openai"
    });

    await expect(provider.generate(createInput())).rejects.toBeInstanceOf(LLMProviderError);
  });

  it("throws provider error for malformed content", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "not-json" } }]
      })
    } as Response);

    const provider = new OpenAIProvider({
      apiKey: "test",
      model: "gpt-5-mini",
      temperature: 0.2,
      baseUrl: "https://api.openai.com/v1",
      providerName: "openai"
    });

    await expect(provider.generate(createInput())).rejects.toBeInstanceOf(LLMProviderError);
  });

  it("supports openai-compatible mode without auth header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({ enrichedContent: { "docs/agent-first.md": "extra" } })
            }
          }
        ]
      })
    } as Response);

    globalThis.fetch = fetchMock;

    const provider = new OpenAIProvider({
      model: "local-model",
      temperature: 0.2,
      baseUrl: "http://localhost:11434/v1",
      providerName: "openai-compatible"
    });

    await provider.generate(createInput());

    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toBe("http://localhost:11434/v1/chat/completions");
    expect((call[1].headers as Record<string, string>).Authorization).toBeUndefined();
  });
});
