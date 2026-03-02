import { afterEach, describe, expect, it } from "vitest";
import { createLLMProvider, resolveProviderRuntime } from "../../src/llm/providerFactory.js";
import type { LLMConfig } from "../../src/core/types/index.js";

const originalApiKey = process.env.OPENAI_API_KEY;
const originalForgeApiKey = process.env.FORGEMIND_LLM_API_KEY;
const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
const originalAzureKey = process.env.AZURE_OPENAI_API_KEY;
const originalGeminiKey = process.env.GEMINI_API_KEY;
const originalGoogleKey = process.env.GOOGLE_API_KEY;
const originalBaseUrl = process.env.FORGEMIND_LLM_BASE_URL;

afterEach(() => {
  if (originalApiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalApiKey;
  }

  if (originalForgeApiKey === undefined) {
    delete process.env.FORGEMIND_LLM_API_KEY;
  } else {
    process.env.FORGEMIND_LLM_API_KEY = originalForgeApiKey;
  }

  if (originalAnthropicKey === undefined) {
    delete process.env.ANTHROPIC_API_KEY;
  } else {
    process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
  }

  if (originalAzureKey === undefined) {
    delete process.env.AZURE_OPENAI_API_KEY;
  } else {
    process.env.AZURE_OPENAI_API_KEY = originalAzureKey;
  }

  if (originalGeminiKey === undefined) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = originalGeminiKey;
  }

  if (originalGoogleKey === undefined) {
    delete process.env.GOOGLE_API_KEY;
  } else {
    process.env.GOOGLE_API_KEY = originalGoogleKey;
  }

  if (originalBaseUrl === undefined) {
    delete process.env.FORGEMIND_LLM_BASE_URL;
  } else {
    process.env.FORGEMIND_LLM_BASE_URL = originalBaseUrl;
  }
});

const enabledConfig: LLMConfig = {
  provider: "openai",
  model: "gpt-5-mini",
  temperature: 0.2,
  maxTokensBudget: 5000
};

describe("createLLMProvider", () => {
  it("returns null when provider is none", () => {
    const resolution = createLLMProvider(enabledConfig, "none");
    expect(resolution.provider).toBeNull();
    expect(resolution.skipReason).toBe("provider-none");
  });

  it("returns null when API key is missing for openai", () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.FORGEMIND_LLM_API_KEY;

    const resolution = createLLMProvider(enabledConfig, "openai");
    expect(resolution.provider).toBeNull();
    expect(resolution.skipReason).toBe("missing-api-key");
  });

  it("returns provider when API key exists", () => {
    process.env.OPENAI_API_KEY = "test-key";

    const resolution = createLLMProvider(enabledConfig, "openai");
    expect(resolution.provider).not.toBeNull();
    expect(resolution.skipReason).toBeUndefined();
  });

  it("supports openai-compatible provider with only baseUrl", () => {
    const resolution = createLLMProvider({
      ...enabledConfig,
      provider: "openai-compatible",
      baseUrl: "http://localhost:11434/v1"
    }, "openai-compatible");

    expect(resolution.provider).not.toBeNull();
    expect(resolution.skipReason).toBeUndefined();
  });

  it("resolves provider-specific key before generic fallback", () => {
    process.env.ANTHROPIC_API_KEY = "anthropic-specific";
    process.env.FORGEMIND_LLM_API_KEY = "generic-key";

    const runtime = resolveProviderRuntime(enabledConfig, "anthropic");
    expect(runtime.apiKey).toBe("anthropic-specific");
  });

  it("resolves azure-specific key before generic fallback", () => {
    process.env.AZURE_OPENAI_API_KEY = "azure-specific";
    process.env.FORGEMIND_LLM_API_KEY = "generic-key";

    const runtime = resolveProviderRuntime(enabledConfig, "azure");
    expect(runtime.apiKey).toBe("azure-specific");
  });

  it("uses generic key fallback when provider key is absent", () => {
    delete process.env.OPENAI_API_KEY;
    process.env.FORGEMIND_LLM_API_KEY = "generic-key";

    const runtime = resolveProviderRuntime(enabledConfig, "openai");
    expect(runtime.apiKey).toBe("generic-key");
  });

  it("resolves baseUrl from env when config baseUrl is absent", () => {
    process.env.FORGEMIND_LLM_BASE_URL = "http://localhost:1234/v1";

    const runtime = resolveProviderRuntime(enabledConfig, "openai-compatible");
    expect(runtime.baseUrl).toBe("http://localhost:1234/v1");
  });

  it("prefers config baseUrl over env baseUrl", () => {
    process.env.FORGEMIND_LLM_BASE_URL = "http://env.local/v1";

    const runtime = resolveProviderRuntime(
      {
        ...enabledConfig,
        baseUrl: "http://config.local/v1"
      },
      "openai-compatible"
    );

    expect(runtime.baseUrl).toBe("http://config.local/v1");
  });

  it("returns gemini provider when GEMINI_API_KEY is set", () => {
    process.env.GEMINI_API_KEY = "gemini-test-key";

    const resolution = createLLMProvider(
      { ...enabledConfig, provider: "gemini", model: "gemini-1.5-flash" },
      "gemini"
    );
    expect(resolution.provider).not.toBeNull();
    expect(resolution.skipReason).toBeUndefined();
  });

  it("returns gemini provider when GOOGLE_API_KEY is set", () => {
    delete process.env.GEMINI_API_KEY;
    process.env.GOOGLE_API_KEY = "google-test-key";

    const resolution = createLLMProvider(
      { ...enabledConfig, provider: "gemini", model: "gemini-1.5-pro" },
      "gemini"
    );
    expect(resolution.provider).not.toBeNull();
  });

  it("returns null for gemini when no API key is available", () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.FORGEMIND_LLM_API_KEY;

    const resolution = createLLMProvider(
      { ...enabledConfig, provider: "gemini", model: "gemini-1.5-flash" },
      "gemini"
    );
    expect(resolution.provider).toBeNull();
    expect(resolution.skipReason).toBe("missing-api-key");
  });

  it("resolves gemini-specific key before generic fallback", () => {
    process.env.GEMINI_API_KEY = "gemini-specific";
    process.env.FORGEMIND_LLM_API_KEY = "generic-key";

    const runtime = resolveProviderRuntime(enabledConfig, "gemini");
    expect(runtime.apiKey).toBe("gemini-specific");
  });
});
