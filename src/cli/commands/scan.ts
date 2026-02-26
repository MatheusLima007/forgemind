import { Command } from "commander";
import { resolve } from "node:path";
import { loadConfig } from "../../core/config/configLoader.js";
import { ForgePipeline } from "../../core/orchestrator/forgePipeline.js";
import { Logger } from "../../utils/logger.js";

export function registerScanCommand(program: Command): void {
  program
    .command("scan")
    .description("Scan repository and refresh AI governance artifacts")
    .action(async (_, command: Command) => {
      const options = command.optsWithGlobals<{ root: string; config?: string; json: boolean; verbose: boolean }>();
      const rootPath = resolve(options.root);
      const logger = new Logger({ json: options.json, verbose: options.verbose });

      const config = await loadConfig(rootPath, options.config);
      const pipeline = new ForgePipeline();
      const result = await pipeline.run(rootPath, config);

      if (options.json) {
        logger.outputJson({
          command: "scan",
          rootPath,
          generatedFiles: result.generatedFiles,
          fingerprint: result.fingerprint
        });
        return;
      }

      logger.success("Scan complete. Governance artifacts updated.");
      logger.info(`Fingerprint: ${result.fingerprint.fingerprint}`);
      logger.info(`Files generated: ${result.generatedFiles.length}`);
    });
}
