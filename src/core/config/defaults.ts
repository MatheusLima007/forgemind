import type { ForgemindConfig } from "../types/index.js";

export const defaultConfig: ForgemindConfig = {
  compliance: {
    level: "L1"
  },
  outputPaths: {
    docs: "docs",
    prompts: "prompts",
    policies: "policies",
    ai: "ai"
  },
  ignoreDirs: [".git", "node_modules", "dist", "coverage"],
  ignoreFilePatterns: [".*", "*.tmp", "*.temp", "*.swp", "*.swo", "*.bak", "*~"],
  templateOverrides: {}
};
