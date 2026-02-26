import type { LLMInput, LLMOutput } from "../core/types/index.js";
import { LLMProviderError, type LLMProvider } from "./provider.interface.js";

export class AzureProvider implements LLMProvider {
  async generate(_input: LLMInput): Promise<LLMOutput> {
    throw new LLMProviderError("Azure OpenAI provider not yet implemented", true);
  }
}
