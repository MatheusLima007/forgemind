import type { LLMInput, LLMOutput } from "../core/types/index.js";
import { LLMProviderError, type LLMProvider } from "./provider.interface.js";

export class AnthropicProvider implements LLMProvider {
  async generate(_input: LLMInput): Promise<LLMOutput> {
    throw new LLMProviderError("Anthropic provider not yet implemented", true);
  }
}
