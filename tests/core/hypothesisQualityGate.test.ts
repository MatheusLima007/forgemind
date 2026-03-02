import { describe, expect, it } from "vitest";
import { HypothesisQualityGate, shouldBlockConsolidation } from "../../src/core/intelligence/hypothesisQualityGate.js";
import type { Hypothesis } from "../../src/core/types/index.js";

describe("HypothesisQualityGate", () => {
  it("classifies low confidence hypotheses as needs-review", () => {
    const gate = new HypothesisQualityGate({ minConfidence: 0.7, maxPendingRatio: 0.4 });
    const hypotheses: Hypothesis[] = [
      {
        id: "h-1",
        category: "domain",
        statement: "A",
        confidence: 0.8,
        evidenceRefs: [],
        evidence: [],
        needsConfirmation: true,
        status: "pending"
      },
      {
        id: "h-2",
        category: "invariant",
        statement: "B",
        confidence: 0.3,
        evidenceRefs: [],
        evidence: [],
        needsConfirmation: true,
        status: "pending"
      }
    ];

    const summary = gate.apply(hypotheses);

    expect(hypotheses[1].status).toBe("needs-review");
    expect(summary.needsReview).toBe(1);
    expect(summary.blocked).toBe(true);
  });

  it("blocks consolidation when gate is blocked and interview is not completed", () => {
    const blocked = shouldBlockConsolidation(
      {
        total: 10,
        accepted: 3,
        needsReview: 7,
        rejected: 0,
        pendingRatio: 0.7,
        blocked: true
      },
      false
    );

    expect(blocked).toBe(true);
    expect(
      shouldBlockConsolidation(
        {
          total: 10,
          accepted: 3,
          needsReview: 7,
          rejected: 0,
          pendingRatio: 0.7,
          blocked: true
        },
        true
      )
    ).toBe(false);
  });
});
