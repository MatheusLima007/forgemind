import { describe, expect, it } from "vitest";
import { ConsistencyChecker } from "../../src/core/enforcement/consistencyChecker.js";
import type { ConsolidatedKnowledge } from "../../src/core/types/index.js";

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
      rules: [],
      validStates: [],
      invalidStates: [],
      constraints: [],
    },
    conceptualBoundaries: {
      contexts: [],
      allowedRelations: [],
      prohibitedRelations: [],
      dangerousInteractions: [],
    },
    decisions: { decisions: [] },
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

describe("ConsistencyChecker", () => {
  it("returns no issues for clean knowledge", () => {
    const checker = new ConsistencyChecker();
    const issues = checker.check(baseKnowledge());
    expect(issues).toHaveLength(0);
  });

  it("detects boundary contradiction (same pair allowed and prohibited)", () => {
    const knowledge = baseKnowledge();
    knowledge.conceptualBoundaries.allowedRelations = [
      { from: "core", to: "llm", type: "optional" },
    ];
    knowledge.conceptualBoundaries.prohibitedRelations = [
      { from: "core", to: "llm", reason: "direct coupling not allowed" },
    ];

    const checker = new ConsistencyChecker();
    const issues = checker.check(knowledge);

    expect(issues.length).toBeGreaterThanOrEqual(1);
    const contradiction = issues.find((i) => i.type === "boundary-contradiction");
    expect(contradiction).toBeDefined();
    expect(contradiction?.description).toMatch(/core.*llm/i);
    expect(contradiction?.suggestedQuestion).toMatch(/allowed or prohibited/i);
  });

  it("detects duplicate invariant rule names", () => {
    const knowledge = baseKnowledge();
    knowledge.domainInvariants.rules = [
      { name: "No direct DB access", description: "...", severity: "critical", status: "confirmed" },
      { name: "No direct DB access", description: "duplicate", severity: "important", status: "inferred" },
    ];

    const checker = new ConsistencyChecker();
    const issues = checker.check(knowledge);

    const dup = issues.find((i) => i.type === "duplicate-rule");
    expect(dup).toBeDefined();
    expect(dup?.description).toMatch(/2 times/i);
  });

  it("generates a suggested question for boundary contradictions", () => {
    const knowledge = baseKnowledge();
    knowledge.conceptualBoundaries.allowedRelations = [
      { from: "scanner", to: "core", type: "read" },
    ];
    knowledge.conceptualBoundaries.prohibitedRelations = [
      { from: "scanner", to: "core", reason: "violates layer isolation" },
    ];

    const checker = new ConsistencyChecker();
    const issues = checker.check(knowledge);

    expect(issues[0]?.suggestedQuestion).toBeDefined();
    expect(issues[0].suggestedQuestion).toContain("scanner");
  });

  it("returns empty for allowed relations with no conflicts", () => {
    const knowledge = baseKnowledge();
    knowledge.conceptualBoundaries.allowedRelations = [
      { from: "cli", to: "core", type: "call" },
    ];
    knowledge.conceptualBoundaries.prohibitedRelations = [
      { from: "llm", to: "scanner", reason: "wrong direction" },
    ];

    const checker = new ConsistencyChecker();
    const issues = checker.check(knowledge);
    expect(issues.filter((i) => i.type === "boundary-contradiction")).toHaveLength(0);
  });
});
