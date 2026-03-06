import { describe, expect, it } from "vitest";
import { ContradictionEngine } from "../../src/core/validation/contradictionEngine.js";
import type { ConsolidatedKnowledge, Hypothesis, StructuredAnswer } from "../../src/core/types/index.js";

function baseKnowledge(): ConsolidatedKnowledge {
  return {
    systemOntology: {
      corePurpose: "test",
      mentalModel: "test",
      centralConcepts: [],
      systemOrientation: "test",
      principles: [],
    },
    domainInvariants: {
      rules: [
        {
          name: "No direct API to DB",
          description: "API must not access DB directly",
          severity: "critical",
          status: "confirmed"
        }
      ],
      validStates: [],
      invalidStates: [],
      constraints: [],
    },
    conceptualBoundaries: {
      contexts: [],
      allowedRelations: [{ from: "API", to: "DB", type: "call" }],
      prohibitedRelations: [],
      dangerousInteractions: [],
    },
    decisions: {
      decisions: [
        {
          title: "Direct Writes",
          context: "performance",
          choice: "Agents are allowed to write directly to DB",
          irreversible: false,
          alternatives: [],
          tradeoffs: [],
          implicitAssumptions: [],
          limitations: []
        }
      ]
    },
    cognitiveRisks: {
      likelyErrors: [],
      deceptivePatterns: [],
      implicitCoupling: [],
      invisibleSideEffects: [],
      operationalAssumptions: [],
    },
    evidenceIndex: [],
    gaps: [],
  };
}

describe("ContradictionEngine", () => {
  it("detects contradictions and generates interview questions", () => {
    const engine = new ContradictionEngine();

    const hypotheses: Hypothesis[] = [
      {
        id: "hyp-1",
        category: "invariant",
        statement: "Approval is mandatory",
        confidence: 0.7,
        evidenceRefs: [],
        evidence: [],
        needsConfirmation: true,
        status: "confirmed"
      }
    ];

    const answers: StructuredAnswer[] = [
      {
        questionId: "q-1",
        answer: "No, this is not true for this repository",
        source: "custom",
        timestamp: new Date().toISOString()
      }
    ];

    const report = engine.analyze({
      hypotheses,
      answers,
      questionToHypotheses: new Map([["q-1", ["hyp-1"]]]),
      knowledge: baseKnowledge(),
      operatingManual: "- Never write directly to DB from agents"
    });

    expect(report.total).toBeGreaterThan(0);
    expect(report.byType["answer-hypothesis"]).toBeGreaterThan(0);
    expect(report.byType["boundary-invariant"]).toBeGreaterThan(0);
    expect(report.byType["decision-operating-manual"]).toBeGreaterThan(0);
    expect(report.interviewQuestions.length).toBe(report.total);
    expect(report.downgradedHypotheses).toContain("hyp-1");
    expect(hypotheses[0].status).toBe("needs-review");
  });
});
