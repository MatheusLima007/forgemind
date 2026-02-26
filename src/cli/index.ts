#!/usr/bin/env node
import { Command } from "commander";
import { registerInitCommand } from "./commands/init.js";
import { registerScanCommand } from "./commands/scan.js";
import { registerValidateCommand } from "./commands/validate.js";

const program = new Command();

program
  .name("forgemind")
  .description("ForgeMind AI Toolkit - AI-Ready Repository Governance CLI")
  .version("0.1.0")
  .option("-r, --root <path>", "Repository root path", process.cwd())
  .option("-c, --config <path>", "Configuration file path")
  .option("--json", "Output in JSON format", false)
  .option("-v, --verbose", "Enable verbose output", false);

registerInitCommand(program);
registerScanCommand(program);
registerValidateCommand(program);

program.parseAsync(process.argv);
