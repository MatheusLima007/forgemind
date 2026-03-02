import type { ArchitecturalSignal, CodeSample, DomainCandidate, Hypothesis, LLMRequest, ScanResult } from "../types/index.js";
import type { LLMProvider } from "../../llm/provider.interface.js";
import { HYPOTHESIS_SYSTEM_PROMPT } from "./prompts/hypothesisPrompts.js";

export class HypothesisEngine {
  constructor(private readonly provider: LLMProvider) {}

  async generateHypotheses(
    scan: ScanResult,
    signals: ArchitecturalSignal[],
    samples: CodeSample[],
    domainCandidates: DomainCandidate[]
  ): Promise<Hypothesis[]> {
    const userPrompt = this.buildUserPrompt(scan, signals, samples, domainCandidates);

    const request: LLMRequest = {
      messages: [
        { role: "system", content: HYPOTHESIS_SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
      jsonMode: true
    };

    const response = await this.provider.chat(request);
    return this.parseHypotheses(response.content);
  }

  private buildUserPrompt(
    scan: ScanResult,
    signals: ArchitecturalSignal[],
    samples: CodeSample[],
    domainCandidates: DomainCandidate[]
  ): string {
    const projectContext = {
      languages: scan.languages,
      frameworks: scan.frameworks,
      configFilesFound: scan.configFilesFound,
      dependencies: scan.dependencies.dependencies.slice(0, 80),
      ecosystemHints: scan.dependencies.ecosystemHints,
      projectSignals: scan.signals,
      architecturalSignals: signals.map((s) => ({
        type: s.type,
        confidence: s.confidence,
        description: s.description,
        evidence: s.evidence.slice(0, 5)
      })),
      codeSamples: samples.map((s) => ({
        path: s.path,
        category: s.category,
        reason: s.reason,
        content: s.content
      })),
      domainCandidates: domainCandidates.slice(0, 200)
    };

    return JSON.stringify(projectContext, null, 2);
  }

  private parseHypotheses(content: string): Hypothesis[] {
    try {
      const jsonStr = this.extractJson(content);
      const parsed = JSON.parse(jsonStr) as { hypotheses?: unknown[] };

      if (!parsed.hypotheses || !Array.isArray(parsed.hypotheses)) {
        throw new Error("Response must contain a 'hypotheses' array");
      }

      return parsed.hypotheses.map((h, i) => this.normalizeHypothesis(h, i));
    } catch (error) {
      throw new Error(`Failed to parse hypotheses from LLM response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private extractJson(text: string): string {
    // Strip markdown code fences if present
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const cleaned = fenceMatch ? fenceMatch[1].trim() : text;

    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Response did not contain a valid JSON object");
    }

    return cleaned.slice(start, end + 1);
  }

  private normalizeHypothesis(raw: unknown, index: number): Hypothesis {
    const h = raw as Record<string, unknown>;

    const validCategories = ["ontology", "domain", "boundary", "decision", "risk", "invariant"];
    const category = validCategories.includes(h.category as string)
      ? (h.category as Hypothesis["category"])
      : "ontology";

    return {
      id: (h.id as string) ?? `hypothesis-${index + 1}`,
      category,
      statement: (h.statement as string) ?? "",
      confidence: typeof h.confidence === "number" ? Math.min(1, Math.max(0, h.confidence)) : 0.5,
      evidenceRefs: Array.isArray(h.evidenceRefs)
        ? h.evidenceRefs.map((entry) => {
            const value = entry as Record<string, unknown>;
            return {
              path: String(value.path ?? ""),
              symbol: value.symbol ? String(value.symbol) : undefined,
              lines: value.lines ? String(value.lines) : undefined
            };
          }).filter((ref) => ref.path.length > 0)
        : [],
      evidence: Array.isArray(h.evidence)
        ? h.evidence.map((e: unknown) => {
            const ev = e as Record<string, unknown>;
            return {
              type: (ev.type as string) ?? "inferred",
              source: (ev.source as string) ?? "llm-analysis",
              confidence: typeof ev.confidence === "number" ? ev.confidence : 0.5,
              evidence: Array.isArray(ev.evidence) ? ev.evidence.map(String) : [],
              description: (ev.description as string) ?? ""
            };
          })
        : [],
      needsConfirmation: h.needsConfirmation !== false,
      status: "pending"
    };
  }
}
