export class TokenBudgetExceededError extends Error {
  constructor(
    public readonly stage: string,
    public readonly used: number,
    public readonly requested: number,
    public readonly maxBudget: number
  ) {
    super(
      `Token budget exhausted at stage '${stage}'. Used=${used}, requested=${requested}, max=${maxBudget}.`
    );
    this.name = "TokenBudgetExceededError";
  }
}

export class QualityGateBlockedError extends Error {
  constructor(public readonly pendingRatio: number, public readonly maxPendingRatio: number) {
    super(
      `Hypothesis quality gate blocked consolidation. needs-review ratio=${pendingRatio.toFixed(2)} exceeds maxPendingRatio=${maxPendingRatio.toFixed(2)}. Complete interview to continue.`
    );
    this.name = "QualityGateBlockedError";
  }
}

export class EnforcementViolationsError extends Error {
  constructor(
    public readonly totalViolations: number,
    public readonly criticalViolations: number,
    public readonly reportPath: string
  ) {
    super(
      `Enforcement check found ${totalViolations} violation(s) (${criticalViolations} critical). See ${reportPath} for details.`
    );
    this.name = "EnforcementViolationsError";
  }
}
