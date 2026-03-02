import { Command } from "commander";
import { resolve } from "node:path";
import { loadConfig } from "../../core/config/configLoader.js";
import { ContextPipeline } from "../../core/orchestrator/contextPipeline.js";
import type { LLMProviderName } from "../../core/types/index.js";
import { Logger } from "../../utils/logger.js";
import { TokenBudgetExceededError, QualityGateBlockedError } from "../../core/errors/pipelineErrors.js";
import { EXIT_CODES } from "../exitCodes.js";

export function registerInterviewCommand(program: Command): void {
  program
    .command("interview")
    .description("Run only the interactive developer interview (scan + hypothesize + interview)")
    .option("--llm <provider>", "LLM provider override (anthropic, openai, openai-compatible, gemini)")
    .action(async (_, command: Command) => {
      const options = command.optsWithGlobals<{
        root: string;
        config?: string;
        json: boolean;
        verbose: boolean;
        llm?: LLMProviderName;
      }>();

      const rootPath = resolve(options.root);
      const logger = new Logger({ json: options.json, verbose: options.verbose });

      try {
        const config = await loadConfig(rootPath, options.config);
        const pipeline = new ContextPipeline();

        const result = await pipeline.run(rootPath, config, {
          providerOverride: options.llm,
          interviewOnly: true
        }, logger);

        if (options.json) {
          logger.outputJson({
            command: "interview",
            rootPath,
            hypothesesCount: result.hypothesesCount,
            interviewCompleted: result.interviewCompleted,
            confirmedHypotheses: result.confirmedHypotheses,
            evidenceMapEntries: result.evidenceMapEntries,
            domainCandidatesCount: result.domainCandidatesCount,
            unknownClaims: result.unknownClaims,
            tokenUsage: result.tokenUsage,
            qualityGate: result.qualityGate,
            duration: result.duration
          });
          return;
        }

        logger.success("Interview saved. Run 'forgemind generate' to generate docs from existing evidence and answers.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (options.json) {
          logger.outputJson({ command: "interview", rootPath, error: message });
        } else {
          logger.error(message);
        }
        if (error instanceof TokenBudgetExceededError) {
          process.exitCode = EXIT_CODES.TOKEN_BUDGET_EXHAUSTED;
        } else if (error instanceof QualityGateBlockedError) {
          process.exitCode = EXIT_CODES.QUALITY_GATE_BLOCKED;
        } else {
          process.exitCode = EXIT_CODES.GENERAL_ERROR;
        }
      }
    });
}
