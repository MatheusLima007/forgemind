import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LLMOrchestrator, stripLLMEnrichmentBlocks } from "../../src/llm/llm.orchestrator.js";
import type { AIContract, GeneratorContext, LLMInput, LLMOutput } from "../../src/core/types/index.js";
import type { LLMProvider } from "../../src/llm/provider.interface.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

class MockSuccessProvider implements LLMProvider {
  async generate(input: LLMInput): Promise<LLMOutput> {
    const enrichedContent: Record<string, string> = {};
    for (const key of Object.keys(input.currentDocs)) {
      enrichedContent[key] = "Extra context from LLM.";
    }

    return {
      enrichedContent,
      metadata: {
        provider: "openai",
        model: "mock-model"
      }
    };
  }
}

class MockFailureProvider implements LLMProvider {
  async generate(_input: LLMInput): Promise<LLMOutput> {
    throw new Error("provider down");
  }
}

class MockInvalidSchemaProvider implements LLMProvider {
  async generate(_input: LLMInput): Promise<LLMOutput> {
    return {
      enrichedContent: {
        "invalid": "value"
      },
      metadata: {
        provider: "openai",
        model: ""
      }
    };
  }
}

function createContext(rootPath: string): GeneratorContext {
  return {
    scan: {
      rootPath,
      languages: ["typescript"],
      frameworks: ["nestjs"],
      structure: { topLevel: ["docs", "prompts"], secondLevel: { docs: [], prompts: [] } },
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
      ignoreDirs: [".git", "node_modules"],
      ignoreFilePatterns: [".*"],
      templateOverrides: {},
      llm: {
        enabled: true,
        provider: "openai",
        model: "gpt-5-mini",
        temperature: 0.2,
        apiKey: "x"
      }
    }
  };
}

function createContract(): AIContract {
  return {
    arrcVersion: "1.0.0",
    version: "1.0.0",
    generatedAt: "2026-01-01T00:00:00.000Z",
    complianceLevel: "L1",
    scanSummary: {
      languages: ["typescript"],
      frameworks: ["nestjs"],
      dependencyFiles: ["package.json"]
    },
    fingerprint: {
      version: "1.0.0",
      generatedAt: "2026-01-01T00:00:00.000Z",
      structureHash: "a".repeat(64),
      dependenciesHash: "b".repeat(64),
      docsHash: "c".repeat(64),
      fingerprint: "d".repeat(64)
    }
  };
}

describe("LLMOrchestrator", () => {
  it("merges enrichment blocks into target files", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-llm-orchestrator-"));
    createdDirs.push(root);

    const filePath = join(root, "docs-agent-first.md");
    await writeFile(filePath, "# Base\n", "utf-8");

    const orchestrator = new LLMOrchestrator();
    const result = await orchestrator.enrichFiles(
      new MockSuccessProvider(),
      createContext(root),
      createContract(),
      "docs",
      [filePath]
    );

    expect(result.appliedFiles).toEqual([filePath]);
    expect(result.skippedReason).toBeUndefined();

    const finalContent = await readFile(filePath, "utf-8");
    expect(finalContent).toContain("<!-- FORGEMIND:LLM_START provider=openai model=mock-model -->");
    expect(finalContent).toContain("<!-- FORGEMIND:LLM_END -->");
  });

  it("falls back gracefully when provider fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-llm-orchestrator-fallback-"));
    createdDirs.push(root);

    const filePath = join(root, "docs-architecture.md");
    await writeFile(filePath, "# Base\n", "utf-8");

    const orchestrator = new LLMOrchestrator();
    const result = await orchestrator.enrichFiles(
      new MockFailureProvider(),
      createContext(root),
      createContract(),
      "docs",
      [filePath]
    );

    expect(result.appliedFiles).toEqual([]);
    expect(result.skippedReason).toBe("provider-failed");
  });

  it("does not duplicate blocks across repeated enrichment passes", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-llm-orchestrator-idempotent-"));
    createdDirs.push(root);

    const filePath = join(root, "docs-agent-first.md");
    await writeFile(filePath, "# Base\n", "utf-8");

    const orchestrator = new LLMOrchestrator();
    await orchestrator.enrichFiles(new MockSuccessProvider(), createContext(root), createContract(), "docs", [filePath]);
    await orchestrator.enrichFiles(new MockSuccessProvider(), createContext(root), createContract(), "docs", [filePath]);

    const finalContent = await readFile(filePath, "utf-8");
    const starts = finalContent.match(/FORGEMIND:LLM_START/g) ?? [];
    expect(starts).toHaveLength(1);
    expect(stripLLMEnrichmentBlocks(finalContent)).toBe("# Base");
  });

  it("falls back when provider returns invalid schema", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-llm-orchestrator-invalid-schema-"));
    createdDirs.push(root);

    const filePath = join(root, "docs-agent-first.md");
    await writeFile(filePath, "# Base\n", "utf-8");

    const orchestrator = new LLMOrchestrator();
    const result = await orchestrator.enrichFiles(
      new MockInvalidSchemaProvider(),
      createContext(root),
      createContract(),
      "docs",
      [filePath]
    );

    expect(result.appliedFiles).toEqual([]);
    expect(result.skippedReason).toBe("provider-failed");
  });

  it("throws in strict mode when provider fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-llm-orchestrator-strict-"));
    createdDirs.push(root);

    const filePath = join(root, "docs-agent-first.md");
    await writeFile(filePath, "# Base\n", "utf-8");

    const orchestrator = new LLMOrchestrator();
    await expect(
      orchestrator.enrichFiles(
        new MockFailureProvider(),
        createContext(root),
        createContract(),
        "docs",
        [filePath],
        true
      )
    ).rejects.toThrow();
  });
});
