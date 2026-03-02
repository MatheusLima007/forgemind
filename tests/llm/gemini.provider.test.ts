import { afterEach, describe, expect, it, vi } from "vitest";
import { GeminiProvider } from "../../src/llm/gemini.provider.js";
import { LLMProviderError } from "../../src/llm/provider.interface.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function createRequest() {
  return {
    messages: [
      { role: "system" as const, content: "Return strict JSON" },
      { role: "user" as const, content: "Generate hypotheses" }
    ],
    jsonMode: true
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
                { text: JSON.stringify({ hypotheses: [{ id: "h-1" }] }) }
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
    const output = await provider.chat(createRequest());

    expect(output.content).toContain("h-1");
    expect(output.metadata.provider).toBe("gemini");
    expect(output.metadata.model).toBe("gemini-1.5-flash");
    expect(output.metadata.tokensUsed).toBe(456);
  });

  it("handles markdown-fenced JSON response", async () => {
    const jsonContent = JSON.stringify({ ok: true, mode: "fenced" });
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
    const output = await provider.chat(createRequest());

    expect(output.content).toContain("fenced");
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

    await expect(provider.chat(createRequest())).rejects.toBeInstanceOf(LLMProviderError);
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

    await expect(provider.chat(createRequest())).rejects.toBeInstanceOf(LLMProviderError);
  });

  it("returns raw text even when content is not valid JSON", async () => {
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

    const output = await provider.chat(createRequest());
    expect(output.content).toBe("not json at all");
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
    await provider.chat(createRequest());

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
