import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SemanticContextStore } from "../../src/core/orchestrator/semanticContextStore.js";
import type { SemanticContext } from "../../src/core/types/index.js";

function buildContext(): SemanticContext {
  return {
    version: "1.0.0",
    forgemindVersion: "0.2.0",
    generatedAt: "2026-03-05T00:00:00.000Z",
    signals: [
      {
        type: "modular",
        source: "scanner",
        confidence: 0.9,
        evidence: ["src/core"],
        description: "Modular structure"
      }
    ],
    hypotheses: [
      {
        id: "h1",
        category: "boundary",
        statement: "Boundary exists",
        confidence: 0.8,
        evidenceRefs: [{ path: "src/core/index.ts" }],
        evidence: [],
        needsConfirmation: false,
        status: "confirmed"
      }
    ],
    interviewSessions: [
      {
        id: "session-b",
        version: "1.0.0",
        forgemindVersion: "0.2.0",
        startedAt: "2026-03-05T00:00:00.000Z",
        questions: [],
        answers: []
      },
      {
        id: "session-a",
        version: "1.0.0",
        forgemindVersion: "0.2.0",
        startedAt: "2026-03-05T00:00:00.000Z",
        questions: [],
        answers: []
      }
    ],
    consolidatedKnowledge: {
      systemOntology: {
        corePurpose: "purpose",
        mentalModel: "model",
        centralConcepts: ["concept"],
        systemOrientation: "orientation",
        principles: ["principle"]
      },
      domainInvariants: {
        rules: [],
        validStates: [],
        invalidStates: [],
        constraints: []
      },
      conceptualBoundaries: {
        contexts: [],
        allowedRelations: [],
        prohibitedRelations: [],
        dangerousInteractions: []
      },
      decisions: {
        decisions: []
      },
      cognitiveRisks: {
        likelyErrors: [],
        deceptivePatterns: [],
        implicitCoupling: [],
        invisibleSideEffects: [],
        operationalAssumptions: []
      },
      evidenceIndex: [],
      gaps: []
    },
    consolidatedKnowledgeHash: "hash-1"
  };
}

describe("SemanticContextStore", () => {
  it("saves and loads partitioned semantic context", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "forgemind-context-"));
    const store = new SemanticContextStore();
    const context = buildContext();

    await store.save(baseDir, context);
    const loaded = await store.load(baseDir);

    expect(loaded).not.toBeNull();
    expect(loaded?.version).toBe("1.0.0");
    expect(loaded?.signals).toHaveLength(1);
    expect(loaded?.hypotheses).toHaveLength(1);
    expect(loaded?.interviewSessions.map((session) => session.id)).toEqual(["session-a", "session-b"]);
    expect(loaded?.consolidatedKnowledgeHash).toBe("hash-1");
  });

  it("loads correctly when base path is already ai/context", async () => {
    const intermediateDir = await mkdtemp(join(tmpdir(), "forgemind-context-dir-"));
    const store = new SemanticContextStore();
    const context = buildContext();

    await store.save(intermediateDir, context);
    const explicitContextPath = join(intermediateDir, "context");
    const loaded = await store.load(explicitContextPath);

    expect(loaded).not.toBeNull();
    expect(loaded?.consolidatedKnowledge.systemOntology.corePurpose).toBe("purpose");
  });
});
