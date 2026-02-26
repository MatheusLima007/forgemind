import { Command } from "commander";
import { resolve } from "node:path";
import { loadConfig } from "../../core/config/configLoader.js";
import { Validator } from "../../core/validation/validator.js";
import { Logger } from "../../utils/logger.js";

export function registerValidateCommand(program: Command): void {
  program
    .command("validate")
    .description("Validate AI-Ready contract and drift status")
    .action(async (_, command: Command) => {
      const options = command.optsWithGlobals<{ root: string; config?: string; json: boolean; verbose: boolean }>();
      const rootPath = resolve(options.root);
      const logger = new Logger({ json: options.json, verbose: options.verbose });

      const config = await loadConfig(rootPath, options.config);
      const validator = new Validator();
      const result = await validator.validate(rootPath, config);

      if (options.json) {
        logger.outputJson(result);
      } else if (result.valid) {
        logger.success("Validation successful. AI contract is consistent.");
      } else {
        logger.error("Validation failed.");
        for (const error of result.errors) {
          logger.warn(error);
        }
      }

      process.exitCode = result.exitCode;
    });
}
