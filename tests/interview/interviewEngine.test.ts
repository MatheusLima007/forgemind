import { describe, expect, it } from "vitest";
import { InterviewEngine } from "../../src/core/interview/interviewEngine.js";
import type { ArchitecturalSignal, EvidenceEntry, Hypothesis, InterviewConfig, LLMRequest } from "../../src/core/types/index.js";

class MockProvider {
  lastRequest: LLMRequest | null = null;

  async chat(request: LLMRequest) {
    this.lastRequest = request;
    return {
      content: JSON.stringify({
        questions: [
          {
            id: "q-1",
            category: "Invariants",
            question: "What best describes approval behavior?",
            context: "Needed because claim has unknown evidence",
            relatedHypotheses: ["hyp-1"],
            options: ["Approval is mandatory", "Approval is optional"],
            priority: "critical"
          }
        ]
      }),
      metadata: {
        provider: "gemini",
        model: "mock"
      }
    };
  }
}

const interviewConfig: InterviewConfig = {
  maxQuestions: 10,
  adaptiveFollowUp: false,
  language: "en"
};

const hypotheses: Hypothesis[] = [
  {
    id: "hyp-1",
    category: "invariant",
    statement: "Approval must happen before shipping",
    confidence: 0.8,
    evidenceRefs: [],
    evidence: [],
    needsConfirmation: true,
    status: "pending"
  }
];

const signals: ArchitecturalSignal[] = [];
const unknownEvidence: EvidenceEntry[] = [
  {
    claimId: "hyp-1",
    claimType: "invariant",
    summary: "Approval ordering",
    evidence: [],
    confidence: "unknown",
    agentImpact: "Agent may violate critical state transition"
  }
];

describe("InterviewEngine", () => {
  it("uses unknown claims to drive guided questions and ensures minimum question count", async () => {
    const provider = new MockProvider();
    const engine = new InterviewEngine(provider as never, interviewConfig);

    const questions = await (engine as any).generateQuestions(hypotheses, signals, unknownEvidence, []);

    expect(questions.length).toBeGreaterThanOrEqual(5);
    expect(questions[0].options.length).toBeGreaterThanOrEqual(2);

    const userPayload = JSON.parse(provider.lastRequest?.messages[1].content ?? "{}");
    expect(userPayload.unknownClaims).toHaveLength(1);
    expect(userPayload.unknownClaims[0].claimId).toBe("hyp-1");
  });

  it("downgrades contradicted inference when answer is custom free text", () => {
    const provider = new MockProvider();
    const engine = new InterviewEngine(provider as never, interviewConfig);

    const mutableHypotheses: Hypothesis[] = [
      {
        id: "hyp-2",
        category: "domain",
        statement: "System is event-driven",
        confidence: 0.7,
        evidenceRefs: [],
        evidence: [],
        needsConfirmation: true,
        status: "pending"
      }
    ];

    const question = {
      id: "q-2",
      category: "General",
      question: "Is it event-driven?",
      context: "",
      relatedHypotheses: ["hyp-2"],
      options: ["Yes", "No"],
      priority: "important"
    };

    (engine as any).updateHypotheses(mutableHypotheses, question, "This is wrong in this repository", "custom");
    expect(mutableHypotheses[0].status).toBe("rejected");
  });
});
