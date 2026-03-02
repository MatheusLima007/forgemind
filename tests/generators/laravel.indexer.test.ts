import { describe, expect, it } from "vitest";
import { DocumentGenerator } from "../../src/core/generators/documents/documentGenerator.js";
import type { ConsolidatedKnowledge, EvidenceEntry, LLMRequest, ScanResult } from "../../src/core/types/index.js";

class CaptureProvider {
  public lastRequest: LLMRequest | null = null;
  async chat(request: LLMRequest) {
    this.lastRequest = request;
    return {
      content: "# module boundaries",
      metadata: { provider: "openai", model: "mock" }
    };
  }
}

const scan: ScanResult = {
  rootPath: "/tmp/repo",
  languages: ["php"],
  frameworks: ["laravel"],
  configFilesFound: ["composer.json"],
  dependencies: { configFiles: ["composer.json"], dependencies: ["laravel/framework"], ecosystemHints: ["php"] },
  signals: ["laravel-project"],
  scannedAt: new Date().toISOString()
};

const knowledge: ConsolidatedKnowledge = {
  systemOntology: { corePurpose: "p", mentalModel: "m", centralConcepts: [], systemOrientation: "o", principles: [] },
  domainInvariants: { rules: [], validStates: [], invalidStates: [], constraints: [] },
  conceptualBoundaries: { contexts: [], allowedRelations: [], prohibitedRelations: [], dangerousInteractions: [] },
  decisions: { decisions: [] },
  cognitiveRisks: { likelyErrors: [], deceptivePatterns: [], implicitCoupling: [], invisibleSideEffects: [], operationalAssumptions: [] },
  evidenceIndex: [],
  gaps: []
};

const evidenceMap: EvidenceEntry[] = [
  { claimId: "b1", claimType: "boundary", summary: "boundary", evidence: [], confidence: "confirmed", agentImpact: "high" },
  { claimId: "d1", claimType: "domain", summary: "domain", evidence: [], confidence: "inferred", agentImpact: "med" }
];

describe("laravel indexer migrated coverage", () => {
  it("module-boundaries document payload prioritizes boundary claims", async () => {
    const provider = new CaptureProvider();
    const generator = new DocumentGenerator(provider as never);

    await generator.generate("module-boundaries", knowledge, scan, evidenceMap);

    const payload = JSON.parse(provider.lastRequest?.messages[1].content ?? "{}");
    expect(Array.isArray(payload.claims)).toBe(true);
    expect(payload.claims).toHaveLength(1);
    expect(payload.claims[0].claimType).toBe("boundary");
  });
});
