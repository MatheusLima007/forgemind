import type { LLMConfig, LLMProviderName } from "../core/types/index.js";
import type { LLMProvider } from "./provider.interface.js";
import { createLLMProvider } from "./providerFactory.js";
import { TokenBudgetEnforcer } from "../core/runtime/tokenBudgetEnforcer.js";
import { getProviderCapabilities } from "./providerCapabilities.js";

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
  private budgetedProvider: LLMProvider | null = null;
  private skipReason?: string;
  private readonly tokenBudgetEnforcer: TokenBudgetEnforcer;

  constructor(private readonly options: LLMOrchestratorOptions) {
    this.tokenBudgetEnforcer = new TokenBudgetEnforcer(options.config.maxTokensBudget);
  }

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
    if (this.budgetedProvider) {
      return this.budgetedProvider;
    }

    const { provider: baseProvider, skipReason } = this.resolve();
    if (!baseProvider) {
      throw new Error(
        `LLM provider is required but unavailable. Reason: ${skipReason ?? "unknown"}. ` +
        "ForgeMind requires an LLM provider to generate documentation. " +
        "Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY environment variable, " +
        "or configure llm.apiKey in forgemind.config.json."
      );
    }

    const budgetedProvider = this.tokenBudgetEnforcer.wrapProvider(baseProvider);
    const providerName = this.getProviderName() as Exclude<LLMProviderName, "none">;
    const capabilities = getProviderCapabilities(providerName);

    this.budgetedProvider = {
      chat: async (request) => {
        const adaptedRequest = adaptRequestForCapabilities(request, capabilities.maxOutputTokens, capabilities.supportsJsonMode);
        return budgetedProvider.chat(adaptedRequest);
      }
    };

    return this.budgetedProvider;
  }

  getProviderName(): string {
    return this.options.providerOverride ?? this.options.config.provider;
  }

  getModelName(): string {
    return this.options.config.model;
  }

  getCapabilities() {
    const providerName = this.getProviderName() as Exclude<LLMProviderName, "none">;
    return getProviderCapabilities(providerName);
  }

  setStage(stage: string): void {
    this.tokenBudgetEnforcer.setStage(stage);
  }

  getTokenUsageReport() {
    return this.tokenBudgetEnforcer.getReport();
  }
}

function adaptRequestForCapabilities(
  request: Parameters<LLMProvider["chat"]>[0],
  maxOutputTokens: number,
  supportsJsonMode: boolean
): Parameters<LLMProvider["chat"]>[0] {
  const adapted = {
    ...request,
    maxOutputTokens: request.maxOutputTokens
      ? Math.min(request.maxOutputTokens, maxOutputTokens)
      : maxOutputTokens
  };

  if (!request.jsonMode || supportsJsonMode) {
    return adapted;
  }

  const strictJsonInstruction =
    "Return only strict JSON object. Do not include markdown, explanations, prefixes or suffixes.";

  const hasSystemMessage = adapted.messages.some((message) => message.role === "system");

  if (hasSystemMessage) {
    return {
      ...adapted,
      messages: adapted.messages.map((message) =>
        message.role === "system"
          ? { ...message, content: `${message.content}\n\n${strictJsonInstruction}` }
          : message
      )
    };
  }

  return {
    ...adapted,
    messages: [
      { role: "system", content: strictJsonInstruction },
      ...adapted.messages
    ]
  };
}
