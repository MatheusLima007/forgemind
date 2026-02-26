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
  templateOverrides: {},
  llm: {
    enabled: false,
    provider: "openai",
    model: "gpt-5-mini",
    temperature: 0.2,
    baseUrl: "https://api.openai.com/v1"
  }
};
