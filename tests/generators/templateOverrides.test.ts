import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, expect, afterEach } from "vitest";
import { DocumentationGenerator } from "../../src/core/generators/documentation/documentationGenerator.js";
import type { GeneratorContext } from "../../src/core/types/index.js";
import { readTextFile } from "../../src/utils/fileSystem.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("Template overrides", () => {
  it("uses docs.agentFirst override template with placeholders", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-override-"));
    createdDirs.push(root);

    await mkdir(join(root, "templates"), { recursive: true });
    await writeFile(
      join(root, "templates", "agent-first.override.md"),
      "# Custom Agent First\nLanguages: {{scan.languages}}\nFrameworks: {{scan.frameworks}}\nRaw: {{scan.json}}\n",
      "utf-8"
    );

    const context: GeneratorContext = {
      scan: {
        rootPath: root,
        languages: ["typescript", "javascript"],
        frameworks: ["unknown"],
        structure: { topLevel: ["src"], secondLevel: { src: [] } },
        dependencies: {
          packageJson: true,
          composerJson: false,
          packageDependencies: ["commander"],
          composerDependencies: []
        },
        signals: ["node-project"],
        scannedAt: new Date().toISOString()
      },
      config: {
        compliance: { level: "L1" },
        outputPaths: { docs: "docs", prompts: "prompts", policies: "policies", ai: "ai" },
        ignoreDirs: [".git", "node_modules", "dist", "coverage"],
        templateOverrides: {
          "docs.agentFirst": "templates/agent-first.override.md"
        }
      }
    };

    const generator = new DocumentationGenerator();
    await generator.generate(context);

    const generated = await readTextFile(join(root, "docs", "agent-first.md"));
    expect(generated).toContain("# Custom Agent First");
    expect(generated).toContain("Languages: typescript, javascript");
    expect(generated).toContain("Frameworks: unknown");
    expect(generated).not.toContain("scannedAt");
  });
});
