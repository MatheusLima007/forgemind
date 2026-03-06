import { afterEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import type { ForgemindConfig, ForgeResult } from "../../src/core/types/index.js";
import { TokenBudgetExceededError } from "../../src/core/errors/pipelineErrors.js";
import { EXIT_CODES } from "../../src/cli/exitCodes.js";

const { runMock, loadConfigMock, loggerInfoMock, loggerOutputJsonMock } = vi.hoisted(() => {
  return {
    runMock: vi.fn(),
    loadConfigMock: vi.fn(),
    loggerInfoMock: vi.fn(),
    loggerOutputJsonMock: vi.fn()
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

vi.mock("../../src/utils/logger.js", () => {
  return {
    Logger: vi.fn().mockImplementation(() => ({
      info: loggerInfoMock,
      error: vi.fn(),
      success: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      outputJson: loggerOutputJsonMock
    }))
  };
});

import { registerGenerateCommand } from "../../src/cli/commands/generate.js";

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
  executionMode: "incremental",
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

  registerGenerateCommand(program);
  return program;
}

describe("generate command", () => {
  it("runs ContextPipeline with skipInterview=true", async () => {
    loadConfigMock.mockResolvedValue(configFixture);
    runMock.mockResolvedValue(resultFixture);

    const program = buildProgram();
    await program.parseAsync(["generate", "--root", "/tmp/repo", "--llm", "openai"], { from: "user" });

    expect(loadConfigMock).toHaveBeenCalledWith("/tmp/repo", undefined);
    expect(runMock).toHaveBeenCalledTimes(1);

    const args = runMock.mock.calls[0];
    expect(args[0]).toBe("/tmp/repo");
    expect(args[1]).toEqual(configFixture);
    expect(args[2]).toEqual({
      providerOverride: "openai",
      skipInterview: true,
      acceptDrift: false,
      allowInteractiveInterviewOnDrift: false,
      forceFullRegeneration: false
    });
  });

  it("passes full regeneration option to pipeline", async () => {
    loadConfigMock.mockResolvedValue(configFixture);
    runMock.mockResolvedValue(resultFixture);

    const program = buildProgram();
    await program.parseAsync(["generate", "--root", "/tmp/repo", "--full-regen"], { from: "user" });

    const args = runMock.mock.calls[0];
    expect(args[2]).toEqual({
      providerOverride: undefined,
      skipInterview: true,
      acceptDrift: false,
      allowInteractiveInterviewOnDrift: false,
      forceFullRegeneration: true
    });
  });

  it("prints Mode: full in textual output when --full-regen is used", async () => {
    loadConfigMock.mockResolvedValue(configFixture);
    runMock.mockResolvedValue({
      ...resultFixture,
      executionMode: "full"
    });

    const program = buildProgram();
    await program.parseAsync(["generate", "--root", "/tmp/repo", "--full-regen"], { from: "user" });

    expect(loggerInfoMock).toHaveBeenCalledWith("Mode: full");
  });

  it("emits mode=full in JSON output when --json and --full-regen are used", async () => {
    loadConfigMock.mockResolvedValue(configFixture);
    runMock.mockResolvedValue({
      ...resultFixture,
      executionMode: "full"
    });

    const program = buildProgram();
    await program.parseAsync(["generate", "--root", "/tmp/repo", "--full-regen", "--json"], { from: "user" });

    expect(loggerOutputJsonMock).toHaveBeenCalledTimes(1);
    const payload = loggerOutputJsonMock.mock.calls[0][0] as { mode?: string };
    expect(payload.mode).toBe("full");
  });

  it("sets budget exit code when token budget is exhausted", async () => {
    loadConfigMock.mockResolvedValue(configFixture);
    runMock.mockRejectedValue(new TokenBudgetExceededError("hypotheses", 100, 10, 90));

    const program = buildProgram();
    await program.parseAsync(["generate", "--root", "/tmp/repo"], { from: "user" });

    expect(process.exitCode).toBe(EXIT_CODES.TOKEN_BUDGET_EXHAUSTED);
  });
});
