import { Command } from "commander";
import { resolve } from "node:path";
import { ensureDir, fileExists, writeTextFile } from "../../utils/fileSystem.js";
import { defaultConfig, FORGEMIND_VERSION } from "../../core/config/defaults.js";
import { stableStringify } from "../../utils/hashing.js";
import { Logger } from "../../utils/logger.js";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize ForgeMind configuration and directory structure")
    .action(async (_, command: Command) => {
      const options = command.optsWithGlobals<{ root: string; json: boolean; verbose: boolean }>();
      const rootPath = resolve(options.root);
      const logger = new Logger({ json: options.json, verbose: options.verbose });

      const configPath = resolve(rootPath, "forgemind.config.json");
      const createdFiles: string[] = [];

      // Create config file if it doesn't exist
      if (!(await fileExists(configPath))) {
        await writeTextFile(configPath, stableStringify(defaultConfig));
        createdFiles.push("forgemind.config.json");
        logger.success("Created forgemind.config.json");
      } else {
        logger.info("forgemind.config.json already exists");
      }

      // Create output directories
      const outputDir = resolve(rootPath, defaultConfig.outputPath);
      const intermediateDir = resolve(rootPath, defaultConfig.intermediatePath);

      await ensureDir(outputDir);
      await ensureDir(intermediateDir);
      createdFiles.push(defaultConfig.outputPath + "/", defaultConfig.intermediatePath + "/");

      logger.success(`Output directory: ${defaultConfig.outputPath}/`);
      logger.success(`Intermediate directory: ${defaultConfig.intermediatePath}/`);

      if (options.json) {
        logger.outputJson({
          command: "init",
          rootPath,
          version: FORGEMIND_VERSION,
          createdFiles
        });
        return;
      }

      logger.success(`ForgeMind v${FORGEMIND_VERSION} initialized. Run 'forgemind forge' to start.`);
    });
}
