import { describe, expect, it } from "vitest";
import { EvidenceMapGenerator } from "../../src/core/mining/evidenceMapGenerator.js";
import type { ArchitecturalSignal, CodeSample, DomainCandidate, Hypothesis, LLMRequest, ScanResult } from "../../src/core/types/index.js";
import type { LLMProvider } from "../../src/llm/provider.interface.js";

class MockProvider {
  async chat(_request: LLMRequest) {
    return {
      content: JSON.stringify({
        entries: [
          {
            claimId: "hyp-1",
            claimType: "invariant",
            summary: "Orders must be approved before shipping",
            evidence: [],
            confidence: "confirmed",
            agentImpact: "Prevents invalid state transitions"
          }
        ]
      }),
      metadata: {
        provider: "gemini",
        model: "mock"
      }
    };
  }
}

const scan: ScanResult = {
  rootPath: ".",
  languages: ["typescript"],
  frameworks: ["unknown"],
  configFilesFound: [],
  dependencies: { configFiles: [], dependencies: [], ecosystemHints: [] },
  signals: [],
  scannedAt: new Date().toISOString()
};

const hypotheses: Hypothesis[] = [
  {
    id: "hyp-1",
    category: "invariant",
    statement: "Orders must be approved before shipping",
    confidence: 0.8,
    evidenceRefs: [],
    evidence: [],
    needsConfirmation: true,
    status: "pending"
  }
];

const signals: ArchitecturalSignal[] = [];
const samples: CodeSample[] = [];
const candidates: DomainCandidate[] = [];

describe("EvidenceMapGenerator", () => {
  it("downgrades confidence to unknown when claim has no evidence", async () => {
    const generator = new EvidenceMapGenerator(new MockProvider() as unknown as LLMProvider);
    const entries = await generator.generate(scan, hypotheses, signals, samples, candidates);

    expect(entries).toHaveLength(1);
    expect(entries[0].claimId).toBe("hyp-1");
    expect(entries[0].confidence).toBe("unknown");
  });
});
