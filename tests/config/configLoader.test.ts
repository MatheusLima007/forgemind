import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../../src/core/config/configLoader.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("loadConfig", () => {
  it("loads default config when unknown fields are provided", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-config-"));
    createdDirs.push(root);

    await writeFile(
      join(root, "forgemind.config.json"),
      JSON.stringify({
        unknownField: {
          key: "value"
        }
      }),
      "utf-8"
    );

    const config = await loadConfig(root);
    expect(config.outputPath).toBe("docs");
  });

  it("accepts openai-compatible provider config", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-config-compatible-"));
    createdDirs.push(root);

    await writeFile(
      join(root, "forgemind.config.json"),
      JSON.stringify({
        llm: {
          enabled: true,
          provider: "openai-compatible",
          baseUrl: "http://localhost:11434/v1",
          model: "local-model",
          temperature: 0.2
        }
      }),
      "utf-8"
    );

    const config = await loadConfig(root);
    expect(config.llm?.provider).toBe("openai-compatible");
  });

  it("throws when llm.baseUrl is empty", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-config-baseurl-"));
    createdDirs.push(root);

    await writeFile(
      join(root, "forgemind.config.json"),
      JSON.stringify({
        llm: {
          enabled: true,
          provider: "openai",
          baseUrl: "",
          model: "gpt-5-mini",
          temperature: 0.2
        }
      }),
      "utf-8"
    );

    await expect(loadConfig(root)).rejects.toThrow("llm.baseUrl must be a non-empty string");
  });

  it("throws when qualityGate.maxPendingRatio is invalid", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-config-quality-gate-"));
    createdDirs.push(root);

    await writeFile(
      join(root, "forgemind.config.json"),
      JSON.stringify({
        qualityGate: {
          minConfidence: 0.6,
          maxPendingRatio: 1.5
        }
      }),
      "utf-8"
    );

    await expect(loadConfig(root)).rejects.toThrow("qualityGate.maxPendingRatio must be a number between 0 and 1");
  });

  it("throws when llm.semanticDriftThreshold is invalid", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-config-drift-threshold-"));
    createdDirs.push(root);

    await writeFile(
      join(root, "forgemind.config.json"),
      JSON.stringify({
        llm: {
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
          temperature: 0.3,
          maxTokensBudget: 12000,
          semanticDriftThreshold: 1.5
        }
      }),
      "utf-8"
    );

    await expect(loadConfig(root)).rejects.toThrow("llm.semanticDriftThreshold must be a number between 0 and 1");
  });
});
