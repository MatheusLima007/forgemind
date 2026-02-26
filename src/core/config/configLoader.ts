import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileExists } from "../../utils/fileSystem.js";
import type { ForgemindConfig } from "../types/index.js";
import { defaultConfig } from "./defaults.js";

function isConfigShape(value: unknown): value is Partial<ForgemindConfig> {
  return typeof value === "object" && value !== null;
}

const SUPPORTED_TEMPLATE_OVERRIDE_KEYS = new Set([
  "docs.agentFirst",
  "docs.architecture",
  "prompts.review",
  "prompts.feature",
  "prompts.refactor",
  "prompts.troubleshooting",
  "policies.checklist",
  "ai.contract"
]);

function assertValidConfig(config: ForgemindConfig): void {
  if (config.compliance.level !== "L1") {
    throw new Error("Invalid config: compliance.level must be 'L1'");
  }

  const outputPaths = config.outputPaths;
  const outputPathEntries: Array<[string, unknown]> = [
    ["docs", outputPaths.docs],
    ["prompts", outputPaths.prompts],
    ["policies", outputPaths.policies],
    ["ai", outputPaths.ai]
  ];

  for (const [key, value] of outputPathEntries) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`Invalid config: outputPaths.${key} must be a non-empty string`);
    }
  }

  if (!Array.isArray(config.ignoreDirs) || config.ignoreDirs.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new Error("Invalid config: ignoreDirs must be an array of non-empty strings");
  }

  if (
    config.ignoreFilePatterns !== undefined &&
    (
      !Array.isArray(config.ignoreFilePatterns) ||
      config.ignoreFilePatterns.some((item) => typeof item !== "string" || item.trim() === "")
    )
  ) {
    throw new Error("Invalid config: ignoreFilePatterns must be an array of non-empty strings");
  }

  if (
    typeof config.templateOverrides !== "object" ||
    config.templateOverrides === null ||
    Array.isArray(config.templateOverrides)
  ) {
    throw new Error("Invalid config: templateOverrides must be an object");
  }

  for (const [key, value] of Object.entries(config.templateOverrides)) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`Invalid config: templateOverrides.${key} must be a non-empty string`);
    }

    if (!SUPPORTED_TEMPLATE_OVERRIDE_KEYS.has(key)) {
      throw new Error(`Invalid config: templateOverrides.${key} is not a supported override key`);
    }
  }
}

export async function loadConfig(rootPath: string, explicitPath?: string): Promise<ForgemindConfig> {
  const configPath = explicitPath ? resolve(explicitPath) : resolve(rootPath, "forgemind.config.json");
  const exists = await fileExists(configPath);

  if (!exists) {
    return defaultConfig;
  }

  const raw = await readFile(configPath, "utf-8");
  const parsed: unknown = JSON.parse(raw);

  if (!isConfigShape(parsed)) {
    return defaultConfig;
  }

  const merged: ForgemindConfig = {
    compliance: {
      level: parsed.compliance?.level ?? defaultConfig.compliance.level
    },
    outputPaths: {
      docs: parsed.outputPaths?.docs ?? defaultConfig.outputPaths.docs,
      prompts: parsed.outputPaths?.prompts ?? defaultConfig.outputPaths.prompts,
      policies: parsed.outputPaths?.policies ?? defaultConfig.outputPaths.policies,
      ai: parsed.outputPaths?.ai ?? defaultConfig.outputPaths.ai
    },
    ignoreDirs: parsed.ignoreDirs ?? defaultConfig.ignoreDirs,
    ignoreFilePatterns: parsed.ignoreFilePatterns ?? defaultConfig.ignoreFilePatterns,
    templateOverrides: parsed.templateOverrides ?? defaultConfig.templateOverrides
  };

  assertValidConfig(merged);
  return merged;
}
