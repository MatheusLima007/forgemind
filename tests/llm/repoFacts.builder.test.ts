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
        configFilesFound: ["src/app.module.ts", "docs/system-ontology.md", "package.json"],
        dependencies: {
          configFiles: ["package.json"],
          dependencies: ["@nestjs/core", "chalk"],
          ecosystemHints: ["node"]
        },
        signals: ["node-project"],
        scannedAt: "2026-01-01T00:00:00.000Z"
      },
      config: {
        outputPath: "docs",
        intermediatePath: "ai",
        ignoreDirs: [".git", "node_modules"],
        ignoreFilePatterns: [".*"],
        llm: {
          provider: "openai",
          model: "gpt-5-mini",
          temperature: 0.2,
          maxTokensBudget: 5000
        },
        qualityGate: {
          minConfidence: 0.65,
          maxPendingRatio: 0.45
        },
        interview: {
          maxQuestions: 8,
          adaptiveFollowUp: true,
          language: "en"
        }
      }
    };

    const facts = buildRepoFacts(context);

    expect(facts.languages).toEqual(["typescript"]);
    expect(facts.frameworks).toEqual(["nestjs"]);
    expect(facts.topLevelStructure).toEqual(["docs", "package.json", "src"]);
    expect(facts.dependencySummary.files).toEqual(["package.json"]);
    expect(facts.dependencySummary.packageDependenciesCount).toBe(2);
    expect(facts.dependencySummary.composerDependenciesCount).toBe(0);
    expect(facts.architecturalSignals).toEqual(["node-project"]);
    expect(facts.complianceLevel).toBe("L1");
  });
});
