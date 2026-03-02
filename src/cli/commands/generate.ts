import { Command } from "commander";
import { resolve } from "node:path";
import { loadConfig } from "../../core/config/configLoader.js";
import { ContextPipeline } from "../../core/orchestrator/contextPipeline.js";
import type { LLMProviderName } from "../../core/types/index.js";
import { Logger } from "../../utils/logger.js";

export function registerGenerateCommand(program: Command): void {
  program
    .command("generate")
    .description("Generate agent-first docs from existing intermediate data (skips interview)")
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
          skipInterview: true
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
        process.exitCode = 1;
      }
    });
}
