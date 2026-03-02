import type { ConsolidatedKnowledge, EvidenceEntry, LLMRequest, ScanResult } from "../../types/index.js";
import type { LLMProvider } from "../../../llm/provider.interface.js";
import { DOCUMENT_SYSTEM_PROMPTS } from "../../intelligence/prompts/hypothesisPrompts.js";

export type DocumentType =
  | "system-ontology"
  | "domain-invariants"
  | "module-boundaries"
  | "decision-log"
  | "agent-operating-manual";

export const ALL_DOCUMENT_TYPES: DocumentType[] = [
  "system-ontology",
  "domain-invariants",
  "module-boundaries",
  "decision-log",
  "agent-operating-manual"
];

export const DOCUMENT_FILENAMES: Record<DocumentType, string> = {
  "system-ontology": "system-ontology.md",
  "domain-invariants": "domain-invariants.md",
  "module-boundaries": "module-boundaries.md",
  "decision-log": "decision-log.md",
  "agent-operating-manual": "agent-operating-manual.md"
};

export class DocumentGenerator {
  constructor(private readonly provider: LLMProvider) {}

  async generate(
    docType: DocumentType,
    knowledge: ConsolidatedKnowledge,
    scan: ScanResult,
    evidenceMap: EvidenceEntry[]
  ): Promise<string> {
    const systemPrompt = DOCUMENT_SYSTEM_PROMPTS[docType];
    if (!systemPrompt) {
      throw new Error(`Unknown document type: ${docType}`);
    }

    const userPrompt = this.buildUserPrompt(docType, knowledge, scan, evidenceMap);

    const request: LLMRequest = {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
      jsonMode: false
    };

    const response = await this.provider.chat(request);

    // Strip any code fences the LLM might have added around the markdown
    return this.cleanMarkdown(response.content);
  }

  async generateAll(
    knowledge: ConsolidatedKnowledge,
    scan: ScanResult,
    evidenceMap: EvidenceEntry[]
  ): Promise<Map<DocumentType, string>> {
    const results = new Map<DocumentType, string>();

    // Generate sequentially to manage token usage and context
    for (const docType of ALL_DOCUMENT_TYPES) {
      const content = await this.generate(docType, knowledge, scan, evidenceMap);
      results.set(docType, content);
    }

    return results;
  }

  private buildUserPrompt(
    docType: DocumentType,
    knowledge: ConsolidatedKnowledge,
    scan: ScanResult,
    evidenceMap: EvidenceEntry[]
  ): string {
    const resolvedEvidenceMap = evidenceMap.length > 0 ? evidenceMap : knowledge.evidenceIndex;
    const claimSet = this.selectClaimsForDocument(docType, resolvedEvidenceMap);

    // Build document-specific payload from consolidated knowledge
    const baseContext = {
      project: {
        languages: scan.languages,
        frameworks: scan.frameworks,
        signals: scan.signals
      },
      gaps: knowledge.gaps,
      claims: claimSet
    };

    switch (docType) {
      case "system-ontology":
        return JSON.stringify({
          ...baseContext,
          systemOntology: knowledge.systemOntology,
          relevantDecisions: knowledge.decisions.decisions.slice(0, 5)
        }, null, 2);

      case "domain-invariants":
        return JSON.stringify({
          ...baseContext,
          domainInvariants: knowledge.domainInvariants
        }, null, 2);

      case "module-boundaries":
        return JSON.stringify({
          ...baseContext,
          conceptualBoundaries: knowledge.conceptualBoundaries
        }, null, 2);

      case "decision-log":
        return JSON.stringify({
          ...baseContext,
          decisions: knowledge.decisions
        }, null, 2);

      case "agent-operating-manual":
        return JSON.stringify({
          ...baseContext,
          cognitiveRisks: knowledge.cognitiveRisks,
          systemOntology: knowledge.systemOntology,
          criticalInvariants: knowledge.domainInvariants.rules.filter((r) => r.severity === "critical"),
          conceptualBoundaries: knowledge.conceptualBoundaries
        }, null, 2);

      default:
        return JSON.stringify({ ...baseContext, knowledge }, null, 2);
    }
  }

  private selectClaimsForDocument(docType: DocumentType, evidenceMap: EvidenceEntry[]): EvidenceEntry[] {
    const byType: Record<DocumentType, EvidenceEntry["claimType"][]> = {
      "system-ontology": ["ontology", "domain"],
      "domain-invariants": ["invariant", "domain"],
      "module-boundaries": ["boundary"],
      "decision-log": ["decision"],
      "agent-operating-manual": ["risk", "invariant", "boundary", "decision", "ontology", "domain"]
    };

    const allowed = new Set(byType[docType]);
    const filtered = evidenceMap.filter((entry) => allowed.has(entry.claimType));
    return filtered.length > 0 ? filtered : evidenceMap;
  }

  private cleanMarkdown(content: string): string {
    // Remove wrapping ```markdown ... ``` fences
    const fenceMatch = content.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)```\s*$/);
    if (fenceMatch) {
      return fenceMatch[1].trim() + "\n";
    }
    return content.trim() + "\n";
  }
}
