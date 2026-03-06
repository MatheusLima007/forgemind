import { afterEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import type { ForgemindConfig, SemanticContext } from "../../src/core/types/index.js";
import { EnforcementViolationsError } from "../../src/core/errors/pipelineErrors.js";
import { EXIT_CODES } from "../../src/cli/exitCodes.js";

// ── Hoisted mocks ─────────────────────────────────────────────

const { loadConfigMock, loadContextMock, compileMock, enforceMock, checkMock, saveReportMock } =
  vi.hoisted(() => ({
    loadConfigMock: vi.fn(),
    loadContextMock: vi.fn(),
    compileMock: vi.fn(),
    enforceMock: vi.fn(),
    checkMock: vi.fn(),
    saveReportMock: vi.fn(),
  }));

vi.mock("../../src/core/config/configLoader.js", () => ({ loadConfig: loadConfigMock }));
vi.mock("../../src/core/orchestrator/semanticContextStore.js", () => ({
  SemanticContextStore: vi.fn().mockImplementation(() => ({
    load: loadContextMock,
  })),
}));

vi.mock("../../src/core/enforcement/index.js", () => ({
  InvariantCompiler: vi.fn().mockImplementation(() => ({
    compile: compileMock,
    unenforceableRules: vi.fn().mockReturnValue([]),
  })),
  BoundaryEnforcer: vi.fn().mockImplementation(() => ({
    enforce: enforceMock,
  })),
  ConsistencyChecker: vi.fn().mockImplementation(() => ({
    check: checkMock,
  })),
  buildEnforcementReport: vi.fn((rootPath, violations, consistency) => ({
    generatedAt: new Date().toISOString(),
    rootPath,
    totalViolations: violations.length,
    criticalViolations: violations.filter((v: { severity: string }) => v.severity === "critical").length,
    importantViolations: violations.filter((v: { severity: string }) => v.severity === "important").length,
    consistencyIssues: consistency.length,
    violations,
    consistency,
    passed: violations.length === 0 && consistency.length === 0,
  })),
  saveEnforcementReport: saveReportMock,
  formatEnforcementSummary: vi.fn().mockReturnValue("✓ No enforcement violations found."),
}));

import { registerEnforceCommand } from "../../src/cli/commands/enforce.js";

// ── Fixtures ──────────────────────────────────────────────────

const configFixture: ForgemindConfig = {
  outputPath: "docs",
  intermediatePath: "ai",
  ignoreDirs: [".git", "node_modules"],
  llm: {
    provider: "openai",
    model: "gpt-5-mini",
    temperature: 0.2,
    maxTokensBudget: 5000,
  },
  qualityGate: { minConfidence: 0.65, maxPendingRatio: 0.45 },
  interview: { maxQuestions: 8, adaptiveFollowUp: true, language: "en" },
};

const contextFixture: SemanticContext = {
  version: "1.0.0",
  forgemindVersion: "0.2.0",
  generatedAt: new Date().toISOString(),
  signals: [],
  hypotheses: [],
  interviewSessions: [],
  consolidatedKnowledge: {
    systemOntology: {
      corePurpose: "test",
      mentalModel: "test",
      centralConcepts: [],
      systemOrientation: "test",
      principles: [],
    },
    domainInvariants: { rules: [], validStates: [], invalidStates: [], constraints: [] },
    conceptualBoundaries: {
      contexts: [],
      allowedRelations: [],
      prohibitedRelations: [],
      dangerousInteractions: [],
    },
    decisions: { decisions: [] },
    cognitiveRisks: {
      likelyErrors: [],
      deceptivePatterns: [],
      implicitCoupling: [],
      invisibleSideEffects: [],
      operationalAssumptions: [],
    },
    evidenceIndex: [],
    gaps: [],
  },
};

// ── Helpers ───────────────────────────────────────────────────

function buildProgram(): Command {
  const program = new Command();
  program
    .name("forgemind")
    .option("-r, --root <path>", "Repository root path", "/tmp/repo")
    .option("-c, --config <path>", "Configuration file path")
    .option("--json", "Output in JSON format", false)
    .option("-v, --verbose", "Enable verbose output", false);
  registerEnforceCommand(program);
  return program;
}

afterEach(() => {
  vi.clearAllMocks();
  process.exitCode = 0;
});

// ── Tests ─────────────────────────────────────────────────────

describe("enforce command", () => {
  it("exits 0 and saves report when no violations found", async () => {
    loadConfigMock.mockResolvedValue(configFixture);
    loadContextMock.mockResolvedValue(contextFixture);
    compileMock.mockResolvedValue([]);
    enforceMock.mockResolvedValue([]);
    checkMock.mockReturnValue([]);
    saveReportMock.mockResolvedValue(undefined);

    const program = buildProgram();
    await program.parseAsync(["enforce", "--root", "/tmp/repo"], { from: "user" });

    expect(process.exitCode ?? 0).toBe(0);
    expect(saveReportMock).toHaveBeenCalledOnce();
  });

  it("sets ENFORCEMENT_VIOLATIONS exit code when violations are found", async () => {
    loadConfigMock.mockResolvedValue(configFixture);
    loadContextMock.mockResolvedValue(contextFixture);
    compileMock.mockResolvedValue([
      {
        ruleId: "no-db",
        ruleName: "No direct DB",
        kind: "invariant",
        severity: "critical",
        message: "Forbidden import detected",
      },
    ]);
    enforceMock.mockResolvedValue([]);
    checkMock.mockReturnValue([]);
    saveReportMock.mockResolvedValue(undefined);

    const program = buildProgram();
    await program.parseAsync(["enforce", "--root", "/tmp/repo"], { from: "user" });

    expect(process.exitCode).toBe(EXIT_CODES.ENFORCEMENT_VIOLATIONS);
  });

  it("sets GENERAL_ERROR when semantic context cannot be read", async () => {
    loadConfigMock.mockResolvedValue(configFixture);
    loadContextMock.mockResolvedValue(null);

    const program = buildProgram();
    await program.parseAsync(["enforce", "--root", "/tmp/repo"], { from: "user" });

    expect(process.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
  });

  it("does not fail on consistency issues without --fail-on-consistency flag", async () => {
    loadConfigMock.mockResolvedValue(configFixture);
    loadContextMock.mockResolvedValue(contextFixture);
    compileMock.mockResolvedValue([]);
    enforceMock.mockResolvedValue([]);
    checkMock.mockReturnValue([
      {
        id: "consistency-bc-001",
        type: "boundary-contradiction",
        description: "cli→core is both allowed and prohibited",
        relatedElements: [],
      },
    ]);
    saveReportMock.mockResolvedValue(undefined);

    const program = buildProgram();
    await program.parseAsync(["enforce", "--root", "/tmp/repo"], { from: "user" });

    expect(process.exitCode ?? 0).toBe(0);
  });

  it("fails on consistency issues with --fail-on-consistency flag", async () => {
    loadConfigMock.mockResolvedValue(configFixture);
    loadContextMock.mockResolvedValue(contextFixture);
    compileMock.mockResolvedValue([]);
    enforceMock.mockResolvedValue([]);
    checkMock.mockReturnValue([
      {
        id: "consistency-bc-001",
        type: "boundary-contradiction",
        description: "contradiction detected",
        relatedElements: [],
      },
    ]);
    saveReportMock.mockResolvedValue(undefined);

    const program = buildProgram();
    await program.parseAsync(
      ["enforce", "--root", "/tmp/repo", "--fail-on-consistency"],
      { from: "user" }
    );

    expect(process.exitCode).toBe(EXIT_CODES.ENFORCEMENT_VIOLATIONS);
  });
});
