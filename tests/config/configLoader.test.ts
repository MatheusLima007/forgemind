import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
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
});
