import { describe, expect, it } from "vitest";
import { getProviderCapabilities } from "../../src/llm/providerCapabilities.js";

describe("providerCapabilities", () => {
  it("returns json mode support for openai", () => {
    const capabilities = getProviderCapabilities("openai");
    expect(capabilities.supportsJsonMode).toBe(true);
    expect(capabilities.maxOutputTokens).toBeGreaterThan(1000);
  });

  it("marks anthropic as no native json mode", () => {
    const capabilities = getProviderCapabilities("anthropic");
    expect(capabilities.supportsJsonMode).toBe(false);
    expect(["low", "medium", "high"]).toContain(capabilities.varianceLevel);
  });
});
