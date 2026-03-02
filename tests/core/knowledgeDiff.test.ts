import { describe, expect, it } from "vitest";
import { buildKnowledgeDiff } from "../../src/core/consolidator/knowledgeDiff.js";
import type { ConsolidatedKnowledge } from "../../src/core/types/index.js";

function makeKnowledge(): ConsolidatedKnowledge {
  return {
    systemOntology: {
      corePurpose: "Purpose",
      mentalModel: "Model",
      centralConcepts: ["A"],
      systemOrientation: "OO",
      principles: ["P"]
    },
    domainInvariants: {
      rules: [
        { name: "inv-1", description: "d1", severity: "critical", status: "confirmed" }
      ],
      validStates: [],
      invalidStates: [],
      constraints: []
    },
    conceptualBoundaries: {
      contexts: [],
      allowedRelations: [{ from: "A", to: "B", type: "sync" }],
      prohibitedRelations: [{ from: "A", to: "C", reason: "x" }],
      dangerousInteractions: []
    },
    decisions: {
      decisions: [
        {
          title: "dec-1",
          context: "ctx",
          choice: "choice",
          irreversible: false,
          alternatives: [],
          tradeoffs: [],
          implicitAssumptions: [],
          limitations: []
        }
      ]
    },
    cognitiveRisks: {
      likelyErrors: ["risk-a"],
      deceptivePatterns: [],
      implicitCoupling: [],
      invisibleSideEffects: [],
      operationalAssumptions: []
    },
    evidenceIndex: [],
    gaps: []
  };
}

describe("buildKnowledgeDiff", () => {
  it("detects added and removed knowledge items", () => {
    const previous = makeKnowledge();
    const current = makeKnowledge();

    current.domainInvariants.rules.push({
      name: "inv-2",
      description: "d2",
      severity: "important",
      status: "inferred"
    });
    current.conceptualBoundaries.prohibitedRelations = [];
    current.decisions.decisions[0].choice = "updated-choice";
    current.cognitiveRisks.likelyErrors = ["risk-b"];

    const diff = buildKnowledgeDiff(previous, current, "2026-03-01T00:00:00.000Z");

    expect(diff.summary.invariants.added).toBe(1);
    expect(diff.summary.boundaries.prohibited.removed).toBe(1);
    expect(diff.summary.decisions.modified).toBe(1);
    expect(diff.summary.cognitiveRisks.modified).toBeGreaterThan(0);
  });
});
