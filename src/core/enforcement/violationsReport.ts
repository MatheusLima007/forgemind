// ─────────────────────────────────────────────────────────────
// ForgeMind — Phase 1 / ViolationsReport
// Aggregates violations + consistency issues into a deterministic
// JSON report and persists it to ai/violations.json.
// ─────────────────────────────────────────────────────────────

import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { EnforcementViolation, ConsistencyIssue, EnforcementReport } from "../types/index.js";

/** Builds an EnforcementReport from the outputs of the enforcement modules. */
export function buildEnforcementReport(
  rootPath: string,
  violations: EnforcementViolation[],
  consistency: ConsistencyIssue[]
): EnforcementReport {
  // Stable ordering: critical first, then important; within each group sort by file + ruleId
  const sorted = [...violations].sort((a, b) => {
    const severityOrder = (s: string) => (s === "critical" ? 0 : 1);
    const sd = severityOrder(a.severity) - severityOrder(b.severity);
    if (sd !== 0) return sd;
    const fd = (a.file ?? "").localeCompare(b.file ?? "");
    if (fd !== 0) return fd;
    return a.ruleId.localeCompare(b.ruleId);
  });

  const critical = sorted.filter((v) => v.severity === "critical").length;
  const important = sorted.filter((v) => v.severity === "important").length;

  return {
    generatedAt: new Date().toISOString(),
    rootPath,
    totalViolations: sorted.length,
    criticalViolations: critical,
    importantViolations: important,
    consistencyIssues: consistency.length,
    violations: sorted,
    consistency,
    passed: sorted.length === 0 && consistency.length === 0,
  };
}

/** Persists the report to the given path (creates directories as needed). */
export async function saveEnforcementReport(
  reportPath: string,
  report: EnforcementReport
): Promise<void> {
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf-8");
}

/** Formats a short CLI summary of the enforcement report. */
export function formatEnforcementSummary(report: EnforcementReport): string {
  const lines: string[] = [];

  if (report.passed) {
    lines.push("✓ No enforcement violations found.");
  } else {
    lines.push(
      `✗ ${report.totalViolations} violation(s) found ` +
        `(${report.criticalViolations} critical, ${report.importantViolations} important)`
    );
  }

  if (report.consistencyIssues > 0) {
    lines.push(`⚠ ${report.consistencyIssues} consistency issue(s) detected`);
  }

  // Print top-5 violations for immediate feedback
  for (const v of report.violations.slice(0, 5)) {
    const loc = v.file ? ` [${v.file}${v.line ? `:${v.line}` : ""}]` : "";
    lines.push(`  [${v.severity.toUpperCase()}] ${v.ruleName}:${loc} ${v.message}`);
    if (v.fixHint) lines.push(`    → ${v.fixHint}`);
  }

  if (report.violations.length > 5) {
    lines.push(`  … and ${report.violations.length - 5} more. See violations report for full details.`);
  }

  for (const issue of report.consistency.slice(0, 3)) {
    lines.push(`  [CONSISTENCY] ${issue.description}`);
    if (issue.suggestedQuestion) lines.push(`    → Interview: ${issue.suggestedQuestion}`);
  }

  return lines.join("\n");
}
