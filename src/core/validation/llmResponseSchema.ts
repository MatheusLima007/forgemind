import type { LLMOutput, LLMProviderName } from "../types/index.js";

const SUPPORTED_OUTPUT_PROVIDERS: Array<Exclude<LLMProviderName, "none">> = ["openai", "openai-compatible", "anthropic", "azure", "local"];

export function validateLLMOutputSchema(payload: unknown): payload is LLMOutput {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const candidate = payload as {
    enrichedContent?: unknown;
    metadata?: unknown;
  };

  if (typeof candidate.enrichedContent !== "object" || candidate.enrichedContent === null || Array.isArray(candidate.enrichedContent)) {
    return false;
  }

  for (const value of Object.values(candidate.enrichedContent)) {
    if (typeof value !== "string") {
      return false;
    }
  }

  if (typeof candidate.metadata !== "object" || candidate.metadata === null || Array.isArray(candidate.metadata)) {
    return false;
  }

  const metadata = candidate.metadata as {
    provider?: unknown;
    model?: unknown;
    baseUrl?: unknown;
    tokensUsed?: unknown;
  };

  if (typeof metadata.provider !== "string" || !SUPPORTED_OUTPUT_PROVIDERS.includes(metadata.provider as Exclude<LLMProviderName, "none">)) {
    return false;
  }

  if (typeof metadata.model !== "string" || metadata.model.trim() === "") {
    return false;
  }

  if (metadata.baseUrl !== undefined && (typeof metadata.baseUrl !== "string" || metadata.baseUrl.trim() === "")) {
    return false;
  }

  if (metadata.tokensUsed !== undefined && (typeof metadata.tokensUsed !== "number" || Number.isNaN(metadata.tokensUsed) || metadata.tokensUsed < 0)) {
    return false;
  }

  return true;
}
