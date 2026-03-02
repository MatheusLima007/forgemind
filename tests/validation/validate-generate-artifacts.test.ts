import { describe, expect, it } from "vitest";
import { validateContractSchema, validateFingerprintSchema } from "../../src/core/validation/arrcSchema.js";
import { validateLLMOutputSchema } from "../../src/core/validation/llmResponseSchema.js";

describe("validation artifacts integration", () => {
  it("accepts valid contract + fingerprint artifacts", () => {
    const fingerprint = {
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
      structureHash: "a".repeat(64),
      dependenciesHash: "b".repeat(64),
      docsHash: "c".repeat(64),
      fingerprint: "d".repeat(64)
    };

    const contract = {
      arrcVersion: "1.0.0",
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
      complianceLevel: "L1",
      scanSummary: {
        languages: ["typescript"],
        frameworks: ["node"],
        dependencyFiles: ["package.json"]
      },
      fingerprint
    };

    expect(validateFingerprintSchema(fingerprint).valid).toBe(true);
    expect(validateContractSchema(contract).valid).toBe(true);
  });

  it("rejects malformed generated LLM artifact payload", () => {
    const malformed = {
      enrichedContent: {
        "docs/system-ontology.md": "ok"
      },
      metadata: {
        provider: "openai",
        model: ""
      }
    };

    expect(validateLLMOutputSchema(malformed)).toBe(false);
  });
});
