import type { LLMInput, LLMOutput } from "../core/types/index.js";
import { LLMProviderError, type LLMProvider } from "./provider.interface.js";

interface OpenAIProviderOptions {
  apiKey?: string;
  model: string;
  temperature: number;
  baseUrl: string;
  providerName: "openai" | "openai-compatible";
}

interface OpenAIMessage {
  content?: string;
}

interface OpenAIResponseShape {
  choices?: Array<{
    message?: OpenAIMessage;
  }>;
  usage?: {
    total_tokens?: number;
  };
}

function extractJsonBlock(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new LLMProviderError("OpenAI response did not contain a valid JSON object", true);
  }

  return text.slice(start, end + 1);
}

function assertValidOutputShape(value: unknown): asserts value is { enrichedContent: Record<string, string> } {
  if (typeof value !== "object" || value === null) {
    throw new LLMProviderError("OpenAI response JSON must be an object", true);
  }

  const candidate = value as { enrichedContent?: unknown };
  if (typeof candidate.enrichedContent !== "object" || candidate.enrichedContent === null || Array.isArray(candidate.enrichedContent)) {
    throw new LLMProviderError("OpenAI response must include enrichedContent object", true);
  }

  for (const [key, item] of Object.entries(candidate.enrichedContent)) {
    if (typeof item !== "string") {
      throw new LLMProviderError(`OpenAI enrichedContent.${key} must be a string`, true);
    }
  }
}

export class OpenAIProvider implements LLMProvider {
  constructor(private readonly options: OpenAIProviderOptions) {}

  async generate(input: LLMInput): Promise<LLMOutput> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const endpoint = `${this.options.baseUrl.replace(/\/$/, "")}/chat/completions`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };

      if (this.options.apiKey) {
        headers.Authorization = `Bearer ${this.options.apiKey}`;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: this.options.model,
          temperature: this.options.temperature,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: "You are an assistant that enriches repository governance documents. Return ONLY a JSON object with key enrichedContent containing string values. Never change deterministic metadata blocks."
            },
            {
              role: "user",
              content: JSON.stringify(input)
            }
          ]
        }),
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

      const parsed = JSON.parse(extractJsonBlock(rawContent)) as unknown;
      assertValidOutputShape(parsed);

      return {
        enrichedContent: parsed.enrichedContent,
        metadata: {
          provider: this.options.providerName,
          model: this.options.model,
          baseUrl: this.options.baseUrl,
          tokensUsed: payload.usage?.total_tokens
        }
      };
    } catch (error) {
      if (error instanceof LLMProviderError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new LLMProviderError("OpenAI request timed out", true);
      }

      throw new LLMProviderError("OpenAI provider failed unexpectedly", true);
    } finally {
      clearTimeout(timeout);
    }
  }
}
