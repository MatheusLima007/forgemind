import { describe, expect, it } from "vitest";
import { baselineKey, SemanticDriftDetector, shouldRunSemanticDriftCheck } from "../../src/core/validation/semanticDriftDetector.js";
import type { LLMProvider } from "../../src/llm/provider.interface.js";

class MockCalibrationProvider implements LLMProvider {
  constructor(private readonly content: string) {}

  async chat() {
    return {
      content: this.content,
      metadata: {
        provider: "openai",
        model: "mock"
      }
    };
  }
}

describe("SemanticDriftDetector", () => {
  it("flags action required when drift exceeds threshold", async () => {
    const baselineProvider = new MockCalibrationProvider(
      JSON.stringify({
        hypotheses: [
          { category: "domain", statement: "Orders must be approved" },
          { category: "boundary", statement: "API can call service" }
        ]
      })
    );

    const detector = new SemanticDriftDetector(0.2);
    const baseline = await detector.runCalibration(baselineProvider, [], [], []);

    const driftProvider = new MockCalibrationProvider(
      JSON.stringify({
        hypotheses: [
          { category: "risk", statement: "Retries hide failures" },
          { category: "decision", statement: "Use async eventual consistency" }
        ]
      })
    );

    const result = await detector.detect({
      provider: driftProvider,
      providerName: "gemini",
      modelName: "gemini-2.0-flash",
      previous: {
        provider: "openai",
        model: "gpt-5-mini",
        previousProvider: "openai",
        previousModel: "gpt-5-mini",
        diffSummary: [],
        driftScore: 0,
        actionRequired: false,
        generatedAt: new Date().toISOString()
      },
      baseline: {
        provider: "openai",
        model: "gpt-5-mini",
        calibration: baseline,
        acceptedAt: new Date().toISOString()
      },
      signals: [],
      samples: [],
      domainCandidates: []
    });

    expect(result.report.driftScore).toBeGreaterThan(0.2);
    expect(result.report.actionRequired).toBe(true);
    expect(result.report.diffSummary.length).toBeGreaterThan(0);
  });

  it("runs drift check on provider/model change", () => {
    expect(
      shouldRunSemanticDriftCheck(
        {
          provider: "openai",
          model: "gpt-5-mini",
          previousProvider: "openai",
          previousModel: "gpt-5-mini",
          diffSummary: [],
          driftScore: 0,
          actionRequired: false,
          generatedAt: new Date().toISOString()
        },
        "gemini",
        "gemini-2.0-flash"
      )
    ).toBe(true);

    expect(
      shouldRunSemanticDriftCheck(
        {
          provider: "openai",
          model: "gpt-5-mini",
          previousProvider: "openai",
          previousModel: "gpt-5-mini",
          diffSummary: [],
          driftScore: 0,
          actionRequired: false,
          generatedAt: new Date().toISOString()
        },
        "openai",
        "gpt-5-mini"
      )
    ).toBe(false);
  });

  it("builds deterministic baseline key per provider/model", () => {
    expect(baselineKey("openai", "gpt-5-mini")).toBe("openai:gpt-5-mini");
    expect(baselineKey("gemini", "gemini-2.0-flash")).toBe("gemini:gemini-2.0-flash");
  });
});
