import { hashJson } from "../../utils/hashing.js";
import type { ConsolidatedKnowledge, KnowledgeDiffSummary } from "../types/index.js";

interface DiffResult<T> {
  added: T[];
  removed: T[];
  modified: Array<{ key: string; before: T; after: T }>;
}

export interface KnowledgeDiffArtifact {
  generatedAt: string;
  previousHash: string | null;
  currentHash: string;
  summary: KnowledgeDiffSummary;
  invariants: DiffResult<ConsolidatedKnowledge["domainInvariants"]["rules"][number]>;
  boundaries: {
    allowed: DiffResult<ConsolidatedKnowledge["conceptualBoundaries"]["allowedRelations"][number]>;
    prohibited: DiffResult<ConsolidatedKnowledge["conceptualBoundaries"]["prohibitedRelations"][number]>;
  };
  decisions: DiffResult<ConsolidatedKnowledge["decisions"]["decisions"][number]>;
  cognitiveRisks: {
    added: string[];
    removed: string[];
    modified: Array<{ category: string; added: string[]; removed: string[] }>;
  };
}

export function buildKnowledgeDiff(
  previousKnowledge: ConsolidatedKnowledge | null,
  currentKnowledge: ConsolidatedKnowledge,
  generatedAt: string
): KnowledgeDiffArtifact {
  const previousHash = previousKnowledge ? hashJson(previousKnowledge) : null;
  const currentHash = hashJson(currentKnowledge);

  const invariants = diffByKey(
    previousKnowledge?.domainInvariants.rules ?? [],
    currentKnowledge.domainInvariants.rules,
    (rule) => rule.name
  );

  const allowedBoundaries = diffByKey(
    previousKnowledge?.conceptualBoundaries.allowedRelations ?? [],
    currentKnowledge.conceptualBoundaries.allowedRelations,
    (relation) => `${relation.from}=>${relation.to}:${relation.type}`
  );

  const prohibitedBoundaries = diffByKey(
    previousKnowledge?.conceptualBoundaries.prohibitedRelations ?? [],
    currentKnowledge.conceptualBoundaries.prohibitedRelations,
    (relation) => `${relation.from}=>${relation.to}:${relation.reason}`
  );

  const decisions = diffByKey(
    previousKnowledge?.decisions.decisions ?? [],
    currentKnowledge.decisions.decisions,
    (decision) => decision.title
  );

  const cognitiveRisks = diffCognitiveRisks(previousKnowledge, currentKnowledge);

  const summary: KnowledgeDiffSummary = {
    changed: previousHash !== currentHash,
    invariants: summarize(invariants),
    boundaries: {
      allowed: summarize(allowedBoundaries),
      prohibited: summarize(prohibitedBoundaries)
    },
    decisions: summarize(decisions),
    cognitiveRisks: {
      added: cognitiveRisks.added.length,
      removed: cognitiveRisks.removed.length,
      modified: cognitiveRisks.modified.length
    }
  };

  return {
    generatedAt,
    previousHash,
    currentHash,
    summary,
    invariants,
    boundaries: {
      allowed: allowedBoundaries,
      prohibited: prohibitedBoundaries
    },
    decisions,
    cognitiveRisks
  };
}

function summarize<T>(diff: DiffResult<T>): { added: number; removed: number; modified: number } {
  return {
    added: diff.added.length,
    removed: diff.removed.length,
    modified: diff.modified.length
  };
}

function diffByKey<T>(previous: T[], current: T[], getKey: (value: T) => string): DiffResult<T> {
  const previousMap = new Map(previous.map((value) => [getKey(value), value]));
  const currentMap = new Map(current.map((value) => [getKey(value), value]));

  const added: T[] = [];
  const removed: T[] = [];
  const modified: Array<{ key: string; before: T; after: T }> = [];

  for (const [key, currentValue] of currentMap.entries()) {
    const previousValue = previousMap.get(key);
    if (!previousValue) {
      added.push(currentValue);
      continue;
    }

    if (hashJson(previousValue) !== hashJson(currentValue)) {
      modified.push({ key, before: previousValue, after: currentValue });
    }
  }

  for (const [key, previousValue] of previousMap.entries()) {
    if (!currentMap.has(key)) {
      removed.push(previousValue);
    }
  }

  return {
    added: added.sort((a, b) => getKey(a).localeCompare(getKey(b))),
    removed: removed.sort((a, b) => getKey(a).localeCompare(getKey(b))),
    modified: modified.sort((a, b) => a.key.localeCompare(b.key))
  };
}

function diffCognitiveRisks(
  previousKnowledge: ConsolidatedKnowledge | null,
  currentKnowledge: ConsolidatedKnowledge
): {
  added: string[];
  removed: string[];
  modified: Array<{ category: string; added: string[]; removed: string[] }>;
} {
  const categories = [
    "likelyErrors",
    "deceptivePatterns",
    "implicitCoupling",
    "invisibleSideEffects",
    "operationalAssumptions"
  ] as const;

  const globalAdded = new Set<string>();
  const globalRemoved = new Set<string>();
  const modified: Array<{ category: string; added: string[]; removed: string[] }> = [];

  for (const category of categories) {
    const previousValues = new Set(previousKnowledge?.cognitiveRisks[category] ?? []);
    const currentValues = new Set(currentKnowledge.cognitiveRisks[category]);

    const added = [...currentValues].filter((item) => !previousValues.has(item)).sort();
    const removed = [...previousValues].filter((item) => !currentValues.has(item)).sort();

    for (const item of added) globalAdded.add(item);
    for (const item of removed) globalRemoved.add(item);

    if (added.length > 0 || removed.length > 0) {
      modified.push({ category, added, removed });
    }
  }

  return {
    added: [...globalAdded].sort(),
    removed: [...globalRemoved].sort(),
    modified: modified.sort((a, b) => a.category.localeCompare(b.category))
  };
}
