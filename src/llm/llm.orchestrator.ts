import { relative } from "node:path";
import { readTextFile, writeTextFile } from "../utils/fileSystem.js";
import type { AIContract, GeneratorContext, LLMGenerationType, LLMOutput } from "../core/types/index.js";
import { buildRepoFacts } from "../core/repoFacts.builder.js";
import { validateLLMOutputSchema } from "../core/validation/llmResponseSchema.js";
import { normalizeToPosixPath } from "../utils/path.js";
import type { LLMProvider } from "./provider.interface.js";

const LLM_START_MARKER_PATTERN = "<!-- FORGEMIND:LLM_START";
const LLM_END_MARKER = "<!-- FORGEMIND:LLM_END -->";

function sanitizeAttribute(value: string): string {
  return value.replaceAll("\n", " ").replaceAll("\r", " ").replaceAll("\"", "'").trim();
}

function buildStartMarker(output: LLMOutput): string {
  const provider = sanitizeAttribute(output.metadata.provider);
  const model = sanitizeAttribute(output.metadata.model);
  return `<!-- FORGEMIND:LLM_START provider=${provider} model=${model} -->`;
}

function stripMarkers(content: string): string {
  return content
    .replace(/<!-- FORGEMIND:LLM_START[^>]*-->[\s\S]*?<!-- FORGEMIND:LLM_END -->\n?/g, "")
    .replace(/<!-- FORGEMIND:LLM_ENRICHMENT_START -->[\s\S]*?<!-- FORGEMIND:LLM_ENRICHMENT_END -->\n?/g, "")
    .trimEnd();
}

function ensureStructuredOutput(output: unknown): LLMOutput {
  if (!validateLLMOutputSchema(output)) {
    throw new Error("Invalid LLM output schema");
  }

  return output;
}

function normalizeEnrichedContent(output: LLMOutput): Record<string, string> {
  if (typeof output !== "object" || output === null) {
    throw new Error("Invalid LLM output: expected object");
  }

  if (typeof output.enrichedContent !== "object" || output.enrichedContent === null || Array.isArray(output.enrichedContent)) {
    throw new Error("Invalid LLM output: enrichedContent must be an object");
  }

  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(output.enrichedContent)) {
    if (typeof value !== "string") {
      throw new Error(`Invalid LLM output: enrichedContent.${key} must be a string`);
    }
    normalized[key] = value.trim();
  }

  return normalized;
}

function mergeContent(baseContent: string, enrichment: string, output: LLMOutput): string {
  const trimmedBase = baseContent.trimEnd();
  const strippedBase = stripMarkers(trimmedBase);

  if (enrichment.trim() === "") {
    return `${strippedBase}\n`;
  }

  return `${strippedBase}\n\n${buildStartMarker(output)}\n${enrichment.trim()}\n${LLM_END_MARKER}\n`;
}

export function stripLLMEnrichmentBlocks(content: string): string {
  return stripMarkers(content);
}

export interface LLMEnrichmentResult {
  generationType: LLMGenerationType;
  appliedFiles: string[];
  skippedReason?: string;
}

export class LLMOrchestrator {
  async enrichFiles(
    provider: LLMProvider | null,
    context: GeneratorContext,
    contractData: AIContract,
    generationType: LLMGenerationType,
    files: string[],
    strictMode = false
  ): Promise<LLMEnrichmentResult> {
    if (!provider) {
      if (strictMode) {
        throw new Error("LLM strict mode enabled but provider is unavailable");
      }
      return { generationType, appliedFiles: [], skippedReason: "provider-unavailable" };
    }

    try {
      const currentDocs: Record<string, string> = {};
      const fileKeyToPath: Record<string, string> = {};
      for (const filePath of files) {
        const key = normalizeToPosixPath(relative(context.scan.rootPath, filePath));
        currentDocs[key] = await readTextFile(filePath);
        fileKeyToPath[key] = filePath;
      }

      const output = await provider.generate({
        repoFacts: buildRepoFacts(context),
        contractData,
        currentDocs,
        generationType
      });
      const validOutput = ensureStructuredOutput(output);
      const enrichedContent = normalizeEnrichedContent(validOutput);

      const appliedFiles: string[] = [];
      for (const [fileKey, filePath] of Object.entries(fileKeyToPath)) {
        const baseContent = currentDocs[fileKey];
        const enrichment = enrichedContent[fileKey] ?? "";
        const merged = mergeContent(baseContent, enrichment, validOutput);
        await writeTextFile(filePath, merged);
        appliedFiles.push(filePath);
      }

      return { generationType, appliedFiles };
    } catch (error) {
      if (strictMode) {
        throw error;
      }

      return { generationType, appliedFiles: [], skippedReason: "provider-failed" };
    }
  }
}
