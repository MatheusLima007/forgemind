import { describe, expect, it } from "vitest";
import { buildRepoFacts } from "../../src/core/repoFacts.builder.js";
import type { GeneratorContext } from "../../src/core/types/index.js";

describe("buildRepoFacts", () => {
  it("builds structured repo facts from scan context", () => {
    const context: GeneratorContext = {
      scan: {
        rootPath: "/tmp/repo",
        languages: ["typescript"],
        frameworks: ["nestjs"],
        structure: {
          topLevel: ["src", "docs"],
          secondLevel: { src: ["core"] }
        },
        dependencies: {
          packageJson: true,
          composerJson: false,
          packageDependencies: ["@nestjs/core", "chalk"],
          composerDependencies: []
        },
        signals: ["node-project"],
        scannedAt: "2026-01-01T00:00:00.000Z"
      },
      config: {
        compliance: { level: "L1" },
        outputPaths: { docs: "docs", prompts: "prompts", policies: "policies", ai: "ai" },
        ignoreDirs: [".git", "node_modules"],
        ignoreFilePatterns: [".*"],
        templateOverrides: {},
        llm: {
          enabled: false,
          provider: "openai",
          model: "gpt-5-mini",
          temperature: 0.2
        }
      }
    };

    const facts = buildRepoFacts(context);

    expect(facts.languages).toEqual(["typescript"]);
    expect(facts.frameworks).toEqual(["nestjs"]);
    expect(facts.topLevelStructure).toEqual(["src", "docs"]);
    expect(facts.dependencySummary.files).toEqual(["package.json"]);
    expect(facts.dependencySummary.packageDependenciesCount).toBe(2);
    expect(facts.dependencySummary.composerDependenciesCount).toBe(0);
    expect(facts.architecturalSignals).toEqual(["node-project"]);
    expect(facts.complianceLevel).toBe("L1");
  });
});
