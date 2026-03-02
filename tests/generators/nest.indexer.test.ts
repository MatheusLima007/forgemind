import { describe, expect, it } from "vitest";
import { DocumentGenerator } from "../../src/core/generators/documents/documentGenerator.js";
import type { ConsolidatedKnowledge, EvidenceEntry, LLMRequest, ScanResult } from "../../src/core/types/index.js";

class CaptureProvider {
  public lastRequest: LLMRequest | null = null;
  async chat(request: LLMRequest) {
    this.lastRequest = request;
    return {
      content: "# agent manual",
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
  systemOntology: { corePurpose: "p", mentalModel: "m", centralConcepts: [], systemOrientation: "o", principles: [] },
  domainInvariants: {
    rules: [
      { name: "critical-rule", description: "d", severity: "critical", status: "confirmed" },
      { name: "info-rule", description: "d", severity: "important", status: "inferred" }
    ],
    validStates: [],
    invalidStates: [],
    constraints: []
  },
  conceptualBoundaries: { contexts: [], allowedRelations: [], prohibitedRelations: [], dangerousInteractions: [] },
  decisions: { decisions: [] },
  cognitiveRisks: { likelyErrors: ["risk"], deceptivePatterns: [], implicitCoupling: [], invisibleSideEffects: [], operationalAssumptions: [] },
  evidenceIndex: [],
  gaps: ["gap-1"]
};

const evidenceMap: EvidenceEntry[] = [
  { claimId: "r1", claimType: "risk", summary: "risk", evidence: [], confidence: "confirmed", agentImpact: "high" }
];

describe("nest indexer migrated coverage", () => {
  it("agent-operating-manual payload includes critical invariants and risks", async () => {
    const provider = new CaptureProvider();
    const generator = new DocumentGenerator(provider as never);

    await generator.generate("agent-operating-manual", knowledge, scan, evidenceMap);

    const payload = JSON.parse(provider.lastRequest?.messages[1].content ?? "{}");
    expect(Array.isArray(payload.criticalInvariants)).toBe(true);
    expect(payload.criticalInvariants).toHaveLength(1);
    expect(payload.cognitiveRisks.likelyErrors).toContain("risk");
    expect(payload.gaps).toContain("gap-1");
  });
});
