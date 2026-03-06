import type {
  ConsolidatedKnowledge,
  ContradictionItem,
  ContradictionsReport,
  Hypothesis,
  InterviewQuestion,
  StructuredAnswer,
} from "../types/index.js";

interface ContradictionEngineInput {
  hypotheses: Hypothesis[];
  answers: StructuredAnswer[];
  questionToHypotheses: Map<string, string[]>;
  knowledge: ConsolidatedKnowledge;
  operatingManual?: string;
}

export class ContradictionEngine {
  analyze(input: ContradictionEngineInput): ContradictionsReport {
    const contradictions: ContradictionItem[] = [];
    const downgradedHypotheses = new Set<string>();

    contradictions.push(...this.detectAnswerVsHypothesis(input.hypotheses, input.answers, input.questionToHypotheses, downgradedHypotheses));
    contradictions.push(...this.detectBoundaryVsInvariant(input.knowledge));
    contradictions.push(...this.detectDecisionVsManual(input.knowledge, input.operatingManual));

    const byType: ContradictionsReport["byType"] = {
      "answer-hypothesis": 0,
      "boundary-invariant": 0,
      "decision-operating-manual": 0
    };

    for (const item of contradictions) {
      byType[item.type] += 1;
    }

    return {
      generatedAt: new Date().toISOString(),
      total: contradictions.length,
      byType,
      contradictions,
      interviewQuestions: contradictions.map((item, index) => this.toQuestion(item, index)),
      downgradedHypotheses: [...downgradedHypotheses].sort((a, b) => a.localeCompare(b))
    };
  }

  private detectAnswerVsHypothesis(
    hypotheses: Hypothesis[],
    answers: StructuredAnswer[],
    questionToHypotheses: Map<string, string[]>,
    downgradedHypotheses: Set<string>
  ): ContradictionItem[] {
    const results: ContradictionItem[] = [];

    for (const answer of answers) {
      const relatedHypothesisIds = questionToHypotheses.get(answer.questionId) ?? [];
      for (const hypothesisId of relatedHypothesisIds) {
        const hypothesis = hypotheses.find((candidate) => candidate.id === hypothesisId);
        if (!hypothesis) continue;

        const answerLower = answer.answer.toLowerCase();
        const answerRejects = hasNegation(answerLower);
        const answerConfirms = hasConfirmation(answerLower);

        if (answerRejects && hypothesis.status !== "rejected") {
          if (hypothesis.status !== "needs-review") {
            hypothesis.status = "needs-review";
            hypothesis.needsConfirmation = true;
            downgradedHypotheses.add(hypothesis.id);
          }

          results.push({
            id: `contr-answer-hyp-${results.length + 1}`,
            type: "answer-hypothesis",
            severity: "critical",
            description:
              `Answer for question '${answer.questionId}' appears to reject hypothesis '${hypothesis.id}', ` +
              "so the hypothesis was downgraded to 'needs-review'.",
            relatedElements: [
              `questionId=${answer.questionId}`,
              `hypothesisId=${hypothesis.id}`,
              `hypothesisStatus=${hypothesis.status}`
            ],
            suggestedQuestion: `Should hypothesis '${hypothesis.id}' be rejected based on your answer '${answer.answer}'?`
          });
        }

        if (answerConfirms && hypothesis.status === "rejected") {
          results.push({
            id: `contr-answer-hyp-${results.length + 1}`,
            type: "answer-hypothesis",
            severity: "important",
            description:
              `Answer for question '${answer.questionId}' confirms hypothesis '${hypothesis.id}', ` +
              "but the hypothesis is currently rejected.",
            relatedElements: [
              `questionId=${answer.questionId}`,
              `hypothesisId=${hypothesis.id}`,
              `hypothesisStatus=${hypothesis.status}`
            ],
            suggestedQuestion: `Should hypothesis '${hypothesis.id}' be restored to confirmed or needs-review?`
          });
        }
      }
    }

    return uniqueByDescription(results);
  }

  private detectBoundaryVsInvariant(knowledge: ConsolidatedKnowledge): ContradictionItem[] {
    const results: ContradictionItem[] = [];
    const confirmedRules = knowledge.domainInvariants.rules.filter((rule) => rule.status === "confirmed");

    for (const relation of knowledge.conceptualBoundaries.allowedRelations) {
      const relationText = `${relation.from} ${relation.to}`.toLowerCase();

      for (const rule of confirmedRules) {
        const ruleText = `${rule.name} ${rule.description}`.toLowerCase();
        if (ruleText.includes(relation.from.toLowerCase()) && ruleText.includes(relation.to.toLowerCase()) && hasNegation(ruleText)) {
          results.push({
            id: `contr-boundary-inv-${results.length + 1}`,
            type: "boundary-invariant",
            severity: "critical",
            description:
              `Allowed relation '${relation.from} → ${relation.to}' may violate confirmed invariant '${rule.name}'.`,
            relatedElements: [
              `allowedRelation=${relation.from}->${relation.to}`,
              `invariant=${rule.name}`,
              `relationText=${relationText}`
            ],
            suggestedQuestion: `Should '${relation.from} → ${relation.to}' remain allowed, or should invariant '${rule.name}' take precedence?`
          });
        }
      }
    }

    return uniqueByDescription(results);
  }

  private detectDecisionVsManual(knowledge: ConsolidatedKnowledge, operatingManual?: string): ContradictionItem[] {
    if (!operatingManual || operatingManual.trim() === "") {
      return [];
    }

    const lines = operatingManual
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && (line.startsWith("-") || line.startsWith("*") || /^\d+\./.test(line)));

    const results: ContradictionItem[] = [];

    for (const decision of knowledge.decisions.decisions) {
      const decisionText = `${decision.title} ${decision.choice}`.toLowerCase();
      const decisionKeywords = extractKeywords(decisionText);

      for (const ruleLine of lines) {
        const ruleText = ruleLine.toLowerCase();
        const ruleKeywords = extractKeywords(ruleText);
        const sharedKeywords = [...decisionKeywords].filter((keyword) => ruleKeywords.has(keyword));
        if (sharedKeywords.length < 2) continue;

        const decisionNegates = hasNegation(decisionText);
        const ruleNegates = hasNegation(ruleText);
        if (decisionNegates === ruleNegates) continue;

        results.push({
          id: `contr-decision-manual-${results.length + 1}`,
          type: "decision-operating-manual",
          severity: "important",
          description:
            `Decision '${decision.title}' may contradict a rule in agent operating manual: '${ruleLine}'.`,
          relatedElements: [`decision=${decision.title}`, `manualRule=${ruleLine}`],
          suggestedQuestion: `Should the decision '${decision.title}' or the operating manual rule be updated to remove this contradiction?`
        });
      }
    }

    return uniqueByDescription(results);
  }

  private toQuestion(item: ContradictionItem, index: number): InterviewQuestion {
    return {
      id: `contradiction-q-${index + 1}`,
      category: "Contradiction",
      question: item.suggestedQuestion,
      context: item.description,
      relatedHypotheses: [],
      options: ["Confirm A", "Confirm B", "Needs review"],
      priority: item.severity === "critical" ? "critical" : "important"
    };
  }
}

function hasNegation(value: string): boolean {
  return [" not ", " não ", "nunca", "never", "must not", "forbidden", "prohibited", "cannot", "disallow"]
    .some((token) => value.includes(token.trim()) || value.includes(token));
}

function hasConfirmation(value: string): boolean {
  return ["yes", "sim", "correct", "exato", "allowed", "permitido", "confirm"]
    .some((token) => value.includes(token));
}

function extractKeywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, " ")
      .split(/\s+/)
      .filter((part) => part.length > 3)
  );
}

function uniqueByDescription(items: ContradictionItem[]): ContradictionItem[] {
  const seen = new Set<string>();
  const output: ContradictionItem[] = [];

  for (const item of items) {
    if (seen.has(item.description)) continue;
    seen.add(item.description);
    output.push(item);
  }

  return output;
}
