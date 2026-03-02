import type {
  ArchitecturalSignal,
  ConsolidatedKnowledge,
  EvidenceEntry,
  Hypothesis,
  InterviewSession,
  LLMRequest,
  ScanResult,
  StructuredAnswer,
} from "../types/index.js";
import type { LLMProvider } from "../../llm/provider.interface.js";
import { CONSOLIDATION_SYSTEM_PROMPT } from "../intelligence/prompts/hypothesisPrompts.js";

export class SemanticConsolidator {
  constructor(private readonly provider: LLMProvider) {}

  async consolidate(
    scan: ScanResult,
    signals: ArchitecturalSignal[],
    hypotheses: Hypothesis[],
    interviewSessions: InterviewSession[],
    evidenceMap: EvidenceEntry[],
    structuredAnswers: StructuredAnswer[]
  ): Promise<ConsolidatedKnowledge> {
    const userPrompt = this.buildUserPrompt(scan, signals, hypotheses, interviewSessions, evidenceMap, structuredAnswers);

    const request: LLMRequest = {
      messages: [
        { role: "system", content: CONSOLIDATION_SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.2,
      jsonMode: true
    };

    const response = await this.provider.chat(request);
    return this.parseKnowledge(response.content);
  }

  private buildUserPrompt(
    scan: ScanResult,
    signals: ArchitecturalSignal[],
    hypotheses: Hypothesis[],
    interviewSessions: InterviewSession[],
    evidenceMap: EvidenceEntry[],
    structuredAnswers: StructuredAnswer[]
  ): string {
    const confirmed = hypotheses.filter((h) => h.status === "confirmed");
    const rejected = hypotheses.filter((h) => h.status === "rejected");
    const pending = hypotheses.filter((h) => h.status === "pending");

    // Flatten all answers from all sessions
    const allAnswers: Array<{ question: string; answer: string }> = [];
    for (const session of interviewSessions) {
      for (const answer of session.answers) {
        const question = session.questions.find((q) => q.id === answer.questionId);
        if (question) {
          allAnswers.push({
            question: question.question,
            answer: answer.answer
          });
        }
      }
    }

    return JSON.stringify({
      projectOverview: {
        languages: scan.languages,
        frameworks: scan.frameworks,
        signals: scan.signals,
        configFilesFound: scan.configFilesFound,
        dependencyHints: scan.dependencies.dependencies.slice(0, 80)
      },
      architecturalSignals: signals.map((s) => ({
        type: s.type,
        description: s.description,
        confidence: s.confidence
      })),
      confirmedHypotheses: confirmed.map((h) => ({
        category: h.category,
        statement: h.statement,
        confidence: h.confidence
      })),
      rejectedHypotheses: rejected.map((h) => ({
        category: h.category,
        statement: h.statement,
        reason: "Developer explicitly rejected this hypothesis"
      })),
      pendingHypotheses: pending
        .filter((h) => h.confidence >= 0.6)
        .map((h) => ({
          category: h.category,
          statement: h.statement,
          confidence: h.confidence
        })),
      developerAnswers: allAnswers,
      structuredAnswers,
      evidenceMap,
      unknownEvidenceClaims: evidenceMap
        .filter((entry) => entry.confidence === "unknown")
        .map((entry) => ({
          claimId: entry.claimId,
          summary: entry.summary,
          agentImpact: entry.agentImpact
        }))
    }, null, 2);
  }

  private parseKnowledge(content: string): ConsolidatedKnowledge {
    try {
      const jsonStr = this.extractJson(content);
      const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

      return {
        systemOntology: this.normalizeSystemOntology(parsed.systemOntology),
        domainInvariants: this.normalizeDomainInvariants(parsed.domainInvariants),
        conceptualBoundaries: this.normalizeConceptualBoundaries(parsed.conceptualBoundaries),
        decisions: this.normalizeDecisions(parsed.decisions),
        cognitiveRisks: this.normalizeCognitiveRisks(parsed.cognitiveRisks),
        evidenceIndex: this.normalizeEvidenceIndex(parsed.evidenceIndex),
        gaps: Array.isArray(parsed.gaps) ? parsed.gaps.map(String) : []
      };
    } catch (error) {
      throw new Error(`Failed to parse consolidated knowledge: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private normalizeSystemOntology(raw: unknown): ConsolidatedKnowledge["systemOntology"] {
    const data = (raw ?? {}) as Record<string, unknown>;
    return {
      corePurpose: String(data.corePurpose ?? ""),
      mentalModel: String(data.mentalModel ?? ""),
      centralConcepts: this.toStringArray(data.centralConcepts),
      systemOrientation: String(data.systemOrientation ?? ""),
      principles: this.toStringArray(data.principles),
    };
  }

  private normalizeDomainInvariants(raw: unknown): ConsolidatedKnowledge["domainInvariants"] {
    const data = (raw ?? {}) as Record<string, unknown>;
    return {
      rules: Array.isArray(data.rules)
        ? data.rules.map((r: unknown) => {
            const rule = r as Record<string, unknown>;
            return {
              name: String(rule.name ?? ""),
              description: String(rule.description ?? ""),
              severity: (rule.severity === "critical" ? "critical" : "important") as "critical" | "important",
              status: (["confirmed", "inferred", "needs-validation"].includes(String(rule.status))
                ? String(rule.status)
                : "inferred") as "confirmed" | "inferred" | "needs-validation"
            };
          })
        : [],
      validStates: this.toStringArray(data.validStates),
      invalidStates: this.toStringArray(data.invalidStates),
      constraints: this.toStringArray(data.constraints)
    };
  }

  private normalizeConceptualBoundaries(raw: unknown): ConsolidatedKnowledge["conceptualBoundaries"] {
    const data = (raw ?? {}) as Record<string, unknown>;
    return {
      contexts: Array.isArray(data.contexts)
        ? data.contexts.map((c: unknown) => {
            const ctx = c as Record<string, unknown>;
            return {
              name: String(ctx.name ?? ""),
              responsibility: String(ctx.responsibility ?? ""),
              responsibilities: this.toStringArray(ctx.responsibilities),
              risks: this.toStringArray(ctx.risks)
            };
          })
        : [],
      allowedRelations: Array.isArray(data.allowedRelations)
        ? data.allowedRelations.map((r: unknown) => {
            const rel = r as Record<string, unknown>;
            return { from: String(rel.from ?? ""), to: String(rel.to ?? ""), type: String(rel.type ?? "sync") };
          })
        : [],
      prohibitedRelations: Array.isArray(data.prohibitedRelations)
        ? data.prohibitedRelations.map((r: unknown) => {
            const rel = r as Record<string, unknown>;
            return { from: String(rel.from ?? ""), to: String(rel.to ?? ""), reason: String(rel.reason ?? "") };
          })
        : [],
      dangerousInteractions: this.toStringArray(data.dangerousInteractions)
    };
  }

  private normalizeDecisions(raw: unknown): ConsolidatedKnowledge["decisions"] {
    const data = (raw ?? {}) as Record<string, unknown>;
    return {
      decisions: Array.isArray(data.decisions)
        ? data.decisions.map((d: unknown) => {
            const dec = d as Record<string, unknown>;
            return {
              title: String(dec.title ?? ""),
              context: String(dec.context ?? ""),
              choice: String(dec.choice ?? ""),
              irreversible: Boolean(dec.irreversible),
              alternatives: this.toStringArray(dec.alternatives),
              tradeoffs: this.toStringArray(dec.tradeoffs),
              implicitAssumptions: this.toStringArray(dec.implicitAssumptions),
              limitations: this.toStringArray(dec.limitations)
            };
          })
        : []
    };
  }

  private normalizeCognitiveRisks(raw: unknown): ConsolidatedKnowledge["cognitiveRisks"] {
    const data = (raw ?? {}) as Record<string, unknown>;
    return {
      likelyErrors: this.toStringArray(data.likelyErrors),
      deceptivePatterns: this.toStringArray(data.deceptivePatterns),
      implicitCoupling: this.toStringArray(data.implicitCoupling),
      invisibleSideEffects: this.toStringArray(data.invisibleSideEffects),
      operationalAssumptions: this.toStringArray(data.operationalAssumptions)
    };
  }

  private normalizeEvidenceIndex(raw: unknown): ConsolidatedKnowledge["evidenceIndex"] {
    if (!Array.isArray(raw)) return [];
    const validClaimTypes = ["ontology", "domain", "boundary", "decision", "risk", "invariant"];
    const validConfidence = ["confirmed", "inferred", "unknown"];

    return raw.map((entry: unknown, index) => {
      const value = entry as Record<string, unknown>;
      const claimType = validClaimTypes.includes(String(value.claimType))
        ? (value.claimType as EvidenceEntry["claimType"])
        : "domain";
      const confidence = validConfidence.includes(String(value.confidence).toLowerCase())
        ? (String(value.confidence).toLowerCase() as EvidenceEntry["confidence"])
        : "unknown";

      return {
        claimId: String(value.claimId ?? `claim-${index + 1}`),
        claimType,
        summary: String(value.summary ?? ""),
        evidence: Array.isArray(value.evidence)
          ? value.evidence.map((item) => {
              const ev = item as Record<string, unknown>;
              return {
                path: String(ev.path ?? ""),
                symbol: ev.symbol ? String(ev.symbol) : undefined,
                lines: ev.lines ? String(ev.lines) : undefined
              };
            }).filter((item) => item.path.length > 0)
          : [],
        confidence,
        agentImpact: String(value.agentImpact ?? "")
      };
    });
  }

  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map(String);
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
