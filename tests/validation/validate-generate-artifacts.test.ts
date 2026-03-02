import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultConfig } from "../../src/core/config/defaults.js";
import { GeneratePipeline } from "../../src/core/orchestrator/generatePipeline.js";
import { Validator } from "../../src/core/validation/validator.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("Validator optional generate artifacts", () => {
  it("does not fail when optional artifacts are absent", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-validate-optional-"));
    createdDirs.push(root);

    await writeFile(join(root, "package.json"), JSON.stringify({ name: "fixture", version: "1.0.0" }), "utf-8");
    await new GeneratePipeline().run(root, defaultConfig, { llmProviderName: "none", focus: "auto" });

    const validator = new Validator();
    const result = await validator.validate(root, defaultConfig);
    expect(result.exitCode).toBe(0);
  });

  it("fails when optional artifacts exist but are invalid", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-validate-optional-invalid-"));
    createdDirs.push(root);

    await writeFile(join(root, "package.json"), JSON.stringify({ name: "fixture", version: "1.0.0" }), "utf-8");
    await new GeneratePipeline().run(root, defaultConfig, { llmProviderName: "none", focus: "auto" });

    await writeFile(join(root, "ai", "candidates.json"), JSON.stringify({ version: "1.0.0" }), "utf-8");

    const validator = new Validator();
    const result = await validator.validate(root, defaultConfig);

    expect(result.exitCode).toBe(3);
    expect(result.errors.some((error) => error.includes("Optional artifact schema invalid"))).toBe(true);
  });
});
