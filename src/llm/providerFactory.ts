import type { LLMConfig, LLMProviderName } from "../core/types/index.js";
import { AnthropicProvider } from "./anthropic.provider.js";
import { AzureProvider } from "./azure.provider.js";
import { LocalProvider } from "./local.provider.js";
import { OpenAIProvider } from "./openai.provider.js";
import type { LLMProvider } from "./provider.interface.js";

export interface LLMProviderResolution {
  provider: LLMProvider | null;
  skipReason?: string;
}

export interface ResolvedProviderRuntime {
  apiKey?: string;
  baseUrl?: string;
}

function resolveBaseUrl(config: LLMConfig): string | undefined {
  if (config.baseUrl && config.baseUrl.trim() !== "") {
    return config.baseUrl;
  }

  if (process.env.FORGEMIND_LLM_BASE_URL && process.env.FORGEMIND_LLM_BASE_URL.trim() !== "") {
    return process.env.FORGEMIND_LLM_BASE_URL;
  }

  return undefined;
}

function resolveProviderApiKey(config: LLMConfig, providerName: Exclude<LLMProviderName, "none">): string | undefined {
  if (config.apiKey && config.apiKey.trim() !== "") {
    return config.apiKey;
  }

  if (providerName === "openai" || providerName === "openai-compatible") {
    return process.env.OPENAI_API_KEY ?? process.env.FORGEMIND_LLM_API_KEY;
  }

  if (providerName === "anthropic") {
    return process.env.ANTHROPIC_API_KEY ?? process.env.FORGEMIND_LLM_API_KEY;
  }

  if (providerName === "azure") {
    return process.env.AZURE_OPENAI_API_KEY ?? process.env.FORGEMIND_LLM_API_KEY;
  }

  return process.env.FORGEMIND_LLM_API_KEY;
}

export function resolveProviderRuntime(config: LLMConfig, providerName: Exclude<LLMProviderName, "none">): ResolvedProviderRuntime {
  return {
    apiKey: resolveProviderApiKey(config, providerName),
    baseUrl: resolveBaseUrl(config)
  };
}

export function createLLMProvider(config: LLMConfig | undefined, providerName: LLMProviderName): LLMProviderResolution {
  if (providerName === "none") {
    return { provider: null, skipReason: "provider-none" };
  }

  if (!config || !config.enabled) {
    return { provider: null, skipReason: "llm-disabled" };
  }

  const effectiveProvider = providerName;

  if (effectiveProvider === "openai" || effectiveProvider === "openai-compatible") {
    const runtime = resolveProviderRuntime(config, effectiveProvider);

    if (effectiveProvider === "openai" && !runtime.apiKey) {
      return { provider: null, skipReason: "missing-api-key" };
    }

    if (effectiveProvider === "openai-compatible" && !runtime.baseUrl) {
      return { provider: null, skipReason: "missing-base-url" };
    }

    const baseUrl = runtime.baseUrl ?? "https://api.openai.com/v1";

    return {
      provider: new OpenAIProvider({
        apiKey: runtime.apiKey,
        model: config.model,
        temperature: config.temperature,
        baseUrl,
        providerName: effectiveProvider
      })
    };
  }

  if (effectiveProvider === "anthropic") {
    const runtime = resolveProviderRuntime(config, "anthropic");
    if (!runtime.apiKey) {
      return { provider: null, skipReason: "missing-api-key" };
    }

    return { provider: new AnthropicProvider() };
  }

  if (effectiveProvider === "azure") {
    const runtime = resolveProviderRuntime(config, "azure");
    if (!runtime.apiKey) {
      return { provider: null, skipReason: "missing-api-key" };
    }

    if (!runtime.baseUrl) {
      return { provider: null, skipReason: "missing-base-url" };
    }

    return { provider: new AzureProvider() };
  }

  if (effectiveProvider === "local") {
    const runtime = resolveProviderRuntime(config, "local");
    if (!runtime.baseUrl) {
      return { provider: null, skipReason: "missing-base-url" };
    }

    return { provider: new LocalProvider() };
  }

  return { provider: null, skipReason: "unsupported-provider" };
}
