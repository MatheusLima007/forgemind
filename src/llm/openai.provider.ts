import type { LLMRequest, LLMResponse } from "../core/types/index.js";
import { LLMProviderError, type LLMProvider } from "./provider.interface.js";

interface OpenAIProviderOptions {
  apiKey?: string;
  model: string;
  temperature: number;
  baseUrl: string;
  providerName: "openai" | "openai-compatible";
}

interface OpenAIResponseShape {
  choices?: Array<{
    message?: { content?: string };
  }>;
  usage?: {
    total_tokens?: number;
  };
}

export class OpenAIProvider implements LLMProvider {
  constructor(private readonly options: OpenAIProviderOptions) {}

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const endpoint = `${this.options.baseUrl.replace(/\/$/, "")}/chat/completions`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };

      if (this.options.apiKey) {
        headers.Authorization = `Bearer ${this.options.apiKey}`;
      }

      const body: Record<string, unknown> = {
        model: this.options.model,
        temperature: request.temperature ?? this.options.temperature,
        messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: request.maxOutputTokens
      };

      if (request.jsonMode) {
        body.response_format = { type: "json_object" };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (!response.ok) {
        const recoverable = response.status >= 500 || response.status === 408 || response.status === 429;
        throw new LLMProviderError(`OpenAI request failed with status ${response.status}`, recoverable);
      }

      const payload = (await response.json()) as OpenAIResponseShape;
      const rawContent = payload.choices?.[0]?.message?.content;
      if (typeof rawContent !== "string" || rawContent.trim() === "") {
        throw new LLMProviderError("OpenAI response did not contain message content", true);
      }

      return {
        content: rawContent,
        metadata: {
          provider: this.options.providerName,
          model: this.options.model,
          tokensUsed: payload.usage?.total_tokens
        }
      };
    } catch (error) {
      if (error instanceof LLMProviderError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new LLMProviderError("OpenAI request timed out", true);
      }
      throw new LLMProviderError("OpenAI provider failed unexpectedly", true);
    } finally {
      clearTimeout(timeout);
    }
  }
}
