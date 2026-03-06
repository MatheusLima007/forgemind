import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileExists } from "../../utils/fileSystem.js";
import type { ForgemindConfig, LLMProviderName } from "../types/index.js";
import { defaultConfig } from "./defaults.js";

function isConfigShape(value: unknown): value is Partial<ForgemindConfig> {
  return typeof value === "object" && value !== null;
}

const SUPPORTED_LLM_PROVIDERS: Array<Exclude<LLMProviderName, "none">> = [
  "openai", "openai-compatible", "anthropic", "azure", "gemini", "local"
];

function assertValidConfig(config: ForgemindConfig): void {
  if (typeof config.outputPath !== "string" || config.outputPath.trim() === "") {
    throw new Error("Invalid config: outputPath must be a non-empty string");
  }

  if (typeof config.intermediatePath !== "string" || config.intermediatePath.trim() === "") {
    throw new Error("Invalid config: intermediatePath must be a non-empty string");
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

  // LLM config validation
  if (!SUPPORTED_LLM_PROVIDERS.includes(config.llm.provider)) {
    throw new Error("Invalid config: llm.provider must be one of openai, openai-compatible, anthropic, azure, gemini, local");
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

  if (typeof config.llm.maxTokensBudget !== "number" || config.llm.maxTokensBudget < 1000) {
    throw new Error("Invalid config: llm.maxTokensBudget must be a number >= 1000");
  }

  if (
    config.llm.semanticDriftThreshold !== undefined &&
    (typeof config.llm.semanticDriftThreshold !== "number" ||
      Number.isNaN(config.llm.semanticDriftThreshold) ||
      config.llm.semanticDriftThreshold < 0 ||
      config.llm.semanticDriftThreshold > 1)
  ) {
    throw new Error("Invalid config: llm.semanticDriftThreshold must be a number between 0 and 1");
  }

  if (typeof config.qualityGate.minConfidence !== "number" || Number.isNaN(config.qualityGate.minConfidence) || config.qualityGate.minConfidence < 0 || config.qualityGate.minConfidence > 1) {
    throw new Error("Invalid config: qualityGate.minConfidence must be a number between 0 and 1");
  }

  if (typeof config.qualityGate.maxPendingRatio !== "number" || Number.isNaN(config.qualityGate.maxPendingRatio) || config.qualityGate.maxPendingRatio < 0 || config.qualityGate.maxPendingRatio > 1) {
    throw new Error("Invalid config: qualityGate.maxPendingRatio must be a number between 0 and 1");
  }

  // Interview config validation
  if (typeof config.interview.maxQuestions !== "number" || config.interview.maxQuestions < 1 || config.interview.maxQuestions > 50) {
    throw new Error("Invalid config: interview.maxQuestions must be a number between 1 and 50");
  }

  if (typeof config.interview.adaptiveFollowUp !== "boolean") {
    throw new Error("Invalid config: interview.adaptiveFollowUp must be a boolean");
  }

  if (typeof config.interview.language !== "string" || config.interview.language.trim() === "") {
    throw new Error("Invalid config: interview.language must be a non-empty string");
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
    outputPath: (parsed as Record<string, unknown>).outputPath as string ?? defaultConfig.outputPath,
    intermediatePath: (parsed as Record<string, unknown>).intermediatePath as string ?? defaultConfig.intermediatePath,
    ignoreDirs: parsed.ignoreDirs ?? defaultConfig.ignoreDirs,
    ignoreFilePatterns: parsed.ignoreFilePatterns ?? defaultConfig.ignoreFilePatterns,
    llm: {
      provider: parsed.llm?.provider ?? defaultConfig.llm.provider,
      model: parsed.llm?.model ?? defaultConfig.llm.model,
      temperature: parsed.llm?.temperature ?? defaultConfig.llm.temperature,
      apiKey: parsed.llm?.apiKey ?? defaultConfig.llm.apiKey,
      baseUrl: parsed.llm?.baseUrl ?? defaultConfig.llm.baseUrl,
      maxTokensBudget: parsed.llm?.maxTokensBudget ?? defaultConfig.llm.maxTokensBudget,
      semanticDriftThreshold: parsed.llm?.semanticDriftThreshold ?? defaultConfig.llm.semanticDriftThreshold
    },
    qualityGate: {
      minConfidence: parsed.qualityGate?.minConfidence ?? defaultConfig.qualityGate.minConfidence,
      maxPendingRatio: parsed.qualityGate?.maxPendingRatio ?? defaultConfig.qualityGate.maxPendingRatio
    },
    interview: {
      maxQuestions: parsed.interview?.maxQuestions ?? defaultConfig.interview.maxQuestions,
      adaptiveFollowUp: parsed.interview?.adaptiveFollowUp ?? defaultConfig.interview.adaptiveFollowUp,
      language: parsed.interview?.language ?? defaultConfig.interview.language
    }
  };

  assertValidConfig(merged);
  return merged;
}
