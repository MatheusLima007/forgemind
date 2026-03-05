import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BoundaryEnforcer } from "../../src/core/enforcement/boundaryEnforcer.js";
import type { ConceptualBoundaryKnowledge } from "../../src/core/types/index.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    createdDirs.splice(0).map((p) => rm(p, { recursive: true, force: true }))
  );
});

async function tmpRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "forgemind-boundary-"));
  createdDirs.push(root);
  return root;
}

function buildKnowledge(
  contexts: string[],
  prohibited: Array<{ from: string; to: string; reason: string }>
): ConceptualBoundaryKnowledge {
  return {
    contexts: contexts.map((name) => ({ name, responsibility: name, responsibilities: [], risks: [] })),
    allowedRelations: [],
    prohibitedRelations: prohibited,
    dangerousInteractions: [],
  };
}

describe("BoundaryEnforcer", () => {
  it("returns no violations when no files exist", async () => {
    const root = await tmpRoot();
    const knowledge = buildKnowledge(["core", "llm"], [{ from: "llm", to: "scanner", reason: "wrong layer" }]);

    const enforcer = new BoundaryEnforcer();
    const violations = await enforcer.enforce(knowledge, root);
    expect(violations).toHaveLength(0);
  });

  it("returns no violations when there are no prohibited relations", async () => {
    const root = await tmpRoot();
    await mkdir(join(root, "src", "llm"), { recursive: true });
    await writeFile(
      join(root, "src", "llm", "provider.ts"),
      `import { Scanner } from "../scanner/index";\n`,
      "utf-8"
    );

    const knowledge = buildKnowledge(["llm", "scanner"], []);

    const enforcer = new BoundaryEnforcer();
    const violations = await enforcer.enforce(knowledge, root);
    expect(violations).toHaveLength(0);
  });

  it("detects a prohibited boundary crossing via import path", async () => {
    const root = await tmpRoot();
    // Create a file in the 'llm' context that imports from 'scanner' context
    await mkdir(join(root, "src", "llm"), { recursive: true });
    await writeFile(
      join(root, "src", "llm", "orchestrator.ts"),
      `import { repositoryScanner } from "../scanner/repositoryScanner";\nexport class LLMOrchestrator {}\n`,
      "utf-8"
    );

    const knowledge = buildKnowledge(
      ["llm", "scanner"],
      [{ from: "llm", to: "scanner", reason: "LLM layer must not depend on scanner" }]
    );

    const enforcer = new BoundaryEnforcer();
    const violations = await enforcer.enforce(knowledge, root);

    expect(violations.length).toBeGreaterThanOrEqual(1);
    const v = violations[0];
    expect(v.kind).toBe("boundary");
    expect(v.severity).toBe("critical");
    expect(v.fromContext).toBe("llm");
    expect(v.toContext).toBe("scanner");
    expect(v.file).toContain("orchestrator.ts");
    expect(v.fixHint).toMatch(/LLM layer must not depend on scanner/);
  });

  it("does not flag imports that do not cross prohibited boundaries", async () => {
    const root = await tmpRoot();
    await mkdir(join(root, "src", "cli"), { recursive: true });
    await writeFile(
      join(root, "src", "cli", "index.ts"),
      `import { ContextPipeline } from "../core/orchestrator";\n`,
      "utf-8"
    );

    // cli → core is allowed (not prohibited)
    const knowledge = buildKnowledge(
      ["cli", "core", "llm"],
      [{ from: "llm", to: "cli", reason: "LLM must not know about CLI" }]
    );

    const enforcer = new BoundaryEnforcer();
    const violations = await enforcer.enforce(knowledge, root);
    expect(violations.filter((v) => v.fromContext === "cli")).toHaveLength(0);
  });

  it("provides ruleId and remediation message", async () => {
    const root = await tmpRoot();
    await mkdir(join(root, "src", "llm"), { recursive: true });
    await writeFile(
      join(root, "src", "llm", "provider.ts"),
      `import { scan } from "../scanner/scan";\n`,
      "utf-8"
    );

    const knowledge = buildKnowledge(
      ["llm", "scanner"],
      [{ from: "llm", to: "scanner", reason: "wrong direction" }]
    );

    const enforcer = new BoundaryEnforcer();
    const violations = await enforcer.enforce(knowledge, root);

    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0].ruleId).toMatch(/boundary-llm-to-scanner/);
    expect(violations[0].fixHint).toMatch(/wrong direction/);
  });
});
