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
export type HypothesisStatus = "pending" | "needs-review" | "confirmed" | "rejected";

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

// ── Enforcement DSL ──────────────────────────────────────────

export type InvariantRuleKind =
  | "forbiddenImport"
  | "requiredFileExists"
  | "requiredSymbolExists"
  | "namingConvention";

export interface InvariantEnforcementSpec {
  /** Which rule template to apply */
  kind: InvariantRuleKind;
  /** forbiddenImport: substring or regex pattern of the import path to forbid */
  pattern?: string;
  /** requiredFileExists: relative path from project root */
  path?: string;
  /** requiredSymbolExists: symbol name to look for */
  symbol?: string;
  /** requiredSymbolExists: relative file path to scan */
  file?: string;
  /** namingConvention: glob of files to validate */
  glob?: string;
  /** namingConvention: regex the file basename must satisfy */
  regex?: string;
  /** Optional human-readable remediation hint shown with violations */
  fixHint?: string;
}

export type ViolationSeverity = "critical" | "important";

export interface EnforcementViolation {
  ruleId: string;
  ruleName: string;
  kind: "invariant" | "boundary" | "consistency";
  severity: ViolationSeverity;
  message: string;
  file?: string;
  line?: number;
  fromContext?: string;
  toContext?: string;
  fixHint?: string;
}

export interface ConsistencyIssue {
  id: string;
  type: "boundary-contradiction" | "invariant-decision-conflict" | "duplicate-rule";
  description: string;
  relatedElements: string[];
  suggestedQuestion?: string;
}

export interface EnforcementReport {
  generatedAt: string;
  rootPath: string;
  totalViolations: number;
  criticalViolations: number;
  importantViolations: number;
  consistencyIssues: number;
  violations: EnforcementViolation[];
  consistency: ConsistencyIssue[];
  passed: boolean;
}

export interface DomainInvariantKnowledge {
  rules: Array<{
    name: string;
    description: string;
    severity: "critical" | "important";
    status: "confirmed" | "inferred" | "needs-validation";
    /** Optional deterministic enforcement spec (used by InvariantCompiler) */
    enforcement?: InvariantEnforcementSpec;
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
  consolidatedKnowledgeHash?: string;
}

export interface TokenStageUsage {
  estimated: number;
  actual: number;
  calls: number;
}

export interface TokenUsageReport {
  maxBudget: number;
  used: number;
  remaining: number;
  estimatedTotal: number;
  actualTotal: number;
  byStage: Record<string, TokenStageUsage>;
}

export interface HypothesisQualityGateThresholds {
  minConfidence: number;
  maxPendingRatio: number;
}

export interface HypothesisQualityGateSummary {
  total: number;
  accepted: number;
  needsReview: number;
  rejected: number;
  pendingRatio: number;
  blocked: boolean;
}

export interface KnowledgeDiffEntitySection {
  added: number;
  removed: number;
  modified: number;
}

export interface KnowledgeDiffSummary {
  changed: boolean;
  invariants: KnowledgeDiffEntitySection;
  boundaries: {
    allowed: KnowledgeDiffEntitySection;
    prohibited: KnowledgeDiffEntitySection;
  };
  decisions: KnowledgeDiffEntitySection;
  cognitiveRisks: KnowledgeDiffEntitySection;
}

// ── LLM ───────────────────────────────────────────────────────

export interface LLMConfig {
  provider: Exclude<LLMProviderName, "none">;
  model: string;
  temperature: number;
  apiKey?: string;
  baseUrl?: string;
  maxTokensBudget: number;
  semanticDriftThreshold?: number;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  temperature?: number;
  jsonMode?: boolean;
  maxOutputTokens?: number;
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

export interface QualityGateConfig {
  minConfidence: number;
  maxPendingRatio: number;
}

export interface ForgemindConfig {
  outputPath: string;
  intermediatePath: string;
  ignoreDirs: string[];
  ignoreFilePatterns?: string[];
  llm: LLMConfig;
  qualityGate: QualityGateConfig;
  interview: InterviewConfig;
}

export interface GeneratorContext {
  scan: ScanResult;
  config: ForgemindConfig;
}

export interface RepoFacts {
  languages: string[];
  frameworks: string[];
  topLevelStructure: string[];
  dependencySummary: {
    files: string[];
    packageDependenciesCount: number;
    composerDependenciesCount: number;
  };
  architecturalSignals: string[];
  complianceLevel: "L1";
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
  tokenUsage: TokenUsageReport;
  qualityGate: HypothesisQualityGateSummary;
  knowledgeDiff: KnowledgeDiffSummary;
  semanticDrift?: SemanticDriftReport;
  contradictions?: ContradictionsReport;
  duration: number;
}

export interface ProviderCapabilities {
  supportsJsonMode: boolean;
  maxOutputTokens: number;
  varianceLevel: "low" | "medium" | "high";
  supportsTools: boolean;
}

export interface SemanticDriftCalibrationItem {
  category: HypothesisCategory;
  statement: string;
}

export interface SemanticDriftReport {
  provider: Exclude<LLMProviderName, "none">;
  model: string;
  previousProvider?: Exclude<LLMProviderName, "none">;
  previousModel?: string;
  diffSummary: string[];
  driftScore: number;
  actionRequired: boolean;
  generatedAt: string;
}

export interface ContradictionItem {
  id: string;
  type:
    | "answer-hypothesis"
    | "boundary-invariant"
    | "decision-operating-manual";
  severity: "critical" | "important";
  description: string;
  relatedElements: string[];
  suggestedQuestion: string;
}

export interface ContradictionsReport {
  generatedAt: string;
  total: number;
  byType: Record<ContradictionItem["type"], number>;
  contradictions: ContradictionItem[];
  interviewQuestions: InterviewQuestion[];
  downgradedHypotheses: string[];
}
