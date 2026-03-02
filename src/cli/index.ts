#!/usr/bin/env node
import { Command } from "commander";
import { registerInitCommand } from "./commands/init.js";
import { registerForgeCommand } from "./commands/forge.js";
import { registerInterviewCommand } from "./commands/interview.js";
import { registerGenerateCommand } from "./commands/generate.js";
import { FORGEMIND_VERSION } from "../core/config/defaults.js";

const program = new Command();

program
  .name("forgemind")
  .description("ForgeMind — AI Context Engineering Engine")
  .version(FORGEMIND_VERSION)
  .option("-r, --root <path>", "Repository root path", process.cwd())
  .option("-c, --config <path>", "Configuration file path")
  .option("--json", "Output in JSON format", false)
  .option("-v, --verbose", "Enable verbose output", false);

registerInitCommand(program);
registerForgeCommand(program);
registerInterviewCommand(program);
registerGenerateCommand(program);

program.parseAsync(process.argv);
