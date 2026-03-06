import type { LLMRequest, LLMResponse } from "../core/types/index.js";
import { LLMProviderError, type LLMProvider } from "./provider.interface.js";

interface AnthropicProviderOptions {
  apiKey: string;
  model: string;
  temperature: number;
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicResponseShape {
  content?: AnthropicContentBlock[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

export class AnthropicProvider implements LLMProvider {
  constructor(private readonly options: AnthropicProviderOptions) {}

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    try {
      // Separate system message from conversation messages
      const systemMessage = request.messages.find((m) => m.role === "system");
      const conversationMessages = request.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content }));

      const body: Record<string, unknown> = {
        model: this.options.model,
        max_tokens: request.maxOutputTokens ?? 8192,
        temperature: request.temperature ?? this.options.temperature,
        messages: conversationMessages
      };

      if (systemMessage) {
        body.system = systemMessage.content;
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.options.apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (!response.ok) {
        const recoverable = response.status >= 500 || response.status === 408 || response.status === 429;
        throw new LLMProviderError(`Anthropic request failed with status ${response.status}`, recoverable);
      }

      const payload = (await response.json()) as AnthropicResponseShape;
      const textBlock = payload.content?.find((block) => block.type === "text");
      const rawContent = textBlock?.text;

      if (typeof rawContent !== "string" || rawContent.trim() === "") {
        throw new LLMProviderError("Anthropic response did not contain text content", true);
      }

      const tokensUsed = (payload.usage?.input_tokens ?? 0) + (payload.usage?.output_tokens ?? 0);

      return {
        content: rawContent,
        metadata: {
          provider: "anthropic",
          model: this.options.model,
          tokensUsed: tokensUsed || undefined
        }
      };
    } catch (error) {
      if (error instanceof LLMProviderError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new LLMProviderError("Anthropic request timed out", true);
      }

      throw new LLMProviderError(`Anthropic provider failed: ${error instanceof Error ? error.message : String(error)}`, true);
    } finally {
      clearTimeout(timeout);
    }
  }
}
