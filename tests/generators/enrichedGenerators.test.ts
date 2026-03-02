import { describe, expect, it } from "vitest";
import { DocumentGenerator, type DocumentType } from "../../src/core/generators/documents/documentGenerator.js";
import { RedundancyFilter } from "../../src/core/generators/documents/redundancyFilter.js";
import type { ConsolidatedKnowledge, EvidenceEntry, LLMRequest, ScanResult } from "../../src/core/types/index.js";

class CapturingProvider {
  public readonly requests: LLMRequest[] = [];

  constructor(private readonly responseText: string) {}

  async chat(request: LLMRequest) {
    this.requests.push(request);
    return {
      content: this.responseText,
      metadata: { provider: "openai", model: "mock" }
    };
  }
}

function makeScan(): ScanResult {
  return {
    rootPath: "/tmp/repo",
    languages: ["typescript"],
    frameworks: ["nestjs"],
    configFilesFound: ["package.json"],
    dependencies: {
      configFiles: ["package.json"],
      dependencies: ["@nestjs/core"],
      ecosystemHints: ["node"]
    },
    signals: ["node-project"],
    scannedAt: new Date().toISOString()
  };
}

function makeKnowledge(): ConsolidatedKnowledge {
  return {
    systemOntology: {
      corePurpose: "purpose",
      mentalModel: "model",
      centralConcepts: ["concept"],
      systemOrientation: "orientation",
      principles: ["principle"]
    },
    domainInvariants: {
      rules: [{ name: "inv", description: "desc", severity: "critical", status: "confirmed" }],
      validStates: [],
      invalidStates: [],
      constraints: []
    },
    conceptualBoundaries: {
      contexts: [{ name: "app", responsibility: "resp", responsibilities: ["a"], risks: [] }],
      allowedRelations: [{ from: "app", to: "db", type: "sync" }],
      prohibitedRelations: [{ from: "ui", to: "db", reason: "policy" }],
      dangerousInteractions: []
    },
    decisions: {
      decisions: [
        {
          title: "dec",
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
      likelyErrors: ["risk"],
      deceptivePatterns: [],
      implicitCoupling: [],
      invisibleSideEffects: [],
      operationalAssumptions: []
    },
    evidenceIndex: [],
    gaps: []
  };
}

function makeEvidence(): EvidenceEntry[] {
  return [
    { claimId: "c1", claimType: "ontology", summary: "onto", evidence: [], confidence: "inferred", agentImpact: "m" },
    { claimId: "c2", claimType: "boundary", summary: "bound", evidence: [], confidence: "confirmed", agentImpact: "h" }
  ];
}

describe("enriched generators (current architecture)", () => {
  it("generates all document types and strips markdown fences", async () => {
    const provider = new CapturingProvider("```markdown\n# Title\n\nBody\n```");
    const generator = new DocumentGenerator(provider as never);

    const docs = await generator.generateAll(makeKnowledge(), makeScan(), makeEvidence());

    expect(docs.size).toBe(5);
    for (const value of docs.values()) {
      expect(value).toBe("# Title\n\nBody\n");
    }
  });

  it("runs redundancy filter for all documents", async () => {
    const provider = new CapturingProvider("```markdown\n# Clean\n```\n");
    const filter = new RedundancyFilter(provider as never);

    const input = new Map<string, string>([
      ["system-ontology", "# A"],
      ["domain-invariants", "# B"]
    ]);

    const result = await filter.filterAll(input);

    expect(result.get("system-ontology")).toBe("# Clean\n");
    expect(result.get("domain-invariants")).toBe("# Clean\n");
    expect(provider.requests).toHaveLength(2);
  });
});
