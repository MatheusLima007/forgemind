import type { LLMProviderName, ProviderCapabilities } from "../core/types/index.js";

const DEFAULT_CAPABILITIES: ProviderCapabilities = {
  supportsJsonMode: false,
  maxOutputTokens: 4096,
  varianceLevel: "medium",
  supportsTools: false
};

const PROVIDER_CAPABILITIES: Record<Exclude<LLMProviderName, "none">, ProviderCapabilities> = {
  openai: {
    supportsJsonMode: true,
    maxOutputTokens: 16384,
    varianceLevel: "low",
    supportsTools: true
  },
  "openai-compatible": {
    supportsJsonMode: true,
    maxOutputTokens: 8192,
    varianceLevel: "medium",
    supportsTools: false
  },
  anthropic: {
    supportsJsonMode: false,
    maxOutputTokens: 8192,
    varianceLevel: "medium",
    supportsTools: false
  },
  azure: {
    supportsJsonMode: true,
    maxOutputTokens: 16384,
    varianceLevel: "low",
    supportsTools: true
  },
  gemini: {
    supportsJsonMode: true,
    maxOutputTokens: 8192,
    varianceLevel: "medium",
    supportsTools: true
  },
  local: {
    supportsJsonMode: false,
    maxOutputTokens: 4096,
    varianceLevel: "high",
    supportsTools: false
  }
};

export function getProviderCapabilities(providerName: Exclude<LLMProviderName, "none">): ProviderCapabilities {
  return PROVIDER_CAPABILITIES[providerName] ?? DEFAULT_CAPABILITIES;
}
