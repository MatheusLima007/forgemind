import type { LLMRequest, LLMResponse } from "../core/types/index.js";
import { LLMProviderError, type LLMProvider } from "./provider.interface.js";

interface GeminiProviderOptions {
  apiKey: string;
  model: string;
  temperature: number;
}

interface GeminiResponseShape {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: {
    totalTokenCount?: number;
  };
}

export class GeminiProvider implements LLMProvider {
  constructor(private readonly options: GeminiProviderOptions) {}

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.options.model}:generateContent?key=${this.options.apiKey}`;

      // Combine system + user messages into a single prompt for Gemini
      const systemMsg = request.messages.find((m) => m.role === "system");
      const userMsgs = request.messages.filter((m) => m.role !== "system");

      const parts: Array<{ text: string }> = [];
      if (systemMsg) {
        parts.push({ text: `[System Instructions]\n${systemMsg.content}\n\n[End System Instructions]\n\n` });
      }
      for (const msg of userMsgs) {
        parts.push({ text: msg.content });
      }

      const generationConfig: Record<string, unknown> = {
        temperature: request.temperature ?? this.options.temperature,
        maxOutputTokens: request.maxOutputTokens
      };

      if (request.jsonMode) {
        generationConfig.responseMimeType = "application/json";
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const recoverable = response.status >= 500 || response.status === 408 || response.status === 429;
        throw new LLMProviderError(`Gemini request failed with status ${response.status}`, recoverable);
      }

      const payload = (await response.json()) as GeminiResponseShape;
      const rawContent = payload.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof rawContent !== "string" || rawContent.trim() === "") {
        throw new LLMProviderError("Gemini response did not contain text content", true);
      }

      return {
        content: rawContent,
        metadata: {
          provider: "gemini",
          model: this.options.model,
          tokensUsed: payload.usageMetadata?.totalTokenCount
        }
      };
    } catch (error) {
      if (error instanceof LLMProviderError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new LLMProviderError("Gemini request timed out", true);
      }
      throw new LLMProviderError(`Gemini provider failed: ${error instanceof Error ? error.message : String(error)}`, true);
    } finally {
      clearTimeout(timeout);
    }
  }
}
