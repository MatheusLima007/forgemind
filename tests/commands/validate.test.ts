import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, expect, afterEach } from "vitest";
import { Validator } from "../../src/core/validation/validator.js";
import type { ForgemindConfig } from "../../src/core/types/index.js";

const createdDirs: string[] = [];
const FIXED_DATE = "2026-01-01T00:00:00.000Z";

const config: ForgemindConfig = {
  compliance: { level: "L1" },
  outputPaths: { docs: "docs", prompts: "prompts", policies: "policies", ai: "ai" },
  ignoreDirs: [".git", "node_modules", "dist", "coverage"],
  templateOverrides: {}
};

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function seedRequiredFiles(root: string): Promise<void> {
  await mkdir(join(root, "docs"), { recursive: true });
  await mkdir(join(root, "prompts"), { recursive: true });
  await mkdir(join(root, "policies"), { recursive: true });
  await mkdir(join(root, "ai"), { recursive: true });

  await writeFile(join(root, "docs", "agent-first.md"), "# Agent", "utf-8");
  await writeFile(join(root, "docs", "architecture.md"), "# Architecture", "utf-8");
  await writeFile(join(root, "prompts", "review.md"), "review", "utf-8");
  await writeFile(join(root, "prompts", "feature.md"), "feature", "utf-8");
  await writeFile(join(root, "prompts", "refactor.md"), "refactor", "utf-8");
  await writeFile(join(root, "prompts", "troubleshooting.md"), "troubleshooting", "utf-8");
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "fixture", version: "1.0.0" }), "utf-8");
  await writeFile(join(root, "policies", "checklist.json"), JSON.stringify(createValidChecklist()), "utf-8");
  await writeFile(
    join(root, "ai", "contract.json"),
    JSON.stringify(createValidContract("d".repeat(64))),
    "utf-8"
  );
}

function createValidChecklist(): Record<string, unknown> {
  return {
    version: "1.0.0",
    generatedAt: FIXED_DATE,
    level: "L1",
    items: [
      { id: "DOC_AGENT_FIRST", description: "Agent-first documentation", path: "docs/agent-first.md", required: true, status: "present" },
      { id: "DOC_ARCHITECTURE", description: "Architecture documentation", path: "docs/architecture.md", required: true, status: "present" },
      { id: "PROMPT_REVIEW", description: "Review prompt", path: "prompts/review.md", required: true, status: "present" },
      { id: "PROMPT_FEATURE", description: "Feature prompt", path: "prompts/feature.md", required: true, status: "present" },
      { id: "PROMPT_REFACTOR", description: "Refactor prompt", path: "prompts/refactor.md", required: true, status: "present" },
      { id: "PROMPT_TROUBLESHOOTING", description: "Troubleshooting prompt", path: "prompts/troubleshooting.md", required: true, status: "present" },
      { id: "AI_CONTRACT", description: "AI contract", path: "ai/contract.json", required: true, status: "present" },
      { id: "AI_FINGERPRINT", description: "AI fingerprint", path: "ai/fingerprint.json", required: true, status: "present" }
    ]
  };
}

function createChecklistWithoutRequiredId(): Record<string, unknown> {
  const checklist = createValidChecklist() as {
    version: string;
    generatedAt: string;
    level: string;
    items: Array<Record<string, unknown>>;
  };

  return {
    ...checklist,
    items: checklist.items.filter((item) => item.id !== "AI_FINGERPRINT")
  };
}

function createValidFingerprint(
  fingerprint = "f".repeat(64),
  generatedAt = FIXED_DATE
): Record<string, string> {
  return {
    version: "1.0.0",
    generatedAt,
    structureHash: "a".repeat(64),
    dependenciesHash: "b".repeat(64),
    docsHash: "c".repeat(64),
    fingerprint
  };
}

function createValidContract(
  fingerprint = "f".repeat(64),
  dependencyFiles: string[] = ["package.json"],
  languages: string[] = ["unknown"],
  frameworks: string[] = ["unknown"],
  generatedAt = FIXED_DATE,
  fingerprintGeneratedAt = FIXED_DATE
): Record<string, unknown> {
  return {
    arrcVersion: "1.0.0",
    version: "1.0.0",
    generatedAt,
    complianceLevel: "L1",
    scanSummary: {
      languages,
      frameworks,
      dependencyFiles
    },
    fingerprint: createValidFingerprint(fingerprint, fingerprintGeneratedAt)
  };
}

describe("Validator", () => {
  it("returns exit code 3 when contract/fingerprint are missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-validate-"));
    createdDirs.push(root);

    const validator = new Validator();
    const result = await validator.validate(root, config);

    expect(result.exitCode).toBe(3);
    expect(result.valid).toBe(false);
  });

  it("returns exit code 1 when policy files are missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-validate-"));
    createdDirs.push(root);

    await mkdir(join(root, "ai"), { recursive: true });
    await writeFile(join(root, "ai", "contract.json"), JSON.stringify(createValidContract()), "utf-8");
    await writeFile(
      join(root, "ai", "fingerprint.json"),
      JSON.stringify(createValidFingerprint()),
      "utf-8"
    );

    const validator = new Validator();
    const result = await validator.validate(root, config);

    expect(result.exitCode).toBe(1);
    expect(result.valid).toBe(false);
  });

  it("returns exit code 2 on fingerprint drift", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-validate-"));
    createdDirs.push(root);

    await seedRequiredFiles(root);
    await writeFile(
      join(root, "ai", "fingerprint.json"),
      JSON.stringify(createValidFingerprint("d".repeat(64))),
      "utf-8"
    );

    const validator = new Validator();
    const result = await validator.validate(root, config);

    expect(result.exitCode).toBe(2);
    expect(result.valid).toBe(false);
  });

  it("returns exit code 3 when contract schema is invalid", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-validate-"));
    createdDirs.push(root);

    await seedRequiredFiles(root);
    await writeFile(
      join(root, "ai", "contract.json"),
      JSON.stringify({
        version: "1.0.0",
        generatedAt: FIXED_DATE,
        complianceLevel: "L1",
        scanSummary: {
          languages: ["typescript"],
          frameworks: ["unknown"],
          dependencyFiles: ["package.json"]
        },
        fingerprint: createValidFingerprint()
      }),
      "utf-8"
    );
    await writeFile(join(root, "ai", "fingerprint.json"), JSON.stringify(createValidFingerprint()), "utf-8");

    const validator = new Validator();
    const result = await validator.validate(root, config);

    expect(result.exitCode).toBe(3);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Contract schema invalid");
  });

  it("returns exit code 3 when contract fingerprint metadata mismatches fingerprint.json", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-validate-"));
    createdDirs.push(root);

    await seedRequiredFiles(root);
    await writeFile(
      join(root, "ai", "fingerprint.json"),
      JSON.stringify(createValidFingerprint("f".repeat(64))),
      "utf-8"
    );
    await writeFile(
      join(root, "ai", "contract.json"),
      JSON.stringify(createValidContract("e".repeat(64))),
      "utf-8"
    );

    const validator = new Validator();
    const result = await validator.validate(root, config);

    expect(result.exitCode).toBe(3);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("does not match fingerprint.json");
  });

  it("returns exit code 3 when contract scanSummary dependencyFiles mismatches current repo", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-validate-"));
    createdDirs.push(root);

    await seedRequiredFiles(root);
    await writeFile(
      join(root, "ai", "fingerprint.json"),
      JSON.stringify(createValidFingerprint("d".repeat(64))),
      "utf-8"
    );
    await writeFile(
      join(root, "ai", "contract.json"),
      JSON.stringify(createValidContract("d".repeat(64), ["composer.json"])),
      "utf-8"
    );

    const validator = new Validator();
    const result = await validator.validate(root, config);

    expect(result.exitCode).toBe(3);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("scanSummary mismatch");
  });

  it("returns exit code 3 when contract scanSummary languages mismatches current repo", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-validate-"));
    createdDirs.push(root);

    await seedRequiredFiles(root);
    await writeFile(
      join(root, "ai", "fingerprint.json"),
      JSON.stringify(createValidFingerprint("d".repeat(64))),
      "utf-8"
    );
    await writeFile(
      join(root, "ai", "contract.json"),
      JSON.stringify(createValidContract("d".repeat(64), ["package.json"], ["typescript"], ["unknown"])),
      "utf-8"
    );

    const validator = new Validator();
    const result = await validator.validate(root, config);

    expect(result.exitCode).toBe(3);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("expected languages");
  });

  it("returns exit code 3 when contract scanSummary frameworks mismatches current repo", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-validate-"));
    createdDirs.push(root);

    await seedRequiredFiles(root);
    await writeFile(
      join(root, "ai", "fingerprint.json"),
      JSON.stringify(createValidFingerprint("d".repeat(64))),
      "utf-8"
    );
    await writeFile(
      join(root, "ai", "contract.json"),
      JSON.stringify(createValidContract("d".repeat(64), ["package.json"], ["unknown"], ["react"])),
      "utf-8"
    );

    const validator = new Validator();
    const result = await validator.validate(root, config);

    expect(result.exitCode).toBe(3);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("expected frameworks");
  });

  it("returns exit code 3 when contract fingerprint generatedAt mismatches fingerprint.json", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-validate-"));
    createdDirs.push(root);

    await seedRequiredFiles(root);
    await writeFile(
      join(root, "ai", "fingerprint.json"),
      JSON.stringify(createValidFingerprint("d".repeat(64), "2026-01-01T00:00:00.000Z")),
      "utf-8"
    );
    await writeFile(
      join(root, "ai", "contract.json"),
      JSON.stringify(
        createValidContract(
          "d".repeat(64),
          ["package.json"],
          ["unknown"],
          ["unknown"],
          "2026-01-01T00:00:00.000Z",
          "2026-01-01T00:00:01.000Z"
        )
      ),
      "utf-8"
    );

    const validator = new Validator();
    const result = await validator.validate(root, config);

    expect(result.exitCode).toBe(3);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("does not match fingerprint.json");
  });

  it("returns exit code 3 when contract.generatedAt is earlier than fingerprint.generatedAt", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-validate-"));
    createdDirs.push(root);

    await seedRequiredFiles(root);
    await writeFile(
      join(root, "ai", "fingerprint.json"),
      JSON.stringify(createValidFingerprint("d".repeat(64), "2026-01-01T00:00:01.000Z")),
      "utf-8"
    );
    await writeFile(
      join(root, "ai", "contract.json"),
      JSON.stringify(
        createValidContract(
          "d".repeat(64),
          ["package.json"],
          ["unknown"],
          ["unknown"],
          "2026-01-01T00:00:00.000Z",
          "2026-01-01T00:00:01.000Z"
        )
      ),
      "utf-8"
    );

    const validator = new Validator();
    const result = await validator.validate(root, config);

    expect(result.exitCode).toBe(3);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Contract temporal mismatch");
  });

  it("returns exit code 3 when policy checklist schema is invalid", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-validate-"));
    createdDirs.push(root);

    await seedRequiredFiles(root);
    await writeFile(
      join(root, "ai", "fingerprint.json"),
      JSON.stringify(createValidFingerprint("d".repeat(64))),
      "utf-8"
    );
    await writeFile(
      join(root, "policies", "checklist.json"),
      JSON.stringify({ version: "1.0.0", generatedAt: FIXED_DATE, level: "L1", items: [{ id: "X" }] }),
      "utf-8"
    );

    const validator = new Validator();
    const result = await validator.validate(root, config);

    expect(result.exitCode).toBe(3);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Policy checklist schema invalid");
  });

  it("returns exit code 3 when policy checklist misses required IDs", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-validate-"));
    createdDirs.push(root);

    await seedRequiredFiles(root);
    await writeFile(
      join(root, "ai", "fingerprint.json"),
      JSON.stringify(createValidFingerprint("d".repeat(64))),
      "utf-8"
    );
    await writeFile(
      join(root, "policies", "checklist.json"),
      JSON.stringify(createChecklistWithoutRequiredId()),
      "utf-8"
    );

    const validator = new Validator();
    const result = await validator.validate(root, config);

    expect(result.exitCode).toBe(3);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Policy checklist invalid");
    expect(result.errors[0]).toContain("missing required item ID");
  });
});
