import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAIProvider } from "../../src/llm/openai.provider.js";
import { LLMProviderError } from "../../src/llm/provider.interface.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function createRequest() {
  return {
    messages: [
      { role: "system" as const, content: "Return JSON" },
      { role: "user" as const, content: "Generate summary" }
    ],
    jsonMode: true
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
              content: JSON.stringify({ ok: true, value: "extra" })
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
    const output = await provider.chat(createRequest());

    expect(output.content).toContain("\"ok\":true");
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

    await expect(provider.chat(createRequest())).rejects.toBeInstanceOf(LLMProviderError);
  });

  it("throws provider error for malformed content", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "" } }]
      })
    } as Response);

    const provider = new OpenAIProvider({
      apiKey: "test",
      model: "gpt-5-mini",
      temperature: 0.2,
      baseUrl: "https://api.openai.com/v1",
      providerName: "openai"
    });

    await expect(provider.chat(createRequest())).rejects.toBeInstanceOf(LLMProviderError);
  });

  it("supports openai-compatible mode without auth header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({ ok: true })
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

    await provider.chat(createRequest());

    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toBe("http://localhost:11434/v1/chat/completions");
    expect((call[1].headers as Record<string, string>).Authorization).toBeUndefined();
  });
});
