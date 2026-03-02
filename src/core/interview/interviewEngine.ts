import { createInterface, type Interface as ReadlineInterface } from "node:readline";
import { v4IdLike } from "../../utils/hashing.js";
import type {
  ArchitecturalSignal,
  DomainCandidate,
  EvidenceEntry,
  Hypothesis,
  InterviewAnswer,
  InterviewQuestion,
  InterviewSession,
  InterviewConfig,
  LLMRequest,
} from "../types/index.js";
import type { LLMProvider } from "../../llm/provider.interface.js";
import { INTERVIEW_SYSTEM_PROMPT } from "../intelligence/prompts/hypothesisPrompts.js";
import { InterviewRenderer } from "./interviewRenderer.js";
import { FORGEMIND_VERSION } from "../config/defaults.js";

export class InterviewEngine {
  private readonly renderer: InterviewRenderer;

  constructor(
    private readonly provider: LLMProvider,
    private readonly interviewConfig: InterviewConfig
  ) {
    this.renderer = new InterviewRenderer();
  }

  async conduct(
    hypotheses: Hypothesis[],
    signals: ArchitecturalSignal[],
    evidenceMap: EvidenceEntry[] = [],
    domainCandidates: DomainCandidate[] = []
  ): Promise<InterviewSession> {
    const session: InterviewSession = {
      id: generateSessionId(),
      version: "1.0.0",
      forgemindVersion: FORGEMIND_VERSION,
      startedAt: new Date().toISOString(),
      questions: [],
      answers: []
    };

    // Generate initial questions from hypotheses
    const questions = await this.generateQuestions(hypotheses, signals, evidenceMap, domainCandidates);
    session.questions = questions;

    // Create readline interface
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    this.renderer.renderHeader(questions.length);

    try {
      // Sort by priority: critical → important → nice-to-have
      const sortedQuestions = this.sortByPriority(questions);
      const maxQuestions = Math.min(sortedQuestions.length, this.interviewConfig.maxQuestions);

      for (let i = 0; i < maxQuestions; i++) {
        const question = sortedQuestions[i];

        this.renderer.renderQuestion(question, i + 1, maxQuestions);

        const answer = await this.askQuestion(rl, question);

        if (answer.answer === "/done") {
          this.renderer.renderEarlyExit(i + 1);
          break;
        }

        if (answer.answer === "/skip") {
          this.renderer.renderSkip();
          continue;
        }

        const interviewAnswer: InterviewAnswer = {
          questionId: question.id,
          answer: answer.answer,
          selectedOption: answer.selectedOption,
          source: answer.source,
          timestamp: new Date().toISOString()
        };

        session.answers.push(interviewAnswer);

        // Update hypothesis status based on answer
        this.updateHypotheses(hypotheses, question, answer.answer, answer.source);

        // Generate adaptive follow-up if enabled
        if (this.interviewConfig.adaptiveFollowUp && i < maxQuestions - 1) {
          const followUp = await this.generateFollowUp(question, answer.answer, hypotheses, signals);
          if (followUp) {
            sortedQuestions.splice(i + 1, 0, followUp);
            session.questions.push(followUp);
          }
        }
      }
    } finally {
      rl.close();
    }

    session.completedAt = new Date().toISOString();
    this.renderer.renderComplete(session.answers.length);

    return session;
  }

  private async generateQuestions(
    hypotheses: Hypothesis[],
    signals: ArchitecturalSignal[],
    evidenceMap: EvidenceEntry[],
    domainCandidates: DomainCandidate[]
  ): Promise<InterviewQuestion[]> {
    // Filter hypotheses that need confirmation
    const confirmable = hypotheses.filter((h) => h.needsConfirmation);

    const userPrompt = JSON.stringify({
      language: this.interviewConfig.language,
      hypotheses: confirmable.map((h) => ({
        id: h.id,
        category: h.category,
        statement: h.statement,
        confidence: h.confidence
      })),
      architecturalSignals: signals.slice(0, 20).map((s) => ({
        type: s.type,
        description: s.description,
        confidence: s.confidence
      })),
      unknownClaims: evidenceMap
        .filter((entry) => entry.confidence === "unknown")
        .slice(0, 20)
        .map((entry) => ({
          claimId: entry.claimId,
          claimType: entry.claimType,
          summary: entry.summary,
          agentImpact: entry.agentImpact
        })),
      domainCandidates: domainCandidates.slice(0, 50),
      maxQuestions: Math.min(this.interviewConfig.maxQuestions, 12)
    }, null, 2);

    const request: LLMRequest = {
      messages: [
        { role: "system", content: INTERVIEW_SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
      jsonMode: true
    };

    const response = await this.provider.chat(request);
    const generated = this.parseQuestions(response.content);

    const minimum = 5;
    if (generated.length >= minimum) {
      return generated;
    }

    const fallback = this.buildFallbackQuestions(confirmable, minimum - generated.length);
    return [...generated, ...fallback];
  }

  private buildFallbackQuestions(hypotheses: Hypothesis[], count: number): InterviewQuestion[] {
    const fallback: InterviewQuestion[] = [];
    const source = hypotheses.slice(0, Math.max(count, 1));

    for (let i = 0; i < count; i++) {
      const hypothesis = source.length > 0 ? source[i % source.length] : undefined;
      fallback.push({
        id: `fallback-${i + 1}`,
        category: "General",
        question: hypothesis
          ? `Which option best reflects this hypothesis: "${hypothesis.statement}"?`
          : "What best describes the system behavior this project must preserve?",
        context: "Fallback question generated to ensure minimum interview coverage.",
        relatedHypotheses: hypothesis ? [hypothesis.id] : [],
        options: ["Confirmed", "Partially true", "Not true"],
        priority: "important"
      });
    }

    return fallback;
  }

  private async generateFollowUp(
    lastQuestion: InterviewQuestion,
    answer: string,
    hypotheses: Hypothesis[],
    signals: ArchitecturalSignal[]
  ): Promise<InterviewQuestion | null> {
    try {
      const request: LLMRequest = {
        messages: [
          {
            role: "system",
            content: "Based on the developer's answer, generate ONE follow-up question that digs deeper into the revealed information. Return JSON: {\"question\": {\"id\": \"follow-X\", \"category\": \"...\", \"question\": \"...\", \"context\": \"...\", \"relatedHypotheses\": [], \"priority\": \"important\"}} or {\"question\": null} if no follow-up is needed."
          },
          {
            role: "user",
            content: JSON.stringify({
              lastQuestion: lastQuestion.question,
              answer,
              language: this.interviewConfig.language
            })
          }
        ],
        temperature: 0.3,
        jsonMode: true
      };

      const response = await this.provider.chat(request);
      const parsed = JSON.parse(this.extractJson(response.content)) as { question: unknown | null };

      if (!parsed.question) return null;

      return this.normalizeQuestion(parsed.question, 100);
    } catch {
      return null; // Follow-up generation is best-effort
    }
  }

  private async askQuestion(
    rl: ReadlineInterface,
    question: InterviewQuestion
  ): Promise<{ answer: string; selectedOption?: number; source?: "selected" | "custom" }> {
    return new Promise((resolve) => {
      rl.question("\n> ", (answer) => {
        const trimmed = answer.trim();
        if (trimmed === "/skip" || trimmed === "/done") {
          resolve({ answer: trimmed });
          return;
        }

        if (Array.isArray(question.options) && question.options.length > 0) {
          const numericChoice = Number.parseInt(trimmed, 10);
          if (!Number.isNaN(numericChoice) && numericChoice >= 1 && numericChoice <= question.options.length) {
            resolve({
              answer: question.options[numericChoice - 1],
              selectedOption: numericChoice - 1,
              source: "selected"
            });
            return;
          }
        }

        resolve({ answer: trimmed, source: "custom" });
      });
    });
  }

  private updateHypotheses(
    hypotheses: Hypothesis[],
    question: InterviewQuestion,
    answer: string,
    source: "selected" | "custom" | undefined
  ): void {
    // Simple heuristic: if the answer contains negation words, mark related hypotheses as rejected
    const lowerAnswer = answer.toLowerCase();
    const negations = ["no", "não", "never", "nunca", "wrong", "incorrect", "errado", "not", "nope"];
    const confirmations = ["yes", "sim", "correct", "correto", "exactly", "exatamente", "right", "certo"];

    const isNegation = negations.some((n) => lowerAnswer.startsWith(n) || lowerAnswer.includes(` ${n} `));
    const isConfirmation = confirmations.some((n) => lowerAnswer.startsWith(n) || lowerAnswer.includes(` ${n} `));

    for (const hypId of question.relatedHypotheses) {
      const hypothesis = hypotheses.find((h) => h.id === hypId);
      if (!hypothesis) continue;

      if (source === "custom" && isNegation) {
        hypothesis.status = "rejected";
      } else if (source === "custom" && !isConfirmation) {
        hypothesis.status = "rejected";
      } else if (isNegation) {
        hypothesis.status = "rejected";
      } else if (isConfirmation) {
        hypothesis.status = "confirmed";
      } else if (source === "selected") {
        hypothesis.status = "confirmed";
      }
    }
  }

  private parseQuestions(content: string): InterviewQuestion[] {
    try {
      const jsonStr = this.extractJson(content);
      const parsed = JSON.parse(jsonStr) as { questions?: unknown[] };

      if (!parsed.questions || !Array.isArray(parsed.questions)) {
        throw new Error("Response must contain a 'questions' array");
      }

      return parsed.questions.map((q, i) => this.normalizeQuestion(q, i));
    } catch (error) {
      throw new Error(`Failed to parse interview questions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private normalizeQuestion(raw: unknown, index: number): InterviewQuestion {
    const q = raw as Record<string, unknown>;
    const validPriorities = ["critical", "important", "nice-to-have"];

    return {
      id: (q.id as string) ?? `q-${index + 1}`,
      category: (q.category as string) ?? "General",
      question: (q.question as string) ?? "",
      context: (q.context as string) ?? "",
      relatedHypotheses: Array.isArray(q.relatedHypotheses) ? q.relatedHypotheses.map(String) : [],
      options: Array.isArray(q.options)
        ? q.options.map(String).filter((option) => option.trim().length > 0).slice(0, 4)
        : ["Strongly yes", "Partially", "No"],
      priority: validPriorities.includes(q.priority as string)
        ? (q.priority as InterviewQuestion["priority"])
        : "important"
    };
  }

  private sortByPriority(questions: InterviewQuestion[]): InterviewQuestion[] {
    const priorityOrder = { critical: 0, important: 1, "nice-to-have": 2 };
    return [...questions].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  private extractJson(text: string): string {
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const cleaned = fenceMatch ? fenceMatch[1].trim() : text;

    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Response did not contain valid JSON");
    }

    return cleaned.slice(start, end + 1);
  }
}

function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
