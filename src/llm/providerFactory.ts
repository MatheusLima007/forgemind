import type { LLMConfig, LLMProviderName } from "../core/types/index.js";
import { AnthropicProvider } from "./anthropic.provider.js";
import { GeminiProvider } from "./gemini.provider.js";
import { OpenAIProvider } from "./openai.provider.js";
import type { LLMProvider } from "./provider.interface.js";

export interface LLMProviderResolution {
  provider: LLMProvider | null;
  skipReason?: string;
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

function resolveApiKey(config: LLMConfig, providerName: Exclude<LLMProviderName, "none">): string | undefined {
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

  if (providerName === "gemini") {
    return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? process.env.FORGEMIND_LLM_API_KEY;
  }

  return process.env.FORGEMIND_LLM_API_KEY;
}

export function createLLMProvider(config: LLMConfig, providerOverride?: LLMProviderName): LLMProviderResolution {
  const providerName = providerOverride ?? config.provider;

  if (providerName === "none") {
    return { provider: null, skipReason: "provider-none" };
  }

  if (providerName === "openai" || providerName === "openai-compatible") {
    const apiKey = resolveApiKey(config, providerName);

    if (providerName === "openai" && !apiKey) {
      return { provider: null, skipReason: "missing-api-key" };
    }

    const baseUrl = resolveBaseUrl(config) ?? "https://api.openai.com/v1";

    if (providerName === "openai-compatible" && !resolveBaseUrl(config)) {
      return { provider: null, skipReason: "missing-base-url" };
    }

    return {
      provider: new OpenAIProvider({
        apiKey,
        model: config.model,
        temperature: config.temperature,
        baseUrl,
        providerName
      })
    };
  }

  if (providerName === "anthropic") {
    const apiKey = resolveApiKey(config, "anthropic");
    if (!apiKey) {
      return { provider: null, skipReason: "missing-api-key" };
    }

    return {
      provider: new AnthropicProvider({
        apiKey,
        model: config.model,
        temperature: config.temperature
      })
    };
  }

  if (providerName === "gemini") {
    const apiKey = resolveApiKey(config, "gemini");
    if (!apiKey) {
      return { provider: null, skipReason: "missing-api-key" };
    }

    return {
      provider: new GeminiProvider({
        apiKey,
        model: config.model,
        temperature: config.temperature
      })
    };
  }

  // azure and local are not yet supported
  if (providerName === "azure" || providerName === "local") {
    return { provider: null, skipReason: `${providerName}-not-implemented` };
  }

  return { provider: null, skipReason: "unsupported-provider" };
}
