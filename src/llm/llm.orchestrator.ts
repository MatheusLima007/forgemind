import type { LLMConfig, LLMProviderName } from "../core/types/index.js";
import type { LLMProvider } from "./provider.interface.js";
import { createLLMProvider } from "./providerFactory.js";

export interface LLMOrchestratorOptions {
  config: LLMConfig;
  providerOverride?: LLMProviderName;
}

/**
 * LLM Orchestrator — resolves and provides LLM provider instances
 * for the context engineering pipeline.
 *
 * In the new architecture, the LLM is the central engine — not an optional enrichment layer.
 * Each pipeline phase (hypotheses, interview, consolidation, document generation) uses
 * the provider directly via the `chat()` interface.
 */
export class LLMOrchestrator {
  private provider: LLMProvider | null = null;
  private skipReason?: string;

  constructor(private readonly options: LLMOrchestratorOptions) {}

  resolve(): { provider: LLMProvider | null; skipReason?: string } {
    if (this.provider) {
      return { provider: this.provider };
    }

    const resolution = createLLMProvider(this.options.config, this.options.providerOverride);
    this.provider = resolution.provider;
    this.skipReason = resolution.skipReason;

    return resolution;
  }

  getProvider(): LLMProvider {
    const { provider, skipReason } = this.resolve();
    if (!provider) {
      throw new Error(
        `LLM provider is required but unavailable. Reason: ${skipReason ?? "unknown"}. ` +
        "ForgeMind requires an LLM provider to generate documentation. " +
        "Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY environment variable, " +
        "or configure llm.apiKey in forgemind.config.json."
      );
    }
    return provider;
  }

  getProviderName(): string {
    return this.options.providerOverride ?? this.options.config.provider;
  }

  getModelName(): string {
    return this.options.config.model;
  }
}
