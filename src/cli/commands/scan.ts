import { Command } from "commander";
import { resolve } from "node:path";
import { loadConfig } from "../../core/config/configLoader.js";
import { ForgePipeline } from "../../core/orchestrator/forgePipeline.js";
import type { LLMProviderName } from "../../core/types/index.js";
import { Logger } from "../../utils/logger.js";

export function registerScanCommand(program: Command): void {
  program
    .command("scan")
    .description("Scan repository and refresh AI governance artifacts")
    .option("--llm <provider>", "LLM provider for optional enrichment (openai, openai-compatible, anthropic, azure, local, none)", "none")
    .option("--llm-strict", "Fail scan when LLM enrichment fails", false)
    .action(async (_, command: Command) => {
      const options = command.optsWithGlobals<{ root: string; config?: string; json: boolean; verbose: boolean; llm: LLMProviderName; llmStrict: boolean }>();
      const rootPath = resolve(options.root);
      const logger = new Logger({ json: options.json, verbose: options.verbose });

      try {
        const config = await loadConfig(rootPath, options.config);
        const pipeline = new ForgePipeline();
        const result = await pipeline.run(rootPath, config, {
          llmProviderName: options.llm,
          llmStrict: options.llmStrict
        });

        if (options.json) {
          logger.outputJson({
            command: "scan",
            rootPath,
            generatedFiles: result.generatedFiles,
            fingerprint: result.fingerprint,
            enrichment: result.enrichment
          });
          return;
        }

        logger.success("Scan complete. Governance artifacts updated.");
        logger.info(`Fingerprint: ${result.fingerprint.fingerprint}`);
        logger.info(`Files generated: ${result.generatedFiles.length}`);
        logger.info(
          `LLM enrichment: provider=${result.enrichment.provider}, docs=${result.enrichment.docsFilesEnriched}, prompts=${result.enrichment.promptFilesEnriched}${result.enrichment.skippedReason ? `, reason=${result.enrichment.skippedReason}` : ""}`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown scan failure";
        if (options.json) {
          logger.outputJson({
            command: "scan",
            rootPath,
            error: message
          });
        } else {
          logger.error(message);
        }
        process.exitCode = 1;
      }
    });
}
