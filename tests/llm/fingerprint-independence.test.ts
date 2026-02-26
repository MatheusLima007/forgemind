import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FingerprintGenerator } from "../../src/core/generators/contract/fingerprintGenerator.js";
import type { GeneratorContext } from "../../src/core/types/index.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("Fingerprint and LLM enrichment", () => {
  it("keeps docsHash stable when only LLM enrichment blocks change", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-fp-llm-"));
    createdDirs.push(root);

    await mkdir(join(root, "docs"), { recursive: true });
    await writeFile(join(root, "docs", "agent-first.md"), "# Agent\n\nBase deterministic content\n", "utf-8");
    await writeFile(join(root, "docs", "architecture.md"), "# Architecture\n\nBase deterministic content\n", "utf-8");
    await writeFile(join(root, "package.json"), JSON.stringify({ dependencies: { chalk: "1.0.0" } }), "utf-8");

    const context: GeneratorContext = {
      scan: {
        rootPath: root,
        languages: ["typescript"],
        frameworks: ["unknown"],
        structure: { topLevel: ["docs"], secondLevel: { docs: [] } },
        dependencies: {
          packageJson: true,
          composerJson: false,
          packageDependencies: ["chalk"],
          composerDependencies: []
        },
        signals: ["node-project"],
        scannedAt: "2026-01-01T00:00:00.000Z"
      },
      config: {
        compliance: { level: "L1" },
        outputPaths: { docs: "docs", prompts: "prompts", policies: "policies", ai: "ai" },
        ignoreDirs: [".git", "node_modules", "dist", "coverage"],
        ignoreFilePatterns: [".*", "*.tmp"],
        templateOverrides: {}
      }
    };

    const generator = new FingerprintGenerator();
    const baseline = await generator.generate(context);

    const enrichment = "\n<!-- FORGEMIND:LLM_START provider=openai model=gpt-5-mini -->\nnon deterministic llm content\n<!-- FORGEMIND:LLM_END -->\n";
    await writeFile(join(root, "docs", "agent-first.md"), `# Agent\n\nBase deterministic content\n${enrichment}`, "utf-8");

    const withEnrichment = await generator.generate(context);

    expect(withEnrichment.docsHash).toBe(baseline.docsHash);
    expect(withEnrichment.fingerprint).toBe(baseline.fingerprint);
  });
});
