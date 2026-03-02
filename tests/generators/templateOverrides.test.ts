import { describe, expect, it } from "vitest";
import { DocumentGenerator } from "../../src/core/generators/documents/documentGenerator.js";
import type { ConsolidatedKnowledge, EvidenceEntry, LLMRequest, ScanResult } from "../../src/core/types/index.js";

class FenceProvider {
  constructor(private readonly content: string) {}

  async chat(_request: LLMRequest) {
    return {
      content: this.content,
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
  domainInvariants: { rules: [], validStates: [], invalidStates: [], constraints: [] },
  conceptualBoundaries: { contexts: [], allowedRelations: [], prohibitedRelations: [], dangerousInteractions: [] },
  decisions: { decisions: [] },
  cognitiveRisks: { likelyErrors: [], deceptivePatterns: [], implicitCoupling: [], invisibleSideEffects: [], operationalAssumptions: [] },
  evidenceIndex: [],
  gaps: []
};

const evidenceMap: EvidenceEntry[] = [];

describe("template overrides migrated coverage", () => {
  it("strips markdown fences from provider output", async () => {
    const generator = new DocumentGenerator(new FenceProvider("```markdown\n# Custom\n\nBody\n```") as never);
    const content = await generator.generate("decision-log", knowledge, scan, evidenceMap);

    expect(content).toBe("# Custom\n\nBody\n");
  });

  it("normalizes plain markdown with trailing newline", async () => {
    const generator = new DocumentGenerator(new FenceProvider("# Plain") as never);
    const content = await generator.generate("decision-log", knowledge, scan, evidenceMap);

    expect(content).toBe("# Plain\n");
  });
});
