import { describe, expect, it } from "vitest";
import { rankDomainCandidates, rankHypotheses } from "../../src/core/intelligence/relevanceRanker.js";
import type { DomainCandidate, Hypothesis } from "../../src/core/types/index.js";

describe("relevanceRanker", () => {
  it("applies top-K per kind for domain candidates with deterministic order", () => {
    const candidates: DomainCandidate[] = [
      { name: "A", kind: "entity", source: "symbol", filePath: "src/a.ts", symbol: "A" },
      { name: "B", kind: "entity", source: "filename", filePath: "src/b.ts" },
      { name: "C", kind: "entity", source: "symbol", filePath: "src/c.ts", symbol: "C" },
      { name: "InvariantOne", kind: "invariant", source: "validation-patterns", filePath: "src/rule.ts" },
      { name: "InvariantTwo", kind: "invariant", source: "filename", filePath: "src/rule2.ts" }
    ];

    const ranked = rankDomainCandidates(candidates, 2);

    expect(ranked.filter((candidate) => candidate.kind === "entity")).toHaveLength(2);
    expect(ranked.filter((candidate) => candidate.kind === "invariant")).toHaveLength(2);
    expect(ranked.map((candidate) => `${candidate.kind}:${candidate.name}`)).toEqual([
      "entity:A",
      "entity:C",
      "invariant:InvariantOne",
      "invariant:InvariantTwo"
    ]);
  });

  it("applies top-K per category for hypotheses and keeps stable ordering", () => {
    const hypotheses: Hypothesis[] = [
      {
        id: "h2",
        category: "boundary",
        statement: "boundary low",
        confidence: 0.6,
        evidenceRefs: [],
        evidence: [],
        needsConfirmation: true,
        status: "pending"
      },
      {
        id: "h1",
        category: "boundary",
        statement: "boundary high",
        confidence: 0.9,
        evidenceRefs: [{ path: "src/mod.ts" }],
        evidence: [],
        needsConfirmation: false,
        status: "confirmed"
      },
      {
        id: "h4",
        category: "decision",
        statement: "decision low",
        confidence: 0.4,
        evidenceRefs: [],
        evidence: [],
        needsConfirmation: true,
        status: "pending"
      },
      {
        id: "h3",
        category: "decision",
        statement: "decision high",
        confidence: 0.8,
        evidenceRefs: [{ path: "src/decision.ts" }],
        evidence: [],
        needsConfirmation: false,
        status: "confirmed"
      }
    ];

    const ranked = rankHypotheses(hypotheses, 1);

    expect(ranked).toHaveLength(2);
    expect(ranked.map((hypothesis) => hypothesis.id)).toEqual(["h1", "h3"]);
  });
});
