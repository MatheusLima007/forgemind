import type { ForgemindConfig } from "../types/index.js";

export const FORGEMIND_VERSION = "0.2.0";

export const defaultConfig: ForgemindConfig = {
  outputPath: "docs",
  intermediatePath: "ai",
  ignoreDirs: [".git", "node_modules", "dist", "coverage", "__pycache__", ".venv", "venv", "vendor", "target", "build"],
  ignoreFilePatterns: [".*", "*.tmp", "*.temp", "*.swp", "*.swo", "*.bak", "*~"],
  llm: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    temperature: 0.3,
    maxTokensBudget: 30000,
    semanticDriftThreshold: 0.35
  },
  qualityGate: {
    minConfidence: 0.65,
    maxPendingRatio: 0.45
  },
  interview: {
    maxQuestions: 15,
    adaptiveFollowUp: true,
    language: "en"
  }
};
