import { Command } from "commander";
import { resolve } from "node:path";
import { loadConfig } from "../../core/config/configLoader.js";
import { ForgePipeline } from "../../core/orchestrator/forgePipeline.js";
import { Logger } from "../../utils/logger.js";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize AI-Ready repository governance structure")
    .action(async (_, command: Command) => {
      const options = command.optsWithGlobals<{ root: string; config?: string; json: boolean; verbose: boolean }>();
      const rootPath = resolve(options.root);
      const logger = new Logger({ json: options.json, verbose: options.verbose });

      const config = await loadConfig(rootPath, options.config);
      const pipeline = new ForgePipeline();
      const result = await pipeline.run(rootPath, config);

      if (options.json) {
        logger.outputJson({
          command: "init",
          rootPath,
          generatedFiles: result.generatedFiles,
          fingerprint: result.fingerprint.fingerprint
        });
        return;
      }

      logger.success("ForgeMind structure initialized.");
      for (const file of result.generatedFiles) {
        logger.info(`Generated: ${file}`);
      }
    });
}
