import type { DomainCandidate, Hypothesis } from "../types/index.js";

const DEFAULT_TOP_K_DOMAIN_PER_KIND = 40;
const DEFAULT_TOP_K_HYPOTHESIS_PER_CATEGORY = 12;

function scoreDomainCandidate(candidate: DomainCandidate): number {
  let score = 0;
  if (candidate.source === "symbol") score += 4;
  if (candidate.source === "validation-patterns") score += 3;
  if (candidate.kind === "invariant") score += 4;
  if (candidate.kind === "workflow") score += 3;
  if (candidate.kind === "entity") score += 2;
  if (candidate.symbol) score += 1;
  if (candidate.lines) score += 1;
  return score;
}

function scoreHypothesis(hypothesis: Hypothesis): number {
  let score = 0;
  score += hypothesis.confidence * 100;
  score += hypothesis.evidenceRefs.length * 6;
  score += hypothesis.evidence.length * 4;
  if (!hypothesis.needsConfirmation) score += 5;
  if (hypothesis.status === "confirmed") score += 10;
  return score;
}

function stableSortByScore<T>(
  items: T[],
  scoreFn: (item: T) => number,
  tieBreakerFn: (item: T) => string
): T[] {
  return [...items].sort((left, right) => {
    const scoreDiff = scoreFn(right) - scoreFn(left);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return tieBreakerFn(left).localeCompare(tieBreakerFn(right));
  });
}

export function rankDomainCandidates(
  candidates: DomainCandidate[],
  topKPerKind = DEFAULT_TOP_K_DOMAIN_PER_KIND
): DomainCandidate[] {
  const byKind = new Map<DomainCandidate["kind"], DomainCandidate[]>();
  for (const candidate of candidates) {
    const bucket = byKind.get(candidate.kind) ?? [];
    bucket.push(candidate);
    byKind.set(candidate.kind, bucket);
  }

  const ranked = [...byKind.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([, bucket]) => {
      const sorted = stableSortByScore(
        bucket,
        scoreDomainCandidate,
        (candidate) => `${candidate.filePath}|${candidate.name}|${candidate.symbol ?? ""}`
      );
      return sorted.slice(0, Math.max(topKPerKind, 1));
    });

  return ranked.sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind.localeCompare(right.kind);
    }
    return left.name.localeCompare(right.name);
  });
}

export function rankHypotheses(
  hypotheses: Hypothesis[],
  topKPerCategory = DEFAULT_TOP_K_HYPOTHESIS_PER_CATEGORY
): Hypothesis[] {
  const byCategory = new Map<Hypothesis["category"], Hypothesis[]>();
  for (const hypothesis of hypotheses) {
    const bucket = byCategory.get(hypothesis.category) ?? [];
    bucket.push(hypothesis);
    byCategory.set(hypothesis.category, bucket);
  }

  const ranked = [...byCategory.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([, bucket]) => {
      const sorted = stableSortByScore(
        bucket,
        scoreHypothesis,
        (hypothesis) => `${hypothesis.id}|${hypothesis.statement}`
      );
      return sorted.slice(0, Math.max(topKPerCategory, 1));
    });

  return ranked.sort((left, right) => {
    if (left.category !== right.category) {
      return left.category.localeCompare(right.category);
    }
    return left.id.localeCompare(right.id);
  });
}
