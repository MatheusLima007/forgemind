import { describe, expect, it } from "vitest";
import { DocumentGenerator } from "../../src/core/generators/documents/documentGenerator.js";
import type { ConsolidatedKnowledge, EvidenceEntry, LLMRequest, ScanResult } from "../../src/core/types/index.js";

class CaptureProvider {
  public lastRequest: LLMRequest | null = null;
  async chat(request: LLMRequest) {
    this.lastRequest = request;
    return {
      content: "# ontology",
      metadata: { provider: "openai", model: "mock" }
    };
  }
}

const scan: ScanResult = {
  rootPath: "/tmp/repo",
  languages: ["typescript"],
  frameworks: ["nestjs"],
  configFilesFound: ["package.json"],
  dependencies: { configFiles: ["package.json"], dependencies: ["@nestjs/core"], ecosystemHints: ["node"] },
  signals: ["nestjs-project"],
  scannedAt: new Date().toISOString()
};

const knowledge: ConsolidatedKnowledge = {
  systemOntology: { corePurpose: "purpose", mentalModel: "model", centralConcepts: ["a"], systemOrientation: "orientation", principles: ["p"] },
  domainInvariants: { rules: [], validStates: [], invalidStates: [], constraints: [] },
  conceptualBoundaries: { contexts: [], allowedRelations: [], prohibitedRelations: [], dangerousInteractions: [] },
  decisions: {
    decisions: [
      { title: "d1", context: "c1", choice: "x", irreversible: false, alternatives: [], tradeoffs: [], implicitAssumptions: [], limitations: [] },
      { title: "d2", context: "c2", choice: "y", irreversible: false, alternatives: [], tradeoffs: [], implicitAssumptions: [], limitations: [] }
    ]
  },
  cognitiveRisks: { likelyErrors: [], deceptivePatterns: [], implicitCoupling: [], invisibleSideEffects: [], operationalAssumptions: [] },
  evidenceIndex: [],
  gaps: []
};

const evidenceMap: EvidenceEntry[] = [
  { claimId: "o1", claimType: "ontology", summary: "onto", evidence: [], confidence: "confirmed", agentImpact: "high" }
];

describe("profile generator migrated coverage", () => {
  it("system-ontology payload includes ontology and relevant decisions", async () => {
    const provider = new CaptureProvider();
    const generator = new DocumentGenerator(provider as never);

    await generator.generate("system-ontology", knowledge, scan, evidenceMap);

    const payload = JSON.parse(provider.lastRequest?.messages[1].content ?? "{}");
    expect(payload.systemOntology.corePurpose).toBe("purpose");
    expect(Array.isArray(payload.relevantDecisions)).toBe(true);
    expect(payload.relevantDecisions).toHaveLength(2);
  });
});
