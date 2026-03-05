// ─────────────────────────────────────────────────────────────
// ForgeMind — Phase 1 / ConsistencyChecker
// Detects contradictions within the consolidated knowledge:
//   - boundary-contradiction: same pair is both allowed and prohibited
//   - invariant-decision-conflict: invariant directly contradicts a decision
//   - duplicate-rule: two invariant rules with the same name
// Source of truth: ConsolidatedKnowledge (structured only — no markdown).
// ─────────────────────────────────────────────────────────────

import type { ConsolidatedKnowledge, ConsistencyIssue } from "../types/index.js";

let issueCounter = 0;

function nextId(type: string): string {
  issueCounter += 1;
  return `consistency-${type}-${String(issueCounter).padStart(3, "0")}`;
}

export class ConsistencyChecker {
  check(knowledge: ConsolidatedKnowledge): ConsistencyIssue[] {
    issueCounter = 0;
    const issues: ConsistencyIssue[] = [];

    issues.push(...this.checkBoundaryContradictions(knowledge));
    issues.push(...this.checkInvariantDecisionConflicts(knowledge));
    issues.push(...this.checkDuplicateRules(knowledge));

    return issues;
  }

  // ── 1. Boundary contradictions ──────────────────────────────

  private checkBoundaryContradictions(knowledge: ConsolidatedKnowledge): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];
    const { allowedRelations, prohibitedRelations } = knowledge.conceptualBoundaries;

    const prohibitedPairs = new Set(
      prohibitedRelations.map((r) => `${normalise(r.from)}→${normalise(r.to)}`)
    );

    for (const allowed of allowedRelations) {
      const key = `${normalise(allowed.from)}→${normalise(allowed.to)}`;
      if (prohibitedPairs.has(key)) {
        const prohibited = prohibitedRelations.find(
          (p) => normalise(p.from) === normalise(allowed.from) && normalise(p.to) === normalise(allowed.to)
        )!;
        issues.push({
          id: nextId("bc"),
          type: "boundary-contradiction",
          description:
            `Boundary '${allowed.from} → ${allowed.to}' is simultaneously listed as ` +
            `allowed (type: ${allowed.type}) and prohibited (reason: ${prohibited.reason}).`,
          relatedElements: [
            `allowedRelation: ${allowed.from} → ${allowed.to}`,
            `prohibitedRelation: ${prohibited.from} → ${prohibited.to}`,
          ],
          suggestedQuestion:
            `Is '${allowed.from} → ${allowed.to}' allowed or prohibited? ` +
            `Resolve the contradiction and remove one of the conflicting entries.`,
        });
      }
    }

    return issues;
  }

  // ── 2. Invariant ↔ Decision conflicts ────────────────────────

  private checkInvariantDecisionConflicts(knowledge: ConsolidatedKnowledge): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];
    const confirmedRules = knowledge.domainInvariants.rules.filter(
      (r) => r.status === "confirmed"
    );

    for (const rule of confirmedRules) {
      const ruleKeywords = extractKeywords(rule.name + " " + rule.description);

      for (const decision of knowledge.decisions.decisions) {
        const decisionText = decision.title + " " + decision.context + " " + decision.choice;
        const decisionKeywords = extractKeywords(decisionText);

        // Heuristic: if overlapping concepts exist AND negation words appear together with the rule
        if (hasNegationConflict(rule.description, decisionText, ruleKeywords, decisionKeywords)) {
          issues.push({
            id: nextId("idc"),
            type: "invariant-decision-conflict",
            description:
              `Confirmed invariant '${rule.name}' may conflict with decision '${decision.title}'. ` +
              `Review both to ensure they are consistent.`,
            relatedElements: [
              `invariant: ${rule.name}`,
              `decision: ${decision.title}`,
            ],
            suggestedQuestion:
              `Does the decision '${decision.title}' contradict the invariant '${rule.name}'? ` +
              `If so, which takes precedence?`,
          });
        }
      }
    }

    return issues;
  }

  // ── 3. Duplicate invariant rule names ────────────────────────

  private checkDuplicateRules(knowledge: ConsolidatedKnowledge): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];
    const seen = new Map<string, number>();

    for (const rule of knowledge.domainInvariants.rules) {
      const key = normalise(rule.name);
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }

    for (const [key, count] of seen) {
      if (count > 1) {
        const originals = knowledge.domainInvariants.rules
          .filter((r) => normalise(r.name) === key)
          .map((r) => `'${r.name}' (${r.status})`);
        issues.push({
          id: nextId("dup"),
          type: "duplicate-rule",
          description: `Invariant rule '${key}' appears ${count} times: ${originals.join(", ")}.`,
          relatedElements: originals,
          suggestedQuestion: `Are these duplicate rules intentional? If so, consolidate them into one entry.`,
        });
      }
    }

    return issues;
  }
}

// ── Helpers ───────────────────────────────────────────────────

function normalise(s: string): string {
  return s.trim().toLowerCase();
}

function extractKeywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
}

const NEGATION_WORDS = ["not", "never", "forbidden", "prohibited", "disallow", "prevent", "must not", "cannot", "no "];

function hasNegationConflict(
  ruleText: string,
  decisionText: string,
  ruleKeywords: Set<string>,
  decisionKeywords: Set<string>
): boolean {
  // Requires meaningful keyword overlap (>=3 shared keywords)
  const shared = [...ruleKeywords].filter((k) => decisionKeywords.has(k));
  if (shared.length < 3) return false;

  // One side negates while the other affirms the same concept
  const ruleNegates = NEGATION_WORDS.some((w) => ruleText.toLowerCase().includes(w));
  const decisionNegates = NEGATION_WORDS.some((w) => decisionText.toLowerCase().includes(w));

  // Conflict: both talk about the same subject but one negates and the other affirms
  return ruleNegates !== decisionNegates;
}
