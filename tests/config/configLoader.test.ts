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
  it("throws on unsupported template override keys", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-config-"));
    createdDirs.push(root);

    await writeFile(
      join(root, "forgemind.config.json"),
      JSON.stringify({
        templateOverrides: {
          "docs.invalidKey": "templates/invalid.md"
        }
      }),
      "utf-8"
    );

    await expect(loadConfig(root)).rejects.toThrow("is not a supported override key");
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
});
