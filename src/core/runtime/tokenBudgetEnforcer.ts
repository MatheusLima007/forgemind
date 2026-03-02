import type { LLMRequest, LLMResponse, TokenUsageReport } from "../types/index.js";
import type { LLMProvider } from "../../llm/provider.interface.js";
import { TokenBudgetExceededError } from "../errors/pipelineErrors.js";

interface CallRecord {
  stage: string;
  estimated: number;
  actual?: number;
}

export class TokenBudgetEnforcer {
  private currentStage = "unknown";
  private usedTokens = 0;
  private estimatedTotal = 0;
  private actualTotal = 0;
  private readonly calls: CallRecord[] = [];

  constructor(private readonly maxBudget: number) {}

  setStage(stage: string): void {
    this.currentStage = stage.trim().length > 0 ? stage : "unknown";
  }

  wrapProvider(provider: LLMProvider): LLMProvider {
    return {
      chat: async (request: LLMRequest): Promise<LLMResponse> => {
        const stage = this.currentStage;
        const estimated = estimateRequestTokens(request);

        this.assertBudget(stage, estimated);
        this.usedTokens += estimated;
        this.estimatedTotal += estimated;

        const callRecord: CallRecord = { stage, estimated };
        this.calls.push(callRecord);

        const response = await provider.chat(request);
        const actual = sanitizeTokens(response.metadata.tokensUsed);

        if (actual !== undefined) {
          callRecord.actual = actual;
          this.actualTotal += actual;
          this.usedTokens += actual - estimated;

          if (this.usedTokens > this.maxBudget) {
            throw new TokenBudgetExceededError(stage, this.usedTokens - actual, actual, this.maxBudget);
          }
        }

        return response;
      }
    };
  }

  getReport(): TokenUsageReport {
    const byStage: TokenUsageReport["byStage"] = {};

    for (const call of this.calls) {
      if (!byStage[call.stage]) {
        byStage[call.stage] = { estimated: 0, actual: 0, calls: 0 };
      }

      byStage[call.stage].estimated += call.estimated;
      byStage[call.stage].actual += call.actual ?? 0;
      byStage[call.stage].calls += 1;
    }

    return {
      maxBudget: this.maxBudget,
      used: this.usedTokens,
      remaining: Math.max(0, this.maxBudget - this.usedTokens),
      estimatedTotal: this.estimatedTotal,
      actualTotal: this.actualTotal,
      byStage
    };
  }

  private assertBudget(stage: string, estimated: number): void {
    if (this.usedTokens + estimated > this.maxBudget) {
      throw new TokenBudgetExceededError(stage, this.usedTokens, estimated, this.maxBudget);
    }
  }
}

function sanitizeTokens(value: number | undefined): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return undefined;
  }
  return Math.ceil(value);
}

function estimateRequestTokens(request: LLMRequest): number {
  const totalChars = request.messages.reduce((sum, message) => sum + message.content.length, 0);
  return Math.max(1, Math.ceil(totalChars / 4));
}
