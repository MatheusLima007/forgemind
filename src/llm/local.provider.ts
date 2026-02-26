import type { LLMInput, LLMOutput } from "../core/types/index.js";
import { LLMProviderError, type LLMProvider } from "./provider.interface.js";

export class LocalProvider implements LLMProvider {
  async generate(_input: LLMInput): Promise<LLMOutput> {
    throw new LLMProviderError("Local provider not yet implemented", true);
  }
}
