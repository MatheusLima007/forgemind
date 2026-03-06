import { afterEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import type { ForgemindConfig, ForgeResult } from "../../src/core/types/index.js";
import { TokenBudgetExceededError, QualityGateBlockedError, SemanticDriftBlockedError } from "../../src/core/errors/pipelineErrors.js";
import { EXIT_CODES } from "../../src/cli/exitCodes.js";

const { runMock, loadConfigMock } = vi.hoisted(() => {
  return {
    runMock: vi.fn(),
    loadConfigMock: vi.fn()
  };
});

vi.mock("../../src/core/orchestrator/contextPipeline.js", () => {
  return {
    ContextPipeline: vi.fn().mockImplementation(() => ({
      run: runMock
    }))
  };
});

vi.mock("../../src/core/config/configLoader.js", () => {
  return {
    loadConfig: loadConfigMock
  };
});

import { registerForgeCommand } from "../../src/cli/commands/forge.js";

const configFixture: ForgemindConfig = {
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
};

const resultFixture: ForgeResult = {
  rootPath: "/tmp/repo",
  generatedFiles: ["/tmp/repo/docs/system-ontology.md"],
  signals: [],
  hypothesesCount: 2,
  confirmedHypotheses: 1,
  interviewCompleted: true,
  documentsGenerated: ["system-ontology.md"],
  evidenceMapEntries: 1,
  domainCandidatesCount: 1,
  unknownClaims: 0,
  llmProvider: "openai",
  llmModel: "gpt-5-mini",
  tokenUsage: {
    maxBudget: 5000,
    used: 80,
    remaining: 4920,
    estimatedTotal: 80,
    actualTotal: 80,
    byStage: {}
  },
  qualityGate: {
    total: 2,
    accepted: 1,
    needsReview: 1,
    rejected: 0,
    pendingRatio: 0.5,
    blocked: false
  },
  knowledgeDiff: {
    changed: true,
    invariants: { added: 1, removed: 0, modified: 0 },
    boundaries: {
      allowed: { added: 0, removed: 0, modified: 0 },
      prohibited: { added: 0, removed: 0, modified: 0 }
    },
    decisions: { added: 0, removed: 0, modified: 0 },
    cognitiveRisks: { added: 0, removed: 0, modified: 0 }
  },
  duration: 42
};

afterEach(() => {
  vi.clearAllMocks();
  process.exitCode = 0;
});

function buildProgram(): Command {
  const program = new Command();
  program
    .name("forgemind")
    .option("-r, --root <path>", "Repository root path", process.cwd())
    .option("-c, --config <path>", "Configuration file path")
    .option("--json", "Output in JSON format", false)
    .option("-v, --verbose", "Enable verbose output", false);

  registerForgeCommand(program);
  return program;
}

describe("forge command exit code mapping", () => {
  it("passes drift confirmation options to pipeline", async () => {
    loadConfigMock.mockResolvedValue(configFixture);
    runMock.mockResolvedValue(resultFixture);

    const program = buildProgram();
    await program.parseAsync(["forge", "--root", "/tmp/repo", "--accept-drift"], { from: "user" });

    expect(runMock).toHaveBeenCalledTimes(1);
    const args = runMock.mock.calls[0];
    expect(args[2]).toEqual({
      providerOverride: undefined,
      skipInterview: false,
      forceInterview: false,
      acceptDrift: true,
      allowInteractiveInterviewOnDrift: true
    });
  });

  it("sets TOKEN_BUDGET_EXHAUSTED when budget error occurs", async () => {
    loadConfigMock.mockResolvedValue(configFixture);
    runMock.mockRejectedValue(new TokenBudgetExceededError("hypotheses", 100, 20, 110));

    const program = buildProgram();
    await program.parseAsync(["forge", "--root", "/tmp/repo"], { from: "user" });

    expect(process.exitCode).toBe(EXIT_CODES.TOKEN_BUDGET_EXHAUSTED);
  });

  it("sets QUALITY_GATE_BLOCKED when quality gate blocks consolidation", async () => {
    loadConfigMock.mockResolvedValue(configFixture);
    runMock.mockRejectedValue(new QualityGateBlockedError(0.7, 0.45));

    const program = buildProgram();
    await program.parseAsync(["forge", "--root", "/tmp/repo"], { from: "user" });

    expect(process.exitCode).toBe(EXIT_CODES.QUALITY_GATE_BLOCKED);
  });

  it("sets SEMANTIC_DRIFT_BLOCKED when drift threshold is exceeded", async () => {
    loadConfigMock.mockResolvedValue(configFixture);
    runMock.mockRejectedValue(new SemanticDriftBlockedError(0.91, 0.35));

    const program = buildProgram();
    await program.parseAsync(["forge", "--root", "/tmp/repo"], { from: "user" });

    expect(process.exitCode).toBe(EXIT_CODES.SEMANTIC_DRIFT_BLOCKED);
  });
});
