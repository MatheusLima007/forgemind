import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NestIndexer } from "../../src/core/generators/indexers/nest.indexer.js";
import type { CandidateSet, GeneratorContext, RepoProfile } from "../../src/core/types/index.js";

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
      structure: { topLevel: ["src"], secondLevel: { src: ["app.module.ts"] } },
      dependencies: {
        packageJson: true,
        composerJson: false,
        packageDependencies: ["@nestjs/core", "@nestjs/common"],
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

function buildProfile(): RepoProfile {
  return {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    framework: "nestjs",
    routingStyle: "decorator-based",
    domainStyle: "layered",
    keyRoots: { domain: ["src"], infra: [] },
    evidence: [],
    ambiguities: []
  };
}

describe("NestIndexer", () => {
  it("extracts modules, controllers, and endpoints from @Module/@Controller decorators", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-nest-idx-"));
    createdDirs.push(root);
    await mkdir(join(root, "src"), { recursive: true });

    await writeFile(
      join(root, "src", "app.module.ts"),
      `import { Module } from '@nestjs/common';
@Module({ imports: [], controllers: [], providers: [] })
export class AppModule {}
`,
      "utf-8"
    );

    await writeFile(
      join(root, "src", "users.controller.ts"),
      `import { Controller, Get, Post } from '@nestjs/common';
@Controller('users')
export class UsersController {
  @Get()
  findAll() { return []; }

  @Get(':id')
  findOne() { return {}; }

  @Post()
  create() { return {}; }
}
`,
      "utf-8"
    );

    await writeFile(
      join(root, "src", "users.service.ts"),
      `import { Injectable } from '@nestjs/common';
@Injectable()
export class UsersService {
  findAll() { return []; }
}
`,
      "utf-8"
    );

    const candidates: CandidateSet = {
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
      framework: "nestjs",
      focus: "nest",
      files: [
        { path: "src/app.module.ts", category: "nest.module", reason: "Module decorator" },
        { path: "src/users.controller.ts", category: "nest.controller", reason: "Controller decorator" },
        { path: "src/users.service.ts", category: "nest.provider", reason: "Injectable decorator" }
      ]
    };

    const indexer = new NestIndexer();
    const index = await indexer.index(buildContext(root), candidates, buildProfile());

    expect(index.framework).toBe("nestjs");
    expect(index.modules).toHaveLength(1);
    expect(index.modules[0].name).toBe("AppModule");
    expect(index.modules[0].kind).toBe("nest.module");

    expect(index.endpoints).toHaveLength(3);
    const methods = index.endpoints.map((e) => `${e.method} ${e.path}`).sort();
    expect(methods).toContain("GET /users");
    expect(methods).toContain("GET /users/:id");
    expect(methods).toContain("POST /users");

    expect(index.keyComponents.some((c) => c.name === "UsersController" && c.kind === "nest.controller")).toBe(true);
    expect(index.keyComponents.some((c) => c.name === "UsersService" && c.kind === "nest.provider")).toBe(true);

    expect(index.evidence.length).toBeGreaterThan(0);
    expect(index.conventions).toContain("nestjs.decorators");
  });

  it("handles controllers without explicit base path", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-nest-nobase-"));
    createdDirs.push(root);
    await mkdir(join(root, "src"), { recursive: true });

    await writeFile(
      join(root, "src", "health.controller.ts"),
      `import { Controller, Get } from '@nestjs/common';
@Controller()
export class HealthController {
  @Get('ping')
  ping() { return 'pong'; }
}
`,
      "utf-8"
    );

    const candidates: CandidateSet = {
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
      framework: "nestjs",
      focus: "nest",
      files: [{ path: "src/health.controller.ts", category: "nest.controller", reason: "Controller" }]
    };

    const indexer = new NestIndexer();
    const index = await indexer.index(buildContext(root), candidates, buildProfile());

    expect(index.endpoints).toHaveLength(1);
    expect(index.endpoints[0].method).toBe("GET");
    expect(index.endpoints[0].path).toBe("/ping");
    expect(index.endpoints[0].handler).toBe("HealthController.ping");
  });

  it("extracts line-level evidence for all entities", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-nest-lines-"));
    createdDirs.push(root);
    await mkdir(join(root, "src"), { recursive: true });

    await writeFile(
      join(root, "src", "orders.controller.ts"),
      `import { Controller, Delete } from '@nestjs/common';
@Controller('orders')
export class OrdersController {
  @Delete(':id')
  remove() { return { deleted: true }; }
}
`,
      "utf-8"
    );

    const candidates: CandidateSet = {
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
      framework: "nestjs",
      focus: "nest",
      files: [{ path: "src/orders.controller.ts", category: "nest.controller", reason: "Controller" }]
    };

    const indexer = new NestIndexer();
    const index = await indexer.index(buildContext(root), candidates, buildProfile());

    const endpoint = index.endpoints[0];
    expect(endpoint.evidence.lineStart).toBeDefined();
    expect(endpoint.evidence.lineEnd).toBeDefined();
    expect(typeof endpoint.evidence.lineStart).toBe("number");
    expect(endpoint.evidence.symbol).toBe("OrdersController.remove");
  });

  it("produces stable sorted output for deterministic fingerprinting", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-nest-stable-"));
    createdDirs.push(root);
    await mkdir(join(root, "src"), { recursive: true });

    await writeFile(
      join(root, "src", "beta.controller.ts"),
      `import { Controller, Get } from '@nestjs/common';
@Controller('beta')
export class BetaController {
  @Get()
  list() { return []; }
}
`,
      "utf-8"
    );

    await writeFile(
      join(root, "src", "alpha.controller.ts"),
      `import { Controller, Get } from '@nestjs/common';
@Controller('alpha')
export class AlphaController {
  @Get()
  list() { return []; }
}
`,
      "utf-8"
    );

    const candidates: CandidateSet = {
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
      framework: "nestjs",
      focus: "nest",
      files: [
        { path: "src/beta.controller.ts", category: "nest.controller", reason: "Controller" },
        { path: "src/alpha.controller.ts", category: "nest.controller", reason: "Controller" }
      ]
    };

    const indexer = new NestIndexer();
    const idx1 = await indexer.index(buildContext(root), candidates, buildProfile());
    const idx2 = await indexer.index(buildContext(root), candidates, buildProfile());

    expect(idx1.endpoints.map((e) => e.path)).toEqual(idx2.endpoints.map((e) => e.path));
    expect(idx1.endpoints[0].path).toBe("/alpha");
    expect(idx1.endpoints[1].path).toBe("/beta");
  });

  it("returns empty endpoints when no controllers exist", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-nest-empty-"));
    createdDirs.push(root);
    await mkdir(join(root, "src"), { recursive: true });

    await writeFile(
      join(root, "src", "utils.ts"),
      `export function helper() { return 42; }`,
      "utf-8"
    );

    const candidates: CandidateSet = {
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
      framework: "nestjs",
      focus: "nest",
      files: [{ path: "src/utils.ts", category: "nest.provider", reason: "utility file" }]
    };

    const indexer = new NestIndexer();
    const index = await indexer.index(buildContext(root), candidates, buildProfile());

    expect(index.endpoints).toHaveLength(0);
    expect(index.modules).toHaveLength(0);
    expect(index.keyComponents).toHaveLength(0);
  });
});
