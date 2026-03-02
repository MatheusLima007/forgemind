import { Command } from "commander";
import { resolve } from "node:path";
import { loadConfig } from "../../core/config/configLoader.js";
import { ContextPipeline } from "../../core/orchestrator/contextPipeline.js";
import type { LLMProviderName } from "../../core/types/index.js";
import { Logger } from "../../utils/logger.js";

export function registerForgeCommand(program: Command): void {
  program
    .command("forge")
    .description("Run the full context engineering pipeline: scan → analyze → hypothesize → interview → generate docs")
    .option("--llm <provider>", "LLM provider override (anthropic, openai, openai-compatible, gemini)")
    .option("--skip-interview", "Skip the interactive interview phase", false)
    .option("--force-interview", "Force a new guided interview even if ai/answers.json exists", false)
    .action(async (_, command: Command) => {
      const options = command.optsWithGlobals<{
        root: string;
        config?: string;
        json: boolean;
        verbose: boolean;
        llm?: LLMProviderName;
        skipInterview: boolean;
        forceInterview: boolean;
      }>();

      const rootPath = resolve(options.root);
      const logger = new Logger({ json: options.json, verbose: options.verbose });

      try {
        const config = await loadConfig(rootPath, options.config);
        const pipeline = new ContextPipeline();

        const result = await pipeline.run(rootPath, config, {
          providerOverride: options.llm,
          skipInterview: options.skipInterview,
          forceInterview: options.forceInterview
        }, logger);

        if (options.json) {
          logger.outputJson({
            command: "forge",
            rootPath,
            generatedFiles: result.generatedFiles,
            documentsGenerated: result.documentsGenerated,
            hypothesesCount: result.hypothesesCount,
            confirmedHypotheses: result.confirmedHypotheses,
            interviewCompleted: result.interviewCompleted,
            evidenceMapEntries: result.evidenceMapEntries,
            domainCandidatesCount: result.domainCandidatesCount,
            unknownClaims: result.unknownClaims,
            llmProvider: result.llmProvider,
            llmModel: result.llmModel,
            duration: result.duration
          });
          return;
        }

        logger.info(`Provider: ${result.llmProvider} (${result.llmModel})`);
        logger.info(`Hypotheses: ${result.hypothesesCount} (${result.confirmedHypotheses} confirmed)`);
        logger.info(`Interview: ${result.interviewCompleted ? "completed" : "skipped"}`);
        logger.info(`Documents: ${result.documentsGenerated.join(", ")}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (options.json) {
          logger.outputJson({ command: "forge", rootPath, error: message });
        } else {
          logger.error(message);
        }
        process.exitCode = 1;
      }
    });
}
