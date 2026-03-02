import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ProfileGenerator } from "../../src/core/generators/profile/profileGenerator.js";
import type { CandidateSet, GeneratorContext, LLMInput, LLMOutput } from "../../src/core/types/index.js";
import type { LLMProvider } from "../../src/llm/provider.interface.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function buildContext(rootPath: string): GeneratorContext {
  return {
    scan: {
      rootPath,
      languages: ["typescript"],
      frameworks: ["nestjs"],
      structure: { topLevel: ["src", "domain"], secondLevel: { src: [] } },
      dependencies: {
        packageJson: true,
        composerJson: false,
        packageDependencies: ["@nestjs/core"],
        composerDependencies: []
      },
      signals: ["nestjs-project"],
      scannedAt: new Date().toISOString()
    },
    config: {
      compliance: { level: "L1" },
      outputPaths: { docs: "docs", prompts: "prompts", policies: "policies", ai: "ai" },
      ignoreDirs: [".git", "node_modules"],
      templateOverrides: {},
      generate: { focus: "nest", evidence: { required: true, minPerSection: 1 } }
    }
  };
}

function buildCandidates(): CandidateSet {
  return {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    framework: "nestjs",
    focus: "nest",
    files: [
      { path: "src/app.module.ts", category: "nest.module", reason: "Module" },
      { path: "src/users.controller.ts", category: "nest.controller", reason: "Controller" }
    ]
  };
}

describe("ProfileGenerator", () => {
  it("generates heuristic profile without LLM provider", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-profile-"));
    createdDirs.push(root);

    const generator = new ProfileGenerator();
    const profile = await generator.generate(buildContext(root), buildCandidates(), "nest");

    expect(profile.version).toBe("1.0.0");
    expect(profile.framework).toBe("nestjs");
    expect(profile.routingStyle).toBe("decorator-based");
    expect(profile.domainStyle).toBe("ddd");
    expect(profile.keyRoots.domain).toContain("domain");
    expect(profile.evidence.length).toBeGreaterThan(0);
  });

  it("generates heuristic profile when LLM provider is null", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-profile-null-"));
    createdDirs.push(root);

    const generator = new ProfileGenerator();
    const profile = await generator.generate(buildContext(root), buildCandidates(), "nest", null);

    expect(profile.routingStyle).toBe("decorator-based");
    expect(profile.domainStyle).toBe("ddd");
  });

  it("merges LLM refinement that resolves unknown routing style", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-profile-llm-"));
    createdDirs.push(root);

    const context = buildContext(root);
    // Clear controller category so routing infers as unknown
    const candidates: CandidateSet = {
      ...buildCandidates(),
      files: [{ path: "src/app.module.ts", category: "nest.module", reason: "Module" }]
    };

    const mockLLM: LLMProvider = {
      generate: async (_input: LLMInput): Promise<LLMOutput> => ({
        enrichedContent: {
          profile: JSON.stringify({
            routingStyle: "decorator-based",
            ambiguities: []
          })
        },
        metadata: { provider: "openai", model: "gpt-4o", tokensUsed: 100 }
      })
    };

    const generator = new ProfileGenerator();
    const profile = await generator.generate(context, candidates, "nest", mockLLM);

    // LLM should resolve the unknown routing style
    expect(profile.routingStyle).toBe("decorator-based");
    expect(profile.ambiguities).toHaveLength(0);
  });

  it("preserves heuristic values when LLM provides unknown values", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-profile-preserve-"));
    createdDirs.push(root);

    const mockLLM: LLMProvider = {
      generate: async (_input: LLMInput): Promise<LLMOutput> => ({
        enrichedContent: {
          profile: JSON.stringify({
            routingStyle: "unknown",
            domainStyle: "unknown"
          })
        },
        metadata: { provider: "openai", model: "gpt-4o", tokensUsed: 50 }
      })
    };

    const generator = new ProfileGenerator();
    const profile = await generator.generate(buildContext(root), buildCandidates(), "nest", mockLLM);

    // Heuristic profile has decorator-based and ddd, LLM returned unknown so heuristic wins
    expect(profile.routingStyle).toBe("decorator-based");
    expect(profile.domainStyle).toBe("ddd");
  });

  it("merges additive key roots from LLM", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-profile-roots-"));
    createdDirs.push(root);

    const mockLLM: LLMProvider = {
      generate: async (_input: LLMInput): Promise<LLMOutput> => ({
        enrichedContent: {
          profile: JSON.stringify({
            keyRoots: {
              domain: ["libs"],
              infra: ["deploy"]
            }
          })
        },
        metadata: { provider: "openai", model: "gpt-4o", tokensUsed: 80 }
      })
    };

    const generator = new ProfileGenerator();
    const profile = await generator.generate(buildContext(root), buildCandidates(), "nest", mockLLM);

    expect(profile.keyRoots.domain).toContain("domain");
    expect(profile.keyRoots.domain).toContain("libs");
    expect(profile.keyRoots.infra).toContain("deploy");
  });

  it("falls back to heuristic when LLM throws", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-profile-fail-"));
    createdDirs.push(root);

    const mockLLM: LLMProvider = {
      generate: async (): Promise<LLMOutput> => {
        throw new Error("Connection refused");
      }
    };

    const generator = new ProfileGenerator();
    const profile = await generator.generate(buildContext(root), buildCandidates(), "nest", mockLLM);

    expect(profile.routingStyle).toBe("decorator-based");
    expect(profile.domainStyle).toBe("ddd");
    expect(profile.framework).toBe("nestjs");
  });

  it("falls back to heuristic when LLM returns invalid shape", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-profile-invalid-"));
    createdDirs.push(root);

    const mockLLM: LLMProvider = {
      generate: async (_input: LLMInput): Promise<LLMOutput> => ({
        enrichedContent: {
          profile: "not valid json at all {{{{"
        },
        metadata: { provider: "openai", model: "gpt-4o", tokensUsed: 30 }
      })
    };

    const generator = new ProfileGenerator();
    const profile = await generator.generate(buildContext(root), buildCandidates(), "nest", mockLLM);

    // Should gracefully fall back to heuristic
    expect(profile.routingStyle).toBe("decorator-based");
    expect(profile.domainStyle).toBe("ddd");
  });
});
