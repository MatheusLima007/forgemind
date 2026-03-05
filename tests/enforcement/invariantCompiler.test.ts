import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { InvariantCompiler } from "../../src/core/enforcement/invariantCompiler.js";
import type { DomainInvariantKnowledge } from "../../src/core/types/index.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    createdDirs.splice(0).map((p) => rm(p, { recursive: true, force: true }))
  );
});

async function tmpRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "forgemind-invariant-"));
  createdDirs.push(root);
  return root;
}

describe("InvariantCompiler", () => {
  it("returns no violations when no confirmed rules with enforcement exist", async () => {
    const root = await tmpRoot();
    const knowledge: DomainInvariantKnowledge = {
      rules: [
        {
          name: "No direct DB",
          description: "Repositories must not be accessed directly",
          severity: "critical",
          status: "inferred", // not confirmed → skipped
        },
      ],
      validStates: [],
      invalidStates: [],
      constraints: [],
    };

    const compiler = new InvariantCompiler();
    const violations = await compiler.compile(knowledge, root);
    expect(violations).toHaveLength(0);
  });

  it("detects forbidden import pattern", async () => {
    const root = await tmpRoot();
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(
      join(root, "src", "service.ts"),
      `import { db } from "../../infrastructure/db";\nexport function doSomething() {}\n`,
      "utf-8"
    );

    const knowledge: DomainInvariantKnowledge = {
      rules: [
        {
          name: "No direct DB import",
          description: "Business logic must not import from infrastructure/db",
          severity: "critical",
          status: "confirmed",
          enforcement: {
            kind: "forbiddenImport",
            pattern: "infrastructure/db",
            fixHint: "Use a repository abstraction instead",
          },
        },
      ],
      validStates: [],
      invalidStates: [],
      constraints: [],
    };

    const compiler = new InvariantCompiler();
    const violations = await compiler.compile(knowledge, root);

    expect(violations.length).toBeGreaterThanOrEqual(1);
    const v = violations[0];
    expect(v.ruleId).toBe("no-direct-db-import");
    expect(v.severity).toBe("critical");
    expect(v.kind).toBe("invariant");
    expect(v.file).toContain("service.ts");
    expect(v.message).toMatch(/infrastructure\/db/);
    expect(v.fixHint).toBe("Use a repository abstraction instead");
  });

  it("passes when no file imports the forbidden pattern", async () => {
    const root = await tmpRoot();
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(
      join(root, "src", "clean.ts"),
      `import { OrderRepo } from "./orderRepo";\nexport function place() {}\n`,
      "utf-8"
    );

    const knowledge: DomainInvariantKnowledge = {
      rules: [
        {
          name: "No direct DB import",
          description: "...",
          severity: "critical",
          status: "confirmed",
          enforcement: {
            kind: "forbiddenImport",
            pattern: "infrastructure/db",
          },
        },
      ],
      validStates: [],
      invalidStates: [],
      constraints: [],
    };

    const compiler = new InvariantCompiler();
    const violations = await compiler.compile(knowledge, root);
    expect(violations).toHaveLength(0);
  });

  it("reports missing required file", async () => {
    const root = await tmpRoot();

    const knowledge: DomainInvariantKnowledge = {
      rules: [
        {
          name: "Config file must exist",
          description: "forgemind.config.json must be present",
          severity: "important",
          status: "confirmed",
          enforcement: {
            kind: "requiredFileExists",
            path: "forgemind.config.json",
            fixHint: "Create forgemind.config.json with at least minimal config",
          },
        },
      ],
      validStates: [],
      invalidStates: [],
      constraints: [],
    };

    const compiler = new InvariantCompiler();
    const violations = await compiler.compile(knowledge, root);

    expect(violations.length).toBe(1);
    expect(violations[0].kind).toBe("invariant");
    expect(violations[0].severity).toBe("important");
    expect(violations[0].message).toMatch(/forgemind\.config\.json/);
  });

  it("passes when required file exists", async () => {
    const root = await tmpRoot();
    await writeFile(join(root, "forgemind.config.json"), "{}", "utf-8");

    const knowledge: DomainInvariantKnowledge = {
      rules: [
        {
          name: "Config file must exist",
          description: "...",
          severity: "important",
          status: "confirmed",
          enforcement: {
            kind: "requiredFileExists",
            path: "forgemind.config.json",
          },
        },
      ],
      validStates: [],
      invalidStates: [],
      constraints: [],
    };

    const compiler = new InvariantCompiler();
    const violations = await compiler.compile(knowledge, root);
    expect(violations).toHaveLength(0);
  });

  it("detects missing required symbol in file", async () => {
    const root = await tmpRoot();
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(
      join(root, "src", "index.ts"),
      `// no exports here\nconst x = 1;\n`,
      "utf-8"
    );

    const knowledge: DomainInvariantKnowledge = {
      rules: [
        {
          name: "Must export bootstrap",
          description: "Entry point must export bootstrap function",
          severity: "critical",
          status: "confirmed",
          enforcement: {
            kind: "requiredSymbolExists",
            symbol: "bootstrap",
            file: "src/index.ts",
          },
        },
      ],
      validStates: [],
      invalidStates: [],
      constraints: [],
    };

    const compiler = new InvariantCompiler();
    const violations = await compiler.compile(knowledge, root);

    expect(violations.length).toBe(1);
    expect(violations[0].message).toMatch(/bootstrap/);
  });

  it("passes when required symbol exists in file", async () => {
    const root = await tmpRoot();
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(
      join(root, "src", "index.ts"),
      `export function bootstrap() { return true; }\n`,
      "utf-8"
    );

    const knowledge: DomainInvariantKnowledge = {
      rules: [
        {
          name: "Must export bootstrap",
          description: "...",
          severity: "critical",
          status: "confirmed",
          enforcement: {
            kind: "requiredSymbolExists",
            symbol: "bootstrap",
            file: "src/index.ts",
          },
        },
      ],
      validStates: [],
      invalidStates: [],
      constraints: [],
    };

    const compiler = new InvariantCompiler();
    const violations = await compiler.compile(knowledge, root);
    expect(violations).toHaveLength(0);
  });

  it("lists unenforceable confirmed rules (no enforcement spec)", async () => {
    const root = await tmpRoot();
    const knowledge: DomainInvariantKnowledge = {
      rules: [
        {
          name: "Semantic rule A",
          description: "Hard to enforce statically",
          severity: "important",
          status: "confirmed",
          // no enforcement field
        },
        {
          name: "Semantic rule B",
          description: "Also descriptive only",
          severity: "critical",
          status: "confirmed",
          // no enforcement field
        },
      ],
      validStates: [],
      invalidStates: [],
      constraints: [],
    };

    const compiler = new InvariantCompiler();
    const unenforceable = compiler.unenforceableRules(knowledge);
    expect(unenforceable).toHaveLength(2);
    expect(unenforceable).toContain("Semantic rule A");
    expect(unenforceable).toContain("Semantic rule B");
  });
});
