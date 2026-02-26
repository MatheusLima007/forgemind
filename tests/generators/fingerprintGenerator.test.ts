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

describe("FingerprintGenerator", () => {
  it("produces deterministic fingerprint for same inputs", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-fp-"));
    createdDirs.push(root);

    await mkdir(join(root, "docs"), { recursive: true });
    await writeFile(join(root, "docs", "agent-first.md"), "# Agent", "utf-8");
    await writeFile(join(root, "docs", "architecture.md"), "# Arch", "utf-8");
    await writeFile(join(root, "package.json"), JSON.stringify({ dependencies: { react: "1.0.0" } }), "utf-8");

    const context: GeneratorContext = {
      scan: {
        rootPath: root,
        languages: ["typescript"],
        frameworks: ["react"],
        structure: { topLevel: ["docs"], secondLevel: { docs: [] } },
        dependencies: {
          packageJson: true,
          composerJson: false,
          packageDependencies: ["react"],
          composerDependencies: []
        },
        signals: ["node-project"],
        scannedAt: new Date().toISOString()
      },
      config: {
        compliance: { level: "L1" },
        outputPaths: { docs: "docs", prompts: "prompts", policies: "policies", ai: "ai" },
        ignoreDirs: [".git", "node_modules", "dist", "coverage"],
        templateOverrides: {}
      }
    };

    const generator = new FingerprintGenerator();
    const one = await generator.generate(context);
    const two = await generator.generate(context);

    expect(one.fingerprint).toBe(two.fingerprint);
  });

  it("ignores dotfiles and temporary files in fingerprint scope", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-fp-ignore-"));
    createdDirs.push(root);

    await mkdir(join(root, "docs"), { recursive: true });
    await writeFile(join(root, "docs", "agent-first.md"), "# Agent", "utf-8");
    await writeFile(join(root, "docs", "architecture.md"), "# Arch", "utf-8");
    await writeFile(join(root, "package.json"), JSON.stringify({ dependencies: { react: "1.0.0" } }), "utf-8");

    const context: GeneratorContext = {
      scan: {
        rootPath: root,
        languages: ["typescript"],
        frameworks: ["react"],
        structure: { topLevel: ["docs"], secondLevel: { docs: [] } },
        dependencies: {
          packageJson: true,
          composerJson: false,
          packageDependencies: ["react"],
          composerDependencies: []
        },
        signals: ["node-project"],
        scannedAt: new Date().toISOString()
      },
      config: {
        compliance: { level: "L1" },
        outputPaths: { docs: "docs", prompts: "prompts", policies: "policies", ai: "ai" },
        ignoreDirs: [".git", "node_modules", "dist", "coverage"],
        templateOverrides: {}
      }
    };

    const generator = new FingerprintGenerator();
    const baseline = await generator.generate(context);

    await writeFile(join(root, ".env"), "SECRET=true\n", "utf-8");
    await writeFile(join(root, "docs", "notes.tmp"), "ephemeral", "utf-8");
    await writeFile(join(root, "scratch.swp"), "ephemeral", "utf-8");

    const afterNoise = await generator.generate(context);

    expect(afterNoise.structureHash).toBe(baseline.structureHash);
    expect(afterNoise.docsHash).toBe(baseline.docsHash);
    expect(afterNoise.fingerprint).toBe(baseline.fingerprint);
  });

  it("allows overriding ignore file patterns via config", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-fp-override-"));
    createdDirs.push(root);

    await mkdir(join(root, "docs"), { recursive: true });
    await writeFile(join(root, "docs", "agent-first.md"), "# Agent", "utf-8");
    await writeFile(join(root, "docs", "architecture.md"), "# Arch", "utf-8");
    await writeFile(join(root, "package.json"), JSON.stringify({ dependencies: { react: "1.0.0" } }), "utf-8");

    const context: GeneratorContext = {
      scan: {
        rootPath: root,
        languages: ["typescript"],
        frameworks: ["react"],
        structure: { topLevel: ["docs"], secondLevel: { docs: [] } },
        dependencies: {
          packageJson: true,
          composerJson: false,
          packageDependencies: ["react"],
          composerDependencies: []
        },
        signals: ["node-project"],
        scannedAt: new Date().toISOString()
      },
      config: {
        compliance: { level: "L1" },
        outputPaths: { docs: "docs", prompts: "prompts", policies: "policies", ai: "ai" },
        ignoreDirs: [".git", "node_modules", "dist", "coverage"],
        ignoreFilePatterns: [],
        templateOverrides: {}
      }
    };

    const generator = new FingerprintGenerator();
    const baseline = await generator.generate(context);

    await writeFile(join(root, ".env"), "SECRET=true\n", "utf-8");
    const withDotfile = await generator.generate(context);

    expect(withDotfile.structureHash).not.toBe(baseline.structureHash);
    expect(withDotfile.fingerprint).not.toBe(baseline.fingerprint);
  });
});
