import type {
  ArchitecturalSignal,
  CodeSample,
  DomainCandidate,
  EvidenceEntry,
  Hypothesis,
  LLMRequest,
  ScanResult,
} from "../types/index.js";
import type { LLMProvider } from "../../llm/provider.interface.js";
import { EVIDENCE_MAP_SYSTEM_PROMPT } from "../intelligence/prompts/hypothesisPrompts.js";

export class EvidenceMapGenerator {
  constructor(private readonly provider: LLMProvider) {}

  async generate(
    scan: ScanResult,
    hypotheses: Hypothesis[],
    signals: ArchitecturalSignal[],
    samples: CodeSample[],
    domainCandidates: DomainCandidate[]
  ): Promise<EvidenceEntry[]> {
    const request: LLMRequest = {
      messages: [
        { role: "system", content: EVIDENCE_MAP_SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            project: {
              languages: scan.languages,
              frameworks: scan.frameworks,
              configFilesFound: scan.configFilesFound,
              signals: scan.signals
            },
            hypotheses: hypotheses.map((hypothesis) => ({
              id: hypothesis.id,
              category: hypothesis.category,
              statement: hypothesis.statement,
              confidence: hypothesis.confidence,
              evidenceRefs: hypothesis.evidenceRefs,
              signalEvidence: hypothesis.evidence.map((signal) => ({
                type: signal.type,
                source: signal.source,
                description: signal.description,
                evidence: signal.evidence
              }))
            })),
            architecturalSignals: signals.map((signal) => ({
              type: signal.type,
              source: signal.source,
              confidence: signal.confidence,
              description: signal.description,
              evidence: signal.evidence
            })),
            codeSamples: samples.map((sample) => ({
              path: sample.path,
              category: sample.category,
              reason: sample.reason,
              content: sample.content
            })),
            domainCandidates
          }, null, 2)
        }
      ],
      temperature: 0.2,
      jsonMode: true
    };

    const response = await this.provider.chat(request);
    return this.parseEntries(response.content);
  }

  private parseEntries(content: string): EvidenceEntry[] {
    try {
      const parsed = JSON.parse(this.extractJson(content)) as { entries?: unknown[]; evidenceMap?: unknown[] };
      const rawEntries = Array.isArray(parsed.entries)
        ? parsed.entries
        : Array.isArray(parsed.evidenceMap)
          ? parsed.evidenceMap
          : [];

      return rawEntries.map((entry, index) => this.normalizeEntry(entry, index));
    } catch (error) {
      throw new Error(`Failed to parse evidence map: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private normalizeEntry(raw: unknown, index: number): EvidenceEntry {
    const data = raw as Record<string, unknown>;
    const validClaimTypes = ["ontology", "domain", "boundary", "decision", "risk", "invariant"];
    const validConfidence = ["confirmed", "inferred", "unknown"];

    const claimType = validClaimTypes.includes(String(data.claimType))
      ? (data.claimType as EvidenceEntry["claimType"])
      : "domain";

    const mappedConfidence = validConfidence.includes(String(data.confidence).toLowerCase())
      ? (String(data.confidence).toLowerCase() as EvidenceEntry["confidence"])
      : "unknown";

    const evidence = Array.isArray(data.evidence)
      ? data.evidence.map((item) => {
          const value = item as Record<string, unknown>;
          return {
            path: String(value.path ?? ""),
            symbol: value.symbol ? String(value.symbol) : undefined,
            lines: value.lines ? String(value.lines) : undefined,
          };
        }).filter((item) => item.path.length > 0)
      : [];

    const confidence = evidence.length === 0 ? "unknown" : mappedConfidence;

    return {
      claimId: String(data.claimId ?? `claim-${index + 1}`),
      claimType,
      summary: String(data.summary ?? ""),
      evidence,
      confidence,
      agentImpact: String(data.agentImpact ?? "")
    };
  }

  private extractJson(text: string): string {
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const cleaned = fenceMatch ? fenceMatch[1].trim() : text;

    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Response did not contain valid JSON");
    }

    return cleaned.slice(start, end + 1);
  }
}
