import type { LLMInput, LLMOutput } from "../core/types/index.js";

export interface LLMProvider {
  generate(input: LLMInput): Promise<LLMOutput>;
}

export class LLMProviderError extends Error {
  readonly recoverable: boolean;

  constructor(message: string, recoverable = true) {
    super(message);
    this.name = "LLMProviderError";
    this.recoverable = recoverable;
  }
}
