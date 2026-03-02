// ─────────────────────────────────────────────────────────────
// ForgeMind — AI Context Engineering Engine
// Type definitions
// ─────────────────────────────────────────────────────────────

// ── Language & Framework ──────────────────────────────────────

export type DetectedLanguage = string;
export type DetectedFramework = string;

export type LLMProviderName =
  | "openai"
  | "openai-compatible"
  | "anthropic"
  | "azure"
  | "gemini"
  | "local"
  | "none";

// ── Scanner ───────────────────────────────────────────────────

export interface DependencyInfo {
  configFiles: string[];
  dependencies: string[];
  ecosystemHints: string[];
}

export interface ScanResult {
  rootPath: string;
  languages: DetectedLanguage[];
  frameworks: DetectedFramework[];
  configFilesFound: string[];
  dependencies: DependencyInfo;
  signals: string[];
  scannedAt: string;
}

// ── Architectural Signals ─────────────────────────────────────

export interface ArchitecturalSignal {
  type: string;
  source: string;
  confidence: number;
  evidence: string[];
  description: string;
}

// ── Code Sampling ─────────────────────────────────────────────

export interface CodeSample {
  path: string;
  content: string;
  reason: string;
  category: "entry-point" | "config" | "domain" | "pattern-representative" | "high-fan-in" | "infrastructure";
  tokenEstimate: number;
}

// ── Hypotheses ────────────────────────────────────────────────

export type HypothesisCategory = "ontology" | "domain" | "boundary" | "decision" | "risk" | "invariant";
export type HypothesisStatus = "pending" | "confirmed" | "rejected";

export interface Hypothesis {
  id: string;
  category: HypothesisCategory;
  statement: string;
  confidence: number;
  evidenceRefs: Array<{ path: string; symbol?: string; lines?: string }>;
  evidence: ArchitecturalSignal[];
  needsConfirmation: boolean;
  status: HypothesisStatus;
}

export interface EvidenceRef {
  path: string;
  symbol?: string;
  lines?: string;
}

export interface EvidenceEntry {
  claimId: string;
  claimType: HypothesisCategory;
  summary: string;
  evidence: EvidenceRef[];
  confidence: "confirmed" | "inferred" | "unknown";
  agentImpact: string;
}

export type DomainCandidateKind = "entity" | "invariant" | "workflow" | "guard" | "schema" | "event";

export interface DomainCandidate {
  name: string;
  kind: DomainCandidateKind;
  source: string;
  filePath: string;
  symbol?: string;
  lines?: string;
}

// ── Interview ─────────────────────────────────────────────────

export type QuestionPriority = "critical" | "important" | "nice-to-have";

export interface InterviewQuestion {
  id: string;
  category: string;
  question: string;
  context: string;
  relatedHypotheses: string[];
  options?: string[];
  priority: QuestionPriority;
}

export interface InterviewAnswer {
  questionId: string;
  answer: string;
  selectedOption?: number;
  source?: "selected" | "custom";
  timestamp: string;
}

export interface StructuredAnswer {
  questionId: string;
  answer: string;
  selectedOption?: number;
  source: "selected" | "custom";
  timestamp: string;
}

export interface InterviewSession {
  id: string;
  version: string;
  forgemindVersion: string;
  startedAt: string;
  questions: InterviewQuestion[];
  answers: InterviewAnswer[];
  completedAt?: string;
}

// ── Consolidated Knowledge ────────────────────────────────────

export interface SystemOntologyKnowledge {
  corePurpose: string;
  mentalModel: string;
  centralConcepts: string[];
  systemOrientation: string;
  principles: string[];
}

export interface DomainInvariantKnowledge {
  rules: Array<{
    name: string;
    description: string;
    severity: "critical" | "important";
    status: "confirmed" | "inferred" | "needs-validation";
  }>;
  validStates: string[];
  invalidStates: string[];
  constraints: string[];
}

export interface ConceptualBoundaryKnowledge {
  contexts: Array<{ name: string; responsibility: string; responsibilities: string[]; risks: string[] }>;
  allowedRelations: Array<{ from: string; to: string; type: string }>;
  prohibitedRelations: Array<{ from: string; to: string; reason: string }>;
  dangerousInteractions: string[];
}

export interface DecisionKnowledge {
  decisions: Array<{
    title: string;
    context: string;
    choice: string;
    irreversible: boolean;
    alternatives: string[];
    tradeoffs: string[];
    implicitAssumptions: string[];
    limitations: string[];
  }>;
}

export interface CognitiveRiskKnowledge {
  likelyErrors: string[];
  deceptivePatterns: string[];
  implicitCoupling: string[];
  invisibleSideEffects: string[];
  operationalAssumptions: string[];
}

export interface ConsolidatedKnowledge {
  systemOntology: SystemOntologyKnowledge;
  domainInvariants: DomainInvariantKnowledge;
  conceptualBoundaries: ConceptualBoundaryKnowledge;
  decisions: DecisionKnowledge;
  cognitiveRisks: CognitiveRiskKnowledge;
  evidenceIndex: EvidenceEntry[];
  gaps: string[];
}

// ── Semantic Context (full intermediate state) ────────────────

export interface SemanticContext {
  version: string;
  forgemindVersion: string;
  generatedAt: string;
  signals: ArchitecturalSignal[];
  hypotheses: Hypothesis[];
  interviewSessions: InterviewSession[];
  consolidatedKnowledge: ConsolidatedKnowledge;
}

// ── LLM ───────────────────────────────────────────────────────

export interface LLMConfig {
  provider: Exclude<LLMProviderName, "none">;
  model: string;
  temperature: number;
  apiKey?: string;
  baseUrl?: string;
  maxTokensBudget: number;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  temperature?: number;
  jsonMode?: boolean;
}

export interface LLMResponse {
  content: string;
  metadata: {
    provider: Exclude<LLMProviderName, "none">;
    model: string;
    tokensUsed?: number;
  };
}

// ── Configuration ─────────────────────────────────────────────

export interface InterviewConfig {
  maxQuestions: number;
  adaptiveFollowUp: boolean;
  language: string;
}

export interface ForgemindConfig {
  outputPath: string;
  intermediatePath: string;
  ignoreDirs: string[];
  ignoreFilePatterns?: string[];
  llm: LLMConfig;
  interview: InterviewConfig;
}

export interface GeneratorContext {
  scan: ScanResult;
  config: ForgemindConfig;
}

// ── Pipeline Result ───────────────────────────────────────────

export interface ForgeResult {
  rootPath: string;
  generatedFiles: string[];
  signals: ArchitecturalSignal[];
  hypothesesCount: number;
  confirmedHypotheses: number;
  interviewCompleted: boolean;
  documentsGenerated: string[];
  evidenceMapEntries: number;
  domainCandidatesCount: number;
  unknownClaims: number;
  llmProvider: string;
  llmModel: string;
  duration: number;
}
