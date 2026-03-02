import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DocumentationGenerator } from "../../src/core/generators/documentation/documentationGenerator.js";
import { PromptPackGenerator } from "../../src/core/generators/prompts/promptPackGenerator.js";
import type { GeneratorContext, RepoIndex, RepoProfile } from "../../src/core/types/index.js";
import { readTextFile } from "../../src/utils/fileSystem.js";

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
      structure: { topLevel: ["src", "domain"], secondLevel: { src: ["app.module.ts"] } },
      dependencies: {
        packageJson: true,
        composerJson: false,
        packageDependencies: ["@nestjs/core", "@nestjs/common"],
        composerDependencies: []
      },
      signals: ["nestjs-project", "monorepo-detected"],
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

function buildProfile(): RepoProfile {
  return {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    framework: "nestjs",
    routingStyle: "decorator-based",
    domainStyle: "ddd",
    keyRoots: { domain: ["domain", "src"], infra: ["config"] },
    evidence: [{ path: "src/app.module.ts" }],
    ambiguities: []
  };
}

function buildIndex(): RepoIndex {
  return {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    framework: "nestjs",
    modules: [
      { name: "AppModule", kind: "nest.module", evidence: { path: "src/app.module.ts", symbol: "AppModule", lineStart: 3 } },
      { name: "UsersModule", kind: "nest.module", evidence: { path: "src/users/users.module.ts", symbol: "UsersModule", lineStart: 5 } }
    ],
    endpoints: [
      { method: "GET", path: "/users", handler: "UsersController.findAll", evidence: { path: "src/users/users.controller.ts", symbol: "UsersController.findAll", lineStart: 10 } },
      { method: "POST", path: "/users", handler: "UsersController.create", evidence: { path: "src/users/users.controller.ts", symbol: "UsersController.create", lineStart: 15 } }
    ],
    keyComponents: [
      { name: "UsersController", kind: "nest.controller", evidence: { path: "src/users/users.controller.ts", symbol: "UsersController", lineStart: 5 } },
      { name: "UsersService", kind: "nest.provider", evidence: { path: "src/users/users.service.ts", symbol: "UsersService", lineStart: 3 } }
    ],
    integrations: ["database", "cache"],
    conventions: ["nestjs.decorators", "nestjs.modules"],
    evidence: [{ path: "src/app.module.ts" }],
    ambiguities: []
  };
}

describe("Enriched DocumentationGenerator", () => {
  it("includes profile section in agent-first doc when enriched context is provided", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-edoc-"));
    createdDirs.push(root);
    await mkdir(join(root, "docs"), { recursive: true });

    const generator = new DocumentationGenerator();
    const files = await generator.generate(buildContext(root), { profile: buildProfile(), index: buildIndex() });

    const agentFirst = await readTextFile(files[0]);
    expect(agentFirst).toContain("## Architecture Profile");
    expect(agentFirst).toContain("Routing style: decorator-based");
    expect(agentFirst).toContain("Domain style: ddd");
  });

  it("includes modules and key components in agent-first doc", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-edoc-mods-"));
    createdDirs.push(root);
    await mkdir(join(root, "docs"), { recursive: true });

    const generator = new DocumentationGenerator();
    const files = await generator.generate(buildContext(root), { profile: buildProfile(), index: buildIndex() });

    const agentFirst = await readTextFile(files[0]);
    expect(agentFirst).toContain("## Modules");
    expect(agentFirst).toContain("**AppModule**");
    expect(agentFirst).toContain("**UsersModule**");
    expect(agentFirst).toContain("## Key Components");
    expect(agentFirst).toContain("**UsersController**");
    expect(agentFirst).toContain("**UsersService**");
  });

  it("includes endpoints and conventions in architecture doc", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-edoc-arch-"));
    createdDirs.push(root);
    await mkdir(join(root, "docs"), { recursive: true });

    const generator = new DocumentationGenerator();
    const files = await generator.generate(buildContext(root), { profile: buildProfile(), index: buildIndex() });

    const architecture = await readTextFile(files[1]);
    expect(architecture).toContain("## Endpoints");
    expect(architecture).toContain("`GET /users`");
    expect(architecture).toContain("`POST /users`");
    expect(architecture).toContain("UsersController.findAll");
    expect(architecture).toContain("## Conventions");
    expect(architecture).toContain("nestjs.decorators");
  });

  it("renders without enriched context (backward compatible)", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-edoc-noer-"));
    createdDirs.push(root);
    await mkdir(join(root, "docs"), { recursive: true });

    const generator = new DocumentationGenerator();
    const files = await generator.generate(buildContext(root));

    const agentFirst = await readTextFile(files[0]);
    expect(agentFirst).toContain("# Agent-First Repository Guide");
    expect(agentFirst).not.toContain("## Architecture Profile");
    expect(agentFirst).not.toContain("## Modules");
  });
});

describe("Enriched PromptPackGenerator", () => {
  it("includes architecture context in prompt files", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-eprompt-"));
    createdDirs.push(root);
    await mkdir(join(root, "prompts"), { recursive: true });

    const generator = new PromptPackGenerator();
    const files = await generator.generate(buildContext(root), { profile: buildProfile(), index: buildIndex() });

    expect(files).toHaveLength(4);

    const review = await readTextFile(files[0]);
    expect(review).toContain("## Architecture Context");
    expect(review).toContain("Routing style: decorator-based");
    expect(review).toContain("Domain style: ddd");
    expect(review).toContain("Known modules:");
    expect(review).toContain("AppModule");

    expect(review).toContain("## Known Endpoints");
    expect(review).toContain("GET /users");
    expect(review).toContain("## Known Modules");
    expect(review).toContain("AppModule");
  });

  it("includes endpoint reference in feature and troubleshooting prompts", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-eprompt-ep-"));
    createdDirs.push(root);
    await mkdir(join(root, "prompts"), { recursive: true });

    const generator = new PromptPackGenerator();
    const files = await generator.generate(buildContext(root), { profile: buildProfile(), index: buildIndex() });

    const feature = await readTextFile(files[1]);
    expect(feature).toContain("## Known Endpoints");
    expect(feature).toContain("POST /users");

    const troubleshooting = await readTextFile(files[3]);
    expect(troubleshooting).toContain("## Known Endpoints");
  });

  it("refactor prompt includes module reference but not endpoints", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-eprompt-ref-"));
    createdDirs.push(root);
    await mkdir(join(root, "prompts"), { recursive: true });

    const generator = new PromptPackGenerator();
    const files = await generator.generate(buildContext(root), { profile: buildProfile(), index: buildIndex() });

    const refactor = await readTextFile(files[2]);
    expect(refactor).toContain("## Known Modules");
    expect(refactor).not.toContain("## Known Endpoints");
  });

  it("renders without enriched context (backward compatible)", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-eprompt-noer-"));
    createdDirs.push(root);
    await mkdir(join(root, "prompts"), { recursive: true });

    const generator = new PromptPackGenerator();
    const files = await generator.generate(buildContext(root));

    const review = await readTextFile(files[0]);
    expect(review).toContain("# Review Prompt");
    expect(review).not.toContain("## Architecture Context");
    expect(review).not.toContain("## Known Endpoints");
  });
});
