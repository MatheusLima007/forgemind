import type {
  Hypothesis,
  HypothesisQualityGateSummary,
  HypothesisQualityGateThresholds,
} from "../types/index.js";

export class HypothesisQualityGate {
  constructor(private readonly thresholds: HypothesisQualityGateThresholds) {}

  apply(hypotheses: Hypothesis[]): HypothesisQualityGateSummary {
    let accepted = 0;
    let needsReview = 0;
    let rejected = 0;

    for (const hypothesis of hypotheses) {
      if (hypothesis.status === "rejected") {
        rejected += 1;
        continue;
      }

      if (hypothesis.confidence < this.thresholds.minConfidence) {
        hypothesis.status = "needs-review";
        hypothesis.needsConfirmation = true;
        needsReview += 1;
        continue;
      }

      accepted += 1;
    }

    const total = hypotheses.length;
    const pendingRatio = total === 0 ? 0 : needsReview / total;

    return {
      total,
      accepted,
      needsReview,
      rejected,
      pendingRatio,
      blocked: pendingRatio > this.thresholds.maxPendingRatio
    };
  }
}

export function shouldBlockConsolidation(summary: HypothesisQualityGateSummary, interviewCompleted: boolean): boolean {
  return summary.blocked && !interviewCompleted;
}
