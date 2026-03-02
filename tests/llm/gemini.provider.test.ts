import { afterEach, describe, expect, it, vi } from "vitest";
import type { LLMInput } from "../../src/core/types/index.js";
import { GeminiProvider } from "../../src/llm/gemini.provider.js";
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
    currentDocs: { "docs/agent-first.md": "# Base" },
    generationType: "docs"
  };
}

describe("GeminiProvider", () => {
  it("parses successful Gemini JSON response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                { text: JSON.stringify({ enrichedContent: { "docs/agent-first.md": "enriched by gemini" } }) }
              ]
            }
          }
        ],
        usageMetadata: { totalTokenCount: 456 }
      })
    } as Response);

    const provider = new GeminiProvider({
      apiKey: "test-gemini-key",
      model: "gemini-1.5-flash",
      temperature: 0.2
    });
    const output = await provider.generate(createInput());

    expect(output.enrichedContent["docs/agent-first.md"]).toBe("enriched by gemini");
    expect(output.metadata.provider).toBe("gemini");
    expect(output.metadata.model).toBe("gemini-1.5-flash");
    expect(output.metadata.tokensUsed).toBe(456);
  });

  it("handles markdown-fenced JSON response", async () => {
    const jsonContent = JSON.stringify({ enrichedContent: { "docs/agent-first.md": "fenced" } });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: `\`\`\`json\n${jsonContent}\n\`\`\`` }]
            }
          }
        ]
      })
    } as Response);

    const provider = new GeminiProvider({
      apiKey: "test-gemini-key",
      model: "gemini-1.5-pro",
      temperature: 0.2
    });
    const output = await provider.generate(createInput());

    expect(output.enrichedContent["docs/agent-first.md"]).toBe("fenced");
  });

  it("throws provider error for non-ok status", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403
    } as Response);

    const provider = new GeminiProvider({
      apiKey: "test-gemini-key",
      model: "gemini-1.5-flash",
      temperature: 0.2
    });

    await expect(provider.generate(createInput())).rejects.toBeInstanceOf(LLMProviderError);
  });

  it("throws provider error when response has no text content", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [] } }]
      })
    } as Response);

    const provider = new GeminiProvider({
      apiKey: "test-gemini-key",
      model: "gemini-1.5-flash",
      temperature: 0.2
    });

    await expect(provider.generate(createInput())).rejects.toBeInstanceOf(LLMProviderError);
  });

  it("throws provider error for malformed JSON content", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "not json at all" }] } }]
      })
    } as Response);

    const provider = new GeminiProvider({
      apiKey: "test-gemini-key",
      model: "gemini-1.5-flash",
      temperature: 0.2
    });

    await expect(provider.generate(createInput())).rejects.toBeInstanceOf(LLMProviderError);
  });

  it("normalizes flat-string enrichedContent into Record keyed by doc key", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify({ enrichedContent: "flat enriched text" }) }]
            }
          }
        ]
      })
    } as Response);

    const provider = new GeminiProvider({
      apiKey: "test-gemini-key",
      model: "gemini-2.5-flash",
      temperature: 0.2
    });
    const output = await provider.generate(createInput());

    expect(output.enrichedContent["docs/agent-first.md"]).toBe("flat enriched text");
  });

  it("stringifies nested object values in enrichedContent", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    enrichedContent: {
                      profile: { name: "mapspet", stack: ["nestjs"] }
                    }
                  })
                }
              ]
            }
          }
        ]
      })
    } as Response);

    const input = createInput();
    input.currentDocs = { profile: '{"name":"base"}' };
    const provider = new GeminiProvider({
      apiKey: "test-gemini-key",
      model: "gemini-2.5-flash",
      temperature: 0.2
    });
    const output = await provider.generate(input);

    expect(output.enrichedContent.profile).toBe(JSON.stringify({ name: "mapspet", stack: ["nestjs"] }));
  });

  it("falls back to flat doc keys when enrichedContent wrapper is absent", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({ "docs/agent-first.md": "content without wrapper" })
                }
              ]
            }
          }
        ]
      })
    } as Response);

    const provider = new GeminiProvider({
      apiKey: "test-gemini-key",
      model: "gemini-2.5-flash",
      temperature: 0.2
    });
    const output = await provider.generate(createInput());

    expect(output.enrichedContent["docs/agent-first.md"]).toBe("content without wrapper");
  });

  it("sends API key as query param and uses responseMimeType", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify({ enrichedContent: { "docs/agent-first.md": "ok" } }) }]
            }
          }
        ]
      })
    } as Response);

    globalThis.fetch = fetchMock;

    const provider = new GeminiProvider({
      apiKey: "my-secret-key",
      model: "gemini-1.5-flash",
      temperature: 0.3
    });
    await provider.generate(createInput());

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("key=my-secret-key");
    expect(url).toContain("gemini-1.5-flash");
    expect(url).toContain("generativelanguage.googleapis.com");

    const body = JSON.parse(options.body as string) as Record<string, unknown>;
    const genConfig = body.generationConfig as Record<string, unknown>;
    expect(genConfig.temperature).toBe(0.3);
    expect(genConfig.responseMimeType).toBe("application/json");
  });
});
