import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileExists } from "../../utils/fileSystem.js";
import type { ForgemindConfig, LLMProviderName } from "../types/index.js";
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

const SUPPORTED_LLM_PROVIDERS: Array<Exclude<LLMProviderName, "none">> = ["openai", "openai-compatible", "anthropic", "azure", "local"];

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

  if (config.llm !== undefined) {
    if (typeof config.llm.enabled !== "boolean") {
      throw new Error("Invalid config: llm.enabled must be a boolean");
    }

    if (!SUPPORTED_LLM_PROVIDERS.includes(config.llm.provider)) {
      throw new Error("Invalid config: llm.provider must be one of openai, openai-compatible, anthropic, azure, local");
    }

    if (typeof config.llm.model !== "string" || config.llm.model.trim() === "") {
      throw new Error("Invalid config: llm.model must be a non-empty string");
    }

    if (typeof config.llm.temperature !== "number" || Number.isNaN(config.llm.temperature) || config.llm.temperature < 0 || config.llm.temperature > 2) {
      throw new Error("Invalid config: llm.temperature must be a number between 0 and 2");
    }

    if (config.llm.apiKey !== undefined && (typeof config.llm.apiKey !== "string" || config.llm.apiKey.trim() === "")) {
      throw new Error("Invalid config: llm.apiKey must be a non-empty string when provided");
    }

    if (config.llm.baseUrl !== undefined && (typeof config.llm.baseUrl !== "string" || config.llm.baseUrl.trim() === "")) {
      throw new Error("Invalid config: llm.baseUrl must be a non-empty string when provided");
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
    templateOverrides: parsed.templateOverrides ?? defaultConfig.templateOverrides,
    llm: {
      enabled: parsed.llm?.enabled ?? defaultConfig.llm?.enabled ?? false,
      provider: parsed.llm?.provider ?? defaultConfig.llm?.provider ?? "openai",
      model: parsed.llm?.model ?? defaultConfig.llm?.model ?? "gpt-5-mini",
      temperature: parsed.llm?.temperature ?? defaultConfig.llm?.temperature ?? 0.2,
      apiKey: parsed.llm?.apiKey ?? defaultConfig.llm?.apiKey,
      baseUrl: parsed.llm?.baseUrl ?? defaultConfig.llm?.baseUrl
    }
  };

  assertValidConfig(merged);
  return merged;
}
