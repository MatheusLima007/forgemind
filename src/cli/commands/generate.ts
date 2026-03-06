import { Command } from "commander";
import { resolve } from "node:path";
import { loadConfig } from "../../core/config/configLoader.js";
import { ContextPipeline } from "../../core/orchestrator/contextPipeline.js";
import type { LLMProviderName } from "../../core/types/index.js";
import { Logger } from "../../utils/logger.js";
import { TokenBudgetExceededError, QualityGateBlockedError, SemanticDriftBlockedError } from "../../core/errors/pipelineErrors.js";
import { EXIT_CODES } from "../exitCodes.js";

export function registerGenerateCommand(program: Command): void {
  program
    .command("generate")
    .description("Generate agent-first docs from existing intermediate data (skips interview)")
    .option("--llm <provider>", "LLM provider override (anthropic, openai, openai-compatible, gemini)")
    .option("--accept-drift", "Accept semantic drift when provider/model changed", false)
    .action(async (_, command: Command) => {
      const options = command.optsWithGlobals<{
        root: string;
        config?: string;
        json: boolean;
        verbose: boolean;
        llm?: LLMProviderName;
        acceptDrift: boolean;
      }>();

      const rootPath = resolve(options.root);
      const logger = new Logger({ json: options.json, verbose: options.verbose });

      try {
        const config = await loadConfig(rootPath, options.config);
        const pipeline = new ContextPipeline();

        const result = await pipeline.run(rootPath, config, {
          providerOverride: options.llm,
          skipInterview: true,
          acceptDrift: options.acceptDrift,
          allowInteractiveInterviewOnDrift: false
        }, logger);

        if (options.json) {
          logger.outputJson({
            command: "generate",
            rootPath,
            generatedFiles: result.generatedFiles,
            documentsGenerated: result.documentsGenerated,
            evidenceMapEntries: result.evidenceMapEntries,
            domainCandidatesCount: result.domainCandidatesCount,
            unknownClaims: result.unknownClaims,
            llmProvider: result.llmProvider,
            llmModel: result.llmModel,
            tokenUsage: result.tokenUsage,
            qualityGate: result.qualityGate,
            knowledgeDiff: result.knowledgeDiff,
            semanticDrift: result.semanticDrift,
            contradictions: result.contradictions,
            duration: result.duration
          });
          return;
        }

        logger.success(`${result.documentsGenerated.length} documents generated.`);
        for (const doc of result.documentsGenerated) {
          logger.info(`  ${doc}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (options.json) {
          logger.outputJson({ command: "generate", rootPath, error: message });
        } else {
          logger.error(message);
        }
        if (error instanceof TokenBudgetExceededError) {
          process.exitCode = EXIT_CODES.TOKEN_BUDGET_EXHAUSTED;
        } else if (error instanceof QualityGateBlockedError) {
          process.exitCode = EXIT_CODES.QUALITY_GATE_BLOCKED;
        } else if (error instanceof SemanticDriftBlockedError) {
          process.exitCode = EXIT_CODES.SEMANTIC_DRIFT_BLOCKED;
        } else {
          process.exitCode = EXIT_CODES.GENERAL_ERROR;
        }
      }
    });
}
