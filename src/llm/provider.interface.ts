import type { LLMRequest, LLMResponse } from "../core/types/index.js";

export interface LLMProvider {
  chat(request: LLMRequest): Promise<LLMResponse>;
}

export class LLMProviderError extends Error {
  readonly recoverable: boolean;

  constructor(message: string, recoverable = true) {
    super(message);
    this.name = "LLMProviderError";
    this.recoverable = recoverable;
  }
}
