import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultConfig } from "../../src/core/config/defaults.js";
import { ForgePipeline } from "../../src/core/orchestrator/forgePipeline.js";

const createdDirs: string[] = [];
const originalOpenAIKey = process.env.OPENAI_API_KEY;
const originalForgeMindKey = process.env.FORGEMIND_LLM_API_KEY;
const originalBaseUrl = process.env.FORGEMIND_LLM_BASE_URL;

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })));

  if (originalOpenAIKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalOpenAIKey;
  }

  if (originalForgeMindKey === undefined) {
    delete process.env.FORGEMIND_LLM_API_KEY;
  } else {
    process.env.FORGEMIND_LLM_API_KEY = originalForgeMindKey;
  }

  if (originalBaseUrl === undefined) {
    delete process.env.FORGEMIND_LLM_BASE_URL;
  } else {
    process.env.FORGEMIND_LLM_BASE_URL = originalBaseUrl;
  }
});

describe("ForgePipeline with optional LLM", () => {
  it("runs scan with llm provider selected and gracefully skips when key is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.FORGEMIND_LLM_API_KEY;

    const root = await mkdtemp(join(tmpdir(), "forgemind-pipeline-llm-"));
    createdDirs.push(root);

    const pipeline = new ForgePipeline();
    const result = await pipeline.run(root, {
      ...defaultConfig,
      llm: {
        enabled: true,
        provider: "openai",
        model: "gpt-5-mini",
        temperature: 0.2
      }
    }, { llmProviderName: "openai" });

    expect(result.generatedFiles.length).toBeGreaterThan(0);
    expect(result.enrichment.provider).toBe("openai");
    expect(result.enrichment.docsFilesEnriched).toBe(0);
    expect(result.enrichment.promptFilesEnriched).toBe(0);
    expect(result.enrichment.skippedReason).toBe("missing-api-key");
  });

  it("runs deterministic scan without llm", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-pipeline-no-llm-"));
    createdDirs.push(root);

    const pipeline = new ForgePipeline();
    const result = await pipeline.run(root, defaultConfig, { llmProviderName: "none" });

    expect(result.generatedFiles.length).toBeGreaterThan(0);
    expect(result.enrichment.provider).toBe("none");
    expect(result.enrichment.skippedReason).toBe("provider-none");
  });

  it("fails fast in strict mode when provider setup fails", async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.FORGEMIND_LLM_API_KEY;

    const root = await mkdtemp(join(tmpdir(), "forgemind-pipeline-strict-"));
    createdDirs.push(root);

    const pipeline = new ForgePipeline();
    await expect(
      pipeline.run(root, {
        ...defaultConfig,
        llm: {
          enabled: true,
          provider: "openai",
          model: "gpt-5-mini",
          temperature: 0.2
        }
      }, { llmProviderName: "openai", llmStrict: true })
    ).rejects.toThrow("LLM strict mode enabled");
  });
});
