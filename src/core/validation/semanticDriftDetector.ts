import type {
  ArchitecturalSignal,
  CodeSample,
  DomainCandidate,
  LLMProviderName,
  SemanticDriftCalibrationItem,
  SemanticDriftReport,
} from "../types/index.js";
import type { LLMProvider } from "../../llm/provider.interface.js";

export interface BaselineSnapshot {
  provider: Exclude<LLMProviderName, "none">;
  model: string;
  calibration: SemanticDriftCalibrationItem[];
  acceptedAt: string;
}

export interface BaselineRegistry {
  activeKey?: string;
  baselines: Record<string, BaselineSnapshot>;
}

interface CalibrationResponse {
  hypotheses?: Array<{ category?: string; statement?: string }>;
}

export class SemanticDriftDetector {
  constructor(private readonly threshold: number) {}

  async detect(params: {
    provider: LLMProvider;
    providerName: Exclude<LLMProviderName, "none">;
    modelName: string;
    previous?: SemanticDriftReport;
    baseline?: BaselineSnapshot;
    signals: ArchitecturalSignal[];
    samples: CodeSample[];
    domainCandidates: DomainCandidate[];
  }): Promise<{ report: SemanticDriftReport; calibration: SemanticDriftCalibrationItem[] }> {
    const calibration = await this.runCalibration(
      params.provider,
      params.signals,
      params.samples,
      params.domainCandidates
    );

    const reference = params.baseline?.calibration ?? [];
    const comparison = buildComparison(reference, calibration);
    const shouldRequireAction = comparison.driftScore > this.threshold;

    const report: SemanticDriftReport = {
      provider: params.providerName,
      model: params.modelName,
      previousProvider: params.previous?.provider,
      previousModel: params.previous?.model,
      diffSummary: comparison.diffSummary,
      driftScore: comparison.driftScore,
      actionRequired: shouldRequireAction,
      generatedAt: new Date().toISOString()
    };

    return { report, calibration };
  }

  async runCalibration(
    provider: LLMProvider,
    signals: ArchitecturalSignal[],
    samples: CodeSample[],
    domainCandidates: DomainCandidate[]
  ): Promise<SemanticDriftCalibrationItem[]> {
    const requestPayload = {
      signals: signals.slice(0, 8).map((signal) => ({
        type: signal.type,
        description: signal.description
      })),
      samples: samples.slice(0, 4).map((sample) => ({
        path: sample.path,
        reason: sample.reason,
        content: sample.content.slice(0, 500)
      })),
      domainCandidates: domainCandidates.slice(0, 20).map((candidate) => ({
        name: candidate.name,
        kind: candidate.kind,
        filePath: candidate.filePath
      }))
    };

    const response = await provider.chat({
      messages: [
        {
          role: "system",
          content:
            "You generate deterministic architecture calibration output. Return strict JSON only in the format {\"hypotheses\":[{\"category\":\"domain|boundary|decision|risk|invariant|ontology\",\"statement\":\"...\"}]}. Include at most 6 concise hypotheses."
        },
        {
          role: "user",
          content: JSON.stringify(requestPayload)
        }
      ],
      temperature: 0,
      jsonMode: true,
      maxOutputTokens: 800
    });

    const parsed = JSON.parse(extractJson(response.content)) as CalibrationResponse;
    const normalized = (parsed.hypotheses ?? [])
      .map((item) => normalizeCalibrationItem(item.category, item.statement))
      .filter((item): item is SemanticDriftCalibrationItem => item !== null)
      .slice(0, 6)
      .sort((a, b) => `${a.category}:${a.statement}`.localeCompare(`${b.category}:${b.statement}`));

    return normalized;
  }
}

export function toBaselineSnapshot(
  provider: Exclude<LLMProviderName, "none">,
  model: string,
  calibration: SemanticDriftCalibrationItem[]
): BaselineSnapshot {
  return {
    provider,
    model,
    calibration,
    acceptedAt: new Date().toISOString()
  };
}

export function shouldRunSemanticDriftCheck(
  previous: SemanticDriftReport | null,
  provider: Exclude<LLMProviderName, "none">,
  model: string
): boolean {
  if (!previous) return true;
  return previous.provider !== provider || previous.model !== model;
}

function buildComparison(
  reference: SemanticDriftCalibrationItem[],
  current: SemanticDriftCalibrationItem[]
): { driftScore: number; diffSummary: string[] } {
  if (reference.length === 0) {
    return {
      driftScore: 0,
      diffSummary: ["No previous baseline found; baseline initialized from current calibration."]
    };
  }

  const referenceSet = new Set(reference.map((item) => `${item.category}|${item.statement}`));
  const currentSet = new Set(current.map((item) => `${item.category}|${item.statement}`));

  const added = [...currentSet].filter((item) => !referenceSet.has(item));
  const removed = [...referenceSet].filter((item) => !currentSet.has(item));
  const union = new Set([...referenceSet, ...currentSet]);
  const weightedUnion = [...union].reduce((sum, key) => sum + weightForItemKey(key), 0);
  const weightedIntersection = [...referenceSet]
    .filter((item) => currentSet.has(item))
    .reduce((sum, key) => sum + weightForItemKey(key), 0);
  const driftScore = weightedUnion === 0 ? 0 : 1 - weightedIntersection / weightedUnion;

  const diffSummary = [
    `Calibration changed: +${added.length} / -${removed.length} / baseline=${reference.length} / current=${current.length}`
  ];

  if (added.length > 0) {
    diffSummary.push(`Added: ${added.slice(0, 3).join("; ")}${added.length > 3 ? "…" : ""}`);
  }
  if (removed.length > 0) {
    diffSummary.push(`Removed: ${removed.slice(0, 3).join("; ")}${removed.length > 3 ? "…" : ""}`);
  }

  return { driftScore: Number(driftScore.toFixed(3)), diffSummary };
}

function extractJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const cleaned = fenceMatch ? fenceMatch[1].trim() : text;
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Calibration response did not contain valid JSON");
  }

  return cleaned.slice(start, end + 1);
}

function normalizeCalibrationItem(category?: string, statement?: string): SemanticDriftCalibrationItem | null {
  if (!category || !statement) return null;
  const normalizedStatement = statement.trim().replace(/\s+/g, " ");
  if (!normalizedStatement) return null;

  const normalizedCategory = category.trim().toLowerCase();
  const validCategories = new Set(["ontology", "domain", "boundary", "decision", "risk", "invariant"]);
  if (!validCategories.has(normalizedCategory)) {
    return null;
  }

  return {
    category: normalizedCategory as SemanticDriftCalibrationItem["category"],
    statement: normalizedStatement
  };
}

function weightForItemKey(itemKey: string): number {
  const [category] = itemKey.split("|", 1);
  if (!category) return 1;

  const weights: Record<string, number> = {
    invariant: 1.25,
    boundary: 1.15,
    ontology: 1.1,
    decision: 1,
    domain: 0.95,
    risk: 0.85
  };

  return weights[category] ?? 1;
}

export function baselineKey(provider: Exclude<LLMProviderName, "none">, model: string): string {
  return `${provider}:${model}`;
}
