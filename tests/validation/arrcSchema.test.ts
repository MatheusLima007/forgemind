import { describe, expect, it } from "vitest";
import { validateContractSchema, validateFingerprintSchema } from "../../src/core/validation/arrcSchema.js";

function validFingerprint(): Record<string, string> {
  return {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    structureHash: "a".repeat(64),
    dependenciesHash: "b".repeat(64),
    docsHash: "c".repeat(64),
    fingerprint: "d".repeat(64)
  };
}

describe("arrc schema validation", () => {
  it("accepts valid contract", () => {
    const result = validateContractSchema({
      arrcVersion: "1.0.0",
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
      complianceLevel: "L1",
      scanSummary: {
        languages: ["typescript"],
        frameworks: ["react"],
        dependencyFiles: ["package.json"]
      },
      fingerprint: validFingerprint()
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects invalid compliance level", () => {
    const result = validateContractSchema({
      arrcVersion: "1.0.0",
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
      complianceLevel: "L2",
      scanSummary: {
        languages: ["typescript"],
        frameworks: ["react"],
        dependencyFiles: ["package.json"]
      },
      fingerprint: validFingerprint()
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("complianceLevel must be 'L1'");
  });

  it("rejects invalid fingerprint hash length", () => {
    const result = validateFingerprintSchema({
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
      structureHash: "abc",
      dependenciesHash: "b".repeat(64),
      docsHash: "c".repeat(64),
      fingerprint: "d".repeat(64)
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("structureHash must be a SHA-256 hex string");
  });
});
