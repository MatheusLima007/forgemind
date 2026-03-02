import { afterEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import type { ForgemindConfig } from "../../src/core/types/index.js";
import { TokenBudgetExceededError, QualityGateBlockedError } from "../../src/core/errors/pipelineErrors.js";
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
});
