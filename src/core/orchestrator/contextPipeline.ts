import { resolve } from "node:path";
import { ensureDir, writeTextFile, readTextFile, fileExists } from "../../utils/fileSystem.js";
import { hashJson, stableStringify } from "../../utils/hashing.js";
import { Logger } from "../../utils/logger.js";
import type {
  ArchitecturalSignal,
  CodeSample,
  ConsolidatedKnowledge,
  ContradictionsReport,
  DomainCandidate,
  EvidenceEntry,
  ForgemindConfig,
  ForgeResult,
  Hypothesis,
  InterviewSession,
  KnowledgeDiffSummary,
  LLMProviderName,
  SemanticDriftReport,
  SemanticContext,
  StructuredAnswer,
} from "../types/index.js";
import { FORGEMIND_VERSION } from "../config/defaults.js";
import { RepositoryScanner } from "../scanner/repositoryScanner.js";
import { SignalAnalyzer } from "../analyzer/signalAnalyzer.js";
import { CodeSampler } from "../analyzer/codeSampler.js";
import { HypothesisEngine } from "../intelligence/hypothesisEngine.js";
import { InterviewEngine } from "../interview/interviewEngine.js";
import { SemanticConsolidator } from "../consolidator/semanticConsolidator.js";
import { DocumentGenerator, ALL_DOCUMENT_TYPES, DOCUMENT_FILENAMES } from "../generators/documents/documentGenerator.js";
import type { DocumentType } from "../generators/documents/documentGenerator.js";
import { RedundancyFilter } from "../generators/documents/redundancyFilter.js";
import { LLMOrchestrator } from "../../llm/llm.orchestrator.js";
import { DomainMiner } from "../mining/domainMiner.js";
import { EvidenceMapGenerator } from "../mining/evidenceMapGenerator.js";
import { HypothesisQualityGate, shouldBlockConsolidation } from "../intelligence/hypothesisQualityGate.js";
import { buildKnowledgeDiff } from "../consolidator/knowledgeDiff.js";
import { QualityGateBlockedError, SemanticDriftBlockedError } from "../errors/pipelineErrors.js";
import {
  baselineKey,
  type BaselineRegistry,
  type BaselineSnapshot,
  SemanticDriftDetector,
  shouldRunSemanticDriftCheck,
  toBaselineSnapshot
} from "../validation/semanticDriftDetector.js";
import { ContradictionEngine } from "../validation/contradictionEngine.js";
import { SemanticContextStore } from "./semanticContextStore.js";
import {
  buildTrackedFileHashes,
  buildTrackedFilesHash,
  diffTrackedFiles,
  planPartialRegeneration,
  type IncrementalState,
} from "./incrementalContext.js";
import { rankDomainCandidates, rankHypotheses } from "../intelligence/relevanceRanker.js";

const TOP_K_DOMAIN_CANDIDATES_PER_KIND = 40;
const TOP_K_HYPOTHESES_PER_CATEGORY = 12;

export interface ContextPipelineOptions {
  providerOverride?: LLMProviderName;
  skipInterview?: boolean;
  interviewOnly?: boolean;
  forceInterview?: boolean;
  acceptDrift?: boolean;
  allowInteractiveInterviewOnDrift?: boolean;
  forceFullRegeneration?: boolean;
}

export class ContextPipeline {
  private readonly scanner = new RepositoryScanner();
  private readonly signalAnalyzer = new SignalAnalyzer();
  private readonly codeSampler = new CodeSampler();
  private readonly domainMiner = new DomainMiner();
  private readonly semanticContextStore = new SemanticContextStore();

  async run(
    rootPath: string,
    config: ForgemindConfig,
    options: ContextPipelineOptions,
    logger: Logger
  ): Promise<ForgeResult> {
    const startTime = Date.now();
    const outputDir = resolve(rootPath, config.outputPath);
    const intermediateDir = resolve(rootPath, config.intermediatePath);

    // Ensure output directories exist
    await Promise.all([ensureDir(outputDir), ensureDir(intermediateDir)]);

    // 1. Resolve LLM provider (required)
    logger.info("Resolving LLM provider...");
    const orchestrator = new LLMOrchestrator({
      config: config.llm,
      providerOverride: options.providerOverride
    });
    const provider = orchestrator.getProvider();
    logger.success(`LLM: ${orchestrator.getProviderName()} / ${orchestrator.getModelName()}`);

    const incrementalStatePath = resolve(intermediateDir, "incremental-state.json");
    const semanticDriftPath = resolve(intermediateDir, "semantic-drift.json");
    const semanticDriftBaselinePath = resolve(intermediateDir, "semantic-drift-baseline.json");
    const contradictionsPath = resolve(intermediateDir, "contradictions.json");
    const previousContext = await this.semanticContextStore.load(intermediateDir);
    const previousIncrementalState = await this.loadCached<IncrementalState>(incrementalStatePath);
    const previousKnowledge = previousContext?.consolidatedKnowledge ?? null;
    const previousSemanticDrift = await this.loadCached<SemanticDriftReport>(semanticDriftPath);
    const semanticDriftBaselineRegistry =
      await this.loadCached<BaselineRegistry>(semanticDriftBaselinePath) ?? { baselines: {} };

    // 2. Scan repository
    logger.info("Scanning repository...");
    const scan = await this.scanner.scan(rootPath, config);
    logger.success(`Detected: ${scan.languages.join(", ")} | ${scan.frameworks.join(", ")}`);

    const trackedFiles = await buildTrackedFileHashes(rootPath, config);
    const trackedFilesHash = buildTrackedFilesHash(trackedFiles);
    const changeSet = diffTrackedFiles(previousIncrementalState?.trackedFiles, trackedFiles);
    const incrementalPlan = planPartialRegeneration(changeSet);
    const forceFullRegeneration = options.forceFullRegeneration === true;
    const executionMode: ForgeResult["executionMode"] = forceFullRegeneration ? "full" : "incremental";
    const canReuseCodeArtifacts = !forceFullRegeneration && !options.interviewOnly && (changeSet.unchanged || incrementalPlan.docsOnlyChange);
    if (forceFullRegeneration) {
      logger.info("Full regeneration mode enabled: ignoring incremental cache and planning full document regeneration.");
    }
    if (changeSet.unchanged) {
      logger.info("Incremental scan: no tracked file changes detected.");
    } else {
      logger.info(
        `Incremental scan: ${changeSet.changedFiles.length} changed, ${changeSet.removedFiles.length} removed | ` +
        `areas=${incrementalPlan.areas.join(", ") || "none"}`
      );
    }

    // 3. Analyze architectural signals
    logger.info("Analyzing architectural signals...");
    let signals: ArchitecturalSignal[];

    const signalsPath = resolve(intermediateDir, "signals.json");
    const cachedSignals = await this.loadCached<{ signals: ArchitecturalSignal[] }>(signalsPath);

    if (cachedSignals && canReuseCodeArtifacts) {
      signals = cachedSignals.signals;
      logger.debug(`Loaded ${signals.length} cached signals`);
    } else {
      signals = await this.signalAnalyzer.analyze(scan, config.ignoreDirs);
      await this.saveIntermediate(signalsPath, { signals, generatedAt: new Date().toISOString(), forgemindVersion: FORGEMIND_VERSION });
    }
    logger.success(`${signals.length} architectural signals detected`);

    // 4. Sample code
    logger.info("Sampling representative code...");
    let samples: CodeSample[];

    const samplesPath = resolve(intermediateDir, "samples.json");
    const cachedSamples = await this.loadCached<{ samples: CodeSample[] }>(samplesPath);

    if (cachedSamples && canReuseCodeArtifacts) {
      samples = cachedSamples.samples;
      logger.debug(`Loaded ${samples.length} cached code samples`);
    } else {
      samples = await this.codeSampler.sample(scan, config.ignoreDirs, config.llm.maxTokensBudget);
      await this.saveIntermediate(samplesPath, { samples, generatedAt: new Date().toISOString(), forgemindVersion: FORGEMIND_VERSION });
    }
    logger.success(`${samples.length} code samples collected (~${samples.reduce((sum, s) => sum + s.tokenEstimate, 0)} tokens)`);

    // 5. Mine domain candidates
    logger.info("Mining domain candidates...");
    let domainCandidates: DomainCandidate[];

    const candidatesPath = resolve(intermediateDir, "domain-candidates.json");
    const cachedCandidates = await this.loadCached<{ candidates: DomainCandidate[] }>(candidatesPath);

    if (cachedCandidates && canReuseCodeArtifacts) {
      domainCandidates = cachedCandidates.candidates;
      logger.debug(`Loaded ${domainCandidates.length} cached domain candidates`);
    } else {
      domainCandidates = await this.domainMiner.mine(scan, config.ignoreDirs);
      await this.saveIntermediate(candidatesPath, {
        candidates: domainCandidates,
        generatedAt: new Date().toISOString(),
        forgemindVersion: FORGEMIND_VERSION
      });
    }
    domainCandidates = rankDomainCandidates(domainCandidates, TOP_K_DOMAIN_CANDIDATES_PER_KIND);
    logger.success(`${domainCandidates.length} domain candidates mined`);

    const semanticDriftThreshold = config.llm.semanticDriftThreshold ?? 0.35;
    const providerName = orchestrator.getProviderName() as Exclude<LLMProviderName, "none">;
    const modelName = orchestrator.getModelName();
    const currentBaselineKey = baselineKey(providerName, modelName);
    const activeBaseline = semanticDriftBaselineRegistry.activeKey
      ? semanticDriftBaselineRegistry.baselines[semanticDriftBaselineRegistry.activeKey]
      : undefined;
    const sameProviderBaseline = semanticDriftBaselineRegistry.baselines[currentBaselineKey];
    const semanticDriftBaseline: BaselineSnapshot | undefined = activeBaseline ?? sameProviderBaseline;
    let semanticDrift: SemanticDriftReport;
    let requiresDriftInterview = false;

    if (shouldRunSemanticDriftCheck(previousSemanticDrift, providerName, modelName)) {
      logger.info("Running semantic drift calibration...");
      orchestrator.setStage("semantic-drift");

      const detector = new SemanticDriftDetector(semanticDriftThreshold);
      const { report, calibration } = await detector.detect({
        provider,
        providerName,
        modelName,
        previous: previousSemanticDrift ?? undefined,
        baseline: semanticDriftBaseline ?? undefined,
        signals,
        samples,
        domainCandidates
      });

      semanticDrift = report;
      await this.saveIntermediate(semanticDriftPath, report);

      if (!report.actionRequired || options.acceptDrift) {
        const updatedRegistry: BaselineRegistry = {
          activeKey: currentBaselineKey,
          baselines: {
            ...semanticDriftBaselineRegistry.baselines,
            [currentBaselineKey]: toBaselineSnapshot(providerName, modelName, calibration)
          }
        };
        await this.saveIntermediate(
          semanticDriftBaselinePath,
          updatedRegistry
        );
      }

      logger.info(`Semantic drift score: ${report.driftScore.toFixed(3)} (threshold=${semanticDriftThreshold.toFixed(3)})`);

      if (report.actionRequired && !options.acceptDrift) {
        if (options.allowInteractiveInterviewOnDrift) {
          requiresDriftInterview = true;
          logger.warn("Semantic drift requires interview confirmation before consolidation.");
        } else {
          throw new SemanticDriftBlockedError(report.driftScore, semanticDriftThreshold);
        }
      }

      if (report.actionRequired && options.acceptDrift) {
        logger.warn("Semantic drift accepted via --accept-drift.");
      }
    } else {
      semanticDrift = {
        provider: providerName,
        model: modelName,
        previousProvider: previousSemanticDrift?.provider,
        previousModel: previousSemanticDrift?.model,
        diffSummary: ["Provider/model unchanged; semantic drift check skipped."],
        driftScore: 0,
        actionRequired: false,
        generatedAt: new Date().toISOString()
      };
      await this.saveIntermediate(semanticDriftPath, semanticDrift);
      logger.debug("Semantic drift check skipped (provider/model unchanged)");
    }

    // 6. Generate hypotheses
    logger.info("Generating architectural hypotheses via LLM...");
    let hypotheses: Hypothesis[];

    const hypothesesPath = resolve(intermediateDir, "hypotheses.json");
    const cachedHypotheses = await this.loadCached<{ hypotheses: Hypothesis[] }>(hypothesesPath);

    if (cachedHypotheses && canReuseCodeArtifacts) {
      hypotheses = cachedHypotheses.hypotheses;
      logger.debug(`Loaded ${hypotheses.length} cached hypotheses`);
    } else {
      orchestrator.setStage("hypotheses");
      const hypothesisEngine = new HypothesisEngine(provider);
      hypotheses = await hypothesisEngine.generateHypotheses(scan, signals, samples, domainCandidates);
      await this.saveIntermediate(hypothesesPath, { hypotheses, generatedAt: new Date().toISOString(), forgemindVersion: FORGEMIND_VERSION });
    }
    hypotheses = rankHypotheses(hypotheses, TOP_K_HYPOTHESES_PER_CATEGORY);

    const qualityGate = new HypothesisQualityGate(config.qualityGate);
    const qualityGateSummary = qualityGate.apply(hypotheses);

    const needsConfirmation = hypotheses.filter((h) => h.needsConfirmation).length;
    logger.success(`${hypotheses.length} hypotheses generated (${needsConfirmation} need confirmation)`);
    logger.info(
      `Quality gate: accepted=${qualityGateSummary.accepted}, needs-review=${qualityGateSummary.needsReview}, rejected=${qualityGateSummary.rejected}`
    );

    // 7. Generate evidence map
    logger.info("Building evidence map...");
    let evidenceMap: EvidenceEntry[];
    const evidenceMapPath = resolve(intermediateDir, "evidence-map.json");
    const cachedEvidenceMap = await this.loadCached<{ entries: EvidenceEntry[] }>(evidenceMapPath);

    if (cachedEvidenceMap && canReuseCodeArtifacts) {
      evidenceMap = cachedEvidenceMap.entries;
      logger.debug(`Loaded ${evidenceMap.length} cached evidence entries`);
    } else {
      orchestrator.setStage("evidence-map");
      const evidenceGenerator = new EvidenceMapGenerator(provider);
      evidenceMap = await evidenceGenerator.generate(scan, hypotheses, signals, samples, domainCandidates);
      const previousEvidenceEntries = cachedEvidenceMap?.entries ?? [];
      evidenceMap = this.stabilizeEvidenceEntries(evidenceMap, previousEvidenceEntries);
      await this.saveIntermediate(evidenceMapPath, {
        entries: evidenceMap,
        generatedAt: new Date().toISOString(),
        forgemindVersion: FORGEMIND_VERSION
      });
    }
    logger.success(`${evidenceMap.length} evidence entries generated`);

    // 8. Interview (mandatory on first run)
    let interviewSessions: InterviewSession[] = [];
    let structuredAnswers: StructuredAnswer[] = [];
    const interviewPath = resolve(intermediateDir, "interview.json");
    const answersPath = resolve(intermediateDir, "answers.json");

    const cachedInterview = await this.loadCached<{ sessions: InterviewSession[] }>(interviewPath);
    if (cachedInterview) {
      interviewSessions = cachedInterview.sessions;
    }

    const cachedAnswers = await this.loadCached<{ answers: StructuredAnswer[] }>(answersPath);
    if (cachedAnswers) {
      structuredAnswers = cachedAnswers.answers;
    }

    const shouldRunInterview = options.forceInterview || structuredAnswers.length === 0 || requiresDriftInterview;

    if (!shouldRunInterview) {
      logger.info(`Using existing interview answers (${structuredAnswers.length} responses)`);
    } else {
      if (options.skipInterview && structuredAnswers.length === 0) {
        logger.warn("No ai/answers.json found; first run requires guided interview. Ignoring --skip-interview.");
      }

      logger.info("Starting guided interview...");
      const interviewEngine = new InterviewEngine(provider, config.interview);
      orchestrator.setStage("interview");
      const session = await interviewEngine.conduct(hypotheses, signals, evidenceMap, domainCandidates, {
        existingAnswers: structuredAnswers,
        onAnswerCaptured: async (answers) => {
          await this.saveIntermediate(answersPath, {
            answers,
            generatedAt: new Date().toISOString(),
            forgemindVersion: FORGEMIND_VERSION
          });
        }
      });
      interviewSessions = [...interviewSessions, session];
      structuredAnswers = session.answers.map((answer) => ({
        questionId: answer.questionId,
        answer: answer.answer,
        selectedOption: answer.selectedOption,
        source: answer.source ?? "custom",
        timestamp: answer.timestamp
      }));

      await this.saveIntermediate(interviewPath, { sessions: interviewSessions, generatedAt: new Date().toISOString(), forgemindVersion: FORGEMIND_VERSION });
      await this.saveIntermediate(answersPath, { answers: structuredAnswers, generatedAt: new Date().toISOString(), forgemindVersion: FORGEMIND_VERSION });
      logger.success(`Interview complete: ${structuredAnswers.length} answers captured`);
    }

    // If interview-only mode, stop here
    if (options.interviewOnly) {
      const tokenUsage = orchestrator.getTokenUsageReport();
      this.logTokenUsage(logger, tokenUsage);
      return {
        executionMode,
        rootPath,
        generatedFiles: [],
        signals,
        hypothesesCount: hypotheses.length,
        confirmedHypotheses: hypotheses.filter((h) => h.status === "confirmed").length,
        interviewCompleted: structuredAnswers.length > 0,
        documentsGenerated: [],
        evidenceMapEntries: evidenceMap.length,
        domainCandidatesCount: domainCandidates.length,
        unknownClaims: evidenceMap.filter((entry) => entry.confidence === "unknown").length,
        llmProvider: orchestrator.getProviderName(),
        llmModel: orchestrator.getModelName(),
        tokenUsage,
        qualityGate: qualityGateSummary,
        knowledgeDiff: emptyKnowledgeDiffSummary(),
        semanticDrift,
        duration: Date.now() - startTime
      };
    }

    if (shouldBlockConsolidation(qualityGateSummary, structuredAnswers.length > 0)) {
      throw new QualityGateBlockedError(qualityGateSummary.pendingRatio, config.qualityGate.maxPendingRatio);
    }

    // 9. Consolidate knowledge
    logger.info("Consolidating semantic knowledge...");
    orchestrator.setStage("consolidation");
    const consolidator = new SemanticConsolidator(provider);
    const knowledge = await consolidator.consolidate(scan, signals, hypotheses, interviewSessions, evidenceMap, structuredAnswers);

    const generatedAt = new Date().toISOString();
    const knowledgeHash = hashJson(knowledge);
    const knowledgeDiffArtifact = buildKnowledgeDiff(previousKnowledge, knowledge, generatedAt);
    const knowledgeDiffPath = resolve(intermediateDir, "knowledge-diff.json");
    await this.saveIntermediate(knowledgeDiffPath, knowledgeDiffArtifact);
    logger.success("Knowledge diff generated: ai/knowledge-diff.json");

    // Save semantic context
    const semanticContext: SemanticContext = {
      version: "1.0.0",
      forgemindVersion: FORGEMIND_VERSION,
      generatedAt,
      signals,
      hypotheses,
      interviewSessions,
      consolidatedKnowledge: knowledge,
      consolidatedKnowledgeHash: knowledgeHash
    };
    await this.semanticContextStore.save(intermediateDir, semanticContext);
    logger.success("Knowledge consolidated");

    const questionToHypotheses = new Map<string, string[]>();
    for (const session of interviewSessions) {
      for (const question of session.questions) {
        questionToHypotheses.set(question.id, question.relatedHypotheses ?? []);
      }
    }

    const operatingManualPath = resolve(outputDir, "agent-operating-manual.md");
    const operatingManual = (await fileExists(operatingManualPath))
      ? await readTextFile(operatingManualPath)
      : undefined;

    const contradictionEngine = new ContradictionEngine();
    const contradictions = contradictionEngine.analyze({
      hypotheses,
      answers: structuredAnswers,
      questionToHypotheses,
      knowledge,
      operatingManual
    });
    await this.saveIntermediate(contradictionsPath, contradictions);
    if (contradictions.downgradedHypotheses.length > 0) {
      await this.saveIntermediate(hypothesesPath, {
        hypotheses,
        generatedAt: new Date().toISOString(),
        forgemindVersion: FORGEMIND_VERSION
      });
      logger.warn(
        `Hypotheses downgraded to needs-review due to interview contradictions: ${contradictions.downgradedHypotheses.join(", ")}`
      );
    }
    logger.info(
      `Contradictions: total=${contradictions.total} (answer-hypothesis=${contradictions.byType["answer-hypothesis"]}, ` +
      `boundary-invariant=${contradictions.byType["boundary-invariant"]}, decision-operating-manual=${contradictions.byType["decision-operating-manual"]})`
    );

    if (knowledge.gaps.length > 0) {
      logger.warn(`Knowledge gaps identified: ${knowledge.gaps.length}`);
      for (const gap of knowledge.gaps.slice(0, 3)) {
        logger.debug(`  - ${gap}`);
      }
    }

    const docsToRegenerate = this.resolveDocsToRegenerate(
      changeSet.unchanged,
      incrementalPlan.docsToRegenerate,
      incrementalPlan.requiresFullRegeneration,
      forceFullRegeneration
    );

    let filteredDocuments = new Map<string, string>();
    if (docsToRegenerate.length > 0) {
      logger.info(`Generating agent-first documentation (${docsToRegenerate.join(", ")})...`);
      orchestrator.setStage("document-generation");
      const docGenerator = new DocumentGenerator(provider);
      const rawDocuments = await docGenerator.generateMany(docsToRegenerate, knowledge, scan, evidenceMap);
      logger.success(`${rawDocuments.size} documents generated`);

      logger.info("Filtering redundant content...");
      orchestrator.setStage("redundancy-filter");
      const redundancyFilter = new RedundancyFilter(provider);
      filteredDocuments = await redundancyFilter.filterAll(rawDocuments);
      logger.success("Redundancy filter applied");
    } else {
      logger.info("Incremental regeneration: no document changes required.");
    }

    // 10. Write documents
    const generatedFiles: string[] = [];
    const documentsGenerated: string[] = [];

    for (const docType of docsToRegenerate) {
      const filename = DOCUMENT_FILENAMES[docType];
      const content = filteredDocuments.get(docType);
      if (content) {
        const filePath = resolve(outputDir, filename);
        await writeTextFile(filePath, content);
        generatedFiles.push(filePath);
        documentsGenerated.push(filename);
        logger.success(`Written: ${config.outputPath}/${filename}`);
      }
    }

    const duration = Date.now() - startTime;
    const tokenUsage = orchestrator.getTokenUsageReport();
    const incrementalState: IncrementalState = {
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
      trackedFiles,
      trackedFilesHash,
      cachedSamplesHash: trackedFilesHash
    };
    await this.saveIntermediate(incrementalStatePath, incrementalState);
    this.logTokenUsage(logger, tokenUsage);

    logger.info(
      `Knowledge diff: invariants (+${knowledgeDiffArtifact.summary.invariants.added}/-${knowledgeDiffArtifact.summary.invariants.removed}/~${knowledgeDiffArtifact.summary.invariants.modified}), ` +
      `boundaries (+${knowledgeDiffArtifact.summary.boundaries.allowed.added + knowledgeDiffArtifact.summary.boundaries.prohibited.added}/-` +
      `${knowledgeDiffArtifact.summary.boundaries.allowed.removed + knowledgeDiffArtifact.summary.boundaries.prohibited.removed}/~` +
      `${knowledgeDiffArtifact.summary.boundaries.allowed.modified + knowledgeDiffArtifact.summary.boundaries.prohibited.modified}), ` +
      `decisions (+${knowledgeDiffArtifact.summary.decisions.added}/-${knowledgeDiffArtifact.summary.decisions.removed}/~${knowledgeDiffArtifact.summary.decisions.modified})`
    );
    logger.success(`\nForgeMind complete in ${(duration / 1000).toFixed(1)}s`);

    return {
      executionMode,
      rootPath,
      generatedFiles,
      signals,
      hypothesesCount: hypotheses.length,
      confirmedHypotheses: hypotheses.filter((h) => h.status === "confirmed").length,
      interviewCompleted: structuredAnswers.length > 0,
      documentsGenerated,
      evidenceMapEntries: evidenceMap.length,
      domainCandidatesCount: domainCandidates.length,
      unknownClaims: evidenceMap.filter((entry) => entry.confidence === "unknown").length,
      llmProvider: orchestrator.getProviderName(),
      llmModel: orchestrator.getModelName(),
      tokenUsage,
      qualityGate: qualityGateSummary,
      knowledgeDiff: knowledgeDiffArtifact.summary,
      semanticDrift,
      contradictions,
      duration
    };
  }

  private async loadCached<T>(path: string): Promise<T | null> {
    try {
      if (await fileExists(path)) {
        const content = await readTextFile(path);
        return JSON.parse(content) as T;
      }
    } catch {
      // Cache miss or corrupt — regenerate
    }
    return null;
  }

  private async saveIntermediate(path: string, data: unknown): Promise<void> {
    await writeTextFile(path, stableStringify(data));
  }

  private resolveDocsToRegenerate(
    unchanged: boolean,
    plannedDocs: DocumentType[],
    requiresFullRegeneration: boolean,
    forceFullRegeneration: boolean
  ): DocumentType[] {
    if (forceFullRegeneration) {
      return [...ALL_DOCUMENT_TYPES];
    }

    if (unchanged) {
      return [];
    }

    if (requiresFullRegeneration || plannedDocs.length === 0) {
      return [...ALL_DOCUMENT_TYPES];
    }

    return [...plannedDocs].sort((left, right) => left.localeCompare(right));
  }

  private stabilizeEvidenceEntries(entries: EvidenceEntry[], previousEntries: EvidenceEntry[]): EvidenceEntry[] {
    const previousSignatureToId = new Map<string, string>();
    for (const entry of previousEntries) {
      previousSignatureToId.set(this.evidenceSignature(entry), entry.claimId);
    }

    const signatures = entries
      .map((entry) => ({ entry, signature: this.evidenceSignature(entry) }))
      .sort((left, right) => left.signature.localeCompare(right.signature));

    let nextId = 1;
    const assigned = signatures.map(({ entry, signature }) => {
      const existingId = previousSignatureToId.get(signature);
      const claimId = existingId ?? `claim-${String(nextId++).padStart(4, "0")}`;
      return {
        ...entry,
        claimId
      };
    });

    return assigned.sort((left, right) => left.claimId.localeCompare(right.claimId));
  }

  private evidenceSignature(entry: EvidenceEntry): string {
    const normalizedEvidence = [...entry.evidence]
      .map((reference) => ({
        path: reference.path,
        symbol: reference.symbol ?? "",
        lines: reference.lines ?? ""
      }))
      .sort((left, right) => {
        const leftKey = `${left.path}|${left.symbol}|${left.lines}`;
        const rightKey = `${right.path}|${right.symbol}|${right.lines}`;
        return leftKey.localeCompare(rightKey);
      });

    return hashJson({
      claimType: entry.claimType,
      summary: entry.summary.trim().toLowerCase(),
      confidence: entry.confidence,
      agentImpact: entry.agentImpact.trim().toLowerCase(),
      evidence: normalizedEvidence
    });
  }

  private logTokenUsage(logger: Logger, report: ForgeResult["tokenUsage"]): void {
    logger.info(`Token usage: used=${report.used}/${report.maxBudget}, estimated=${report.estimatedTotal}, actual=${report.actualTotal}`);
    for (const [stage, usage] of Object.entries(report.byStage).sort(([a], [b]) => a.localeCompare(b))) {
      logger.debug(`tokens[${stage}] calls=${usage.calls} estimated=${usage.estimated} actual=${usage.actual}`);
    }
  }
}

function emptyKnowledgeDiffSummary(): KnowledgeDiffSummary {
  return {
    changed: false,
    invariants: { added: 0, removed: 0, modified: 0 },
    boundaries: {
      allowed: { added: 0, removed: 0, modified: 0 },
      prohibited: { added: 0, removed: 0, modified: 0 }
    },
    decisions: { added: 0, removed: 0, modified: 0 },
    cognitiveRisks: { added: 0, removed: 0, modified: 0 }
  };
}
