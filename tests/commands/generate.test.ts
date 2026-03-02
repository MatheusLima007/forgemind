import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultConfig } from "../../src/core/config/defaults.js";
import { GeneratePipeline } from "../../src/core/orchestrator/generatePipeline.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("GeneratePipeline", () => {
  it("generates all core artifacts with llm none and deterministic fallback", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-generate-"));
    createdDirs.push(root);

    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "package.json"), JSON.stringify({ name: "fixture", dependencies: { "@nestjs/core": "^10.0.0" } }), "utf-8");
    await writeFile(
      join(root, "src", "app.module.ts"),
      "import { Module } from '@nestjs/common';\n@Module({})\nexport class AppModule {}\n",
      "utf-8"
    );
    await writeFile(
      join(root, "src", "app.controller.ts"),
      "import { Controller, Get } from '@nestjs/common';\n@Controller('health')\nexport class AppController {\n  @Get()\n  ping() { return 'ok'; }\n}\n",
      "utf-8"
    );

    const pipeline = new GeneratePipeline();
    const result = await pipeline.run(root, defaultConfig, { llmProviderName: "none", focus: "auto" });

    expect(result.qualityGate.passed).toBe(true);
    expect(result.generatedFiles.length).toBeGreaterThanOrEqual(10);

    await expect(readFile(join(root, "ai", "candidates.json"), "utf-8")).resolves.toContain("files");
    await expect(readFile(join(root, "ai", "profile.json"), "utf-8")).resolves.toContain("routingStyle");
    await expect(readFile(join(root, "ai", "index.json"), "utf-8")).resolves.toContain("evidence");
    await expect(readFile(join(root, "docs", "agent-first.md"), "utf-8")).resolves.toContain("## Evidence");
  });

  it("fails quality gate when evidence threshold is not met", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-generate-evidence-"));
    createdDirs.push(root);

    await writeFile(join(root, "package.json"), JSON.stringify({ name: "fixture" }), "utf-8");

    const pipeline = new GeneratePipeline();
    const result = await pipeline.run(
      root,
      {
        ...defaultConfig,
        generate: {
          ...defaultConfig.generate,
          evidence: {
            required: true,
            minPerSection: 100
          }
        }
      },
      { llmProviderName: "none", focus: "auto" }
    );

    expect(result.qualityGate.passed).toBe(false);
    expect(result.qualityGate.errors.some((error) => error.includes("Evidence threshold"))).toBe(true);
  });
});
