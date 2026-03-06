import { readdir } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { ensureDir, fileExists, readTextFile, writeTextFile } from "../../utils/fileSystem.js";
import { stableStringify } from "../../utils/hashing.js";
import type { InterviewSession, SemanticContext } from "../types/index.js";

const CONTEXT_DIR = "context";
const CONTEXT_LEGACY_FILE = "context.json";
const CONTEXT_METADATA_FILE = "metadata.json";
const CONTEXT_SIGNALS_FILE = "signals.json";
const CONTEXT_HYPOTHESES_FILE = "hypotheses.json";
const CONTEXT_KNOWLEDGE_FILE = "knowledge.json";
const CONTEXT_INTERVIEW_INDEX_FILE = "index.json";
const CONTEXT_INTERVIEWS_DIR = "interviews";

interface PartitionedContextMetadata {
  version: string;
  forgemindVersion: string;
  generatedAt: string;
  consolidatedKnowledgeHash?: string;
}

interface InterviewIndexArtifact {
  sessions: string[];
}

function sanitizeSessionId(sessionId: string): string {
  const trimmed = sessionId.trim();
  if (trimmed.length === 0) {
    return "session";
  }
  return trimmed.replaceAll(/[^a-zA-Z0-9._-]/g, "-");
}

async function readJsonFile<T>(path: string): Promise<T> {
  const content = await readTextFile(path);
  return JSON.parse(content) as T;
}

export class SemanticContextStore {
  getLegacyContextPath(intermediateDir: string): string {
    return resolve(intermediateDir, CONTEXT_LEGACY_FILE);
  }

  getPartitionedContextDir(baseDir: string): string {
    const normalizedBaseName = basename(baseDir);
    if (normalizedBaseName === CONTEXT_DIR) {
      return resolve(baseDir);
    }
    return resolve(baseDir, CONTEXT_DIR);
  }

  async load(baseDir: string): Promise<SemanticContext | null> {
    const partitioned = await this.loadPartitioned(baseDir);
    if (partitioned) {
      return partitioned;
    }

    const legacyBaseDir = basename(baseDir) === CONTEXT_DIR ? resolve(baseDir, "..") : baseDir;
    const legacyPath = this.getLegacyContextPath(legacyBaseDir);
    if (!(await fileExists(legacyPath))) {
      return null;
    }

    return readJsonFile<SemanticContext>(legacyPath);
  }

  async save(baseDir: string, context: SemanticContext): Promise<void> {
    const contextDir = this.getPartitionedContextDir(baseDir);
    const interviewsDir = resolve(contextDir, CONTEXT_INTERVIEWS_DIR);
    await Promise.all([ensureDir(contextDir), ensureDir(interviewsDir)]);

    const metadata: PartitionedContextMetadata = {
      version: context.version,
      forgemindVersion: context.forgemindVersion,
      generatedAt: context.generatedAt,
      consolidatedKnowledgeHash: context.consolidatedKnowledgeHash
    };

    await Promise.all([
      writeTextFile(resolve(contextDir, CONTEXT_METADATA_FILE), stableStringify(metadata)),
      writeTextFile(resolve(contextDir, CONTEXT_SIGNALS_FILE), stableStringify({ signals: context.signals })),
      writeTextFile(resolve(contextDir, CONTEXT_HYPOTHESES_FILE), stableStringify({ hypotheses: context.hypotheses })),
      writeTextFile(resolve(contextDir, CONTEXT_KNOWLEDGE_FILE), stableStringify({ consolidatedKnowledge: context.consolidatedKnowledge }))
    ]);

    const sessionFilenames: string[] = [];
    for (const session of context.interviewSessions) {
      const fileName = `${sanitizeSessionId(session.id)}.json`;
      sessionFilenames.push(fileName);
      await writeTextFile(resolve(interviewsDir, fileName), stableStringify(session));
    }

    const interviewIndex: InterviewIndexArtifact = {
      sessions: sessionFilenames.sort((left, right) => left.localeCompare(right))
    };
    await writeTextFile(resolve(interviewsDir, CONTEXT_INTERVIEW_INDEX_FILE), stableStringify(interviewIndex));
  }

  private async loadPartitioned(baseDir: string): Promise<SemanticContext | null> {
    const contextDir = this.getPartitionedContextDir(baseDir);
    const metadataPath = resolve(contextDir, CONTEXT_METADATA_FILE);
    const signalsPath = resolve(contextDir, CONTEXT_SIGNALS_FILE);
    const hypothesesPath = resolve(contextDir, CONTEXT_HYPOTHESES_FILE);
    const knowledgePath = resolve(contextDir, CONTEXT_KNOWLEDGE_FILE);

    const hasRequired = await Promise.all([
      fileExists(metadataPath),
      fileExists(signalsPath),
      fileExists(hypothesesPath),
      fileExists(knowledgePath)
    ]);

    if (!hasRequired.every(Boolean)) {
      return null;
    }

    const metadata = await readJsonFile<PartitionedContextMetadata>(metadataPath);
    const signalsArtifact = await readJsonFile<{ signals: SemanticContext["signals"] }>(signalsPath);
    const hypothesesArtifact = await readJsonFile<{ hypotheses: SemanticContext["hypotheses"] }>(hypothesesPath);
    const knowledgeArtifact = await readJsonFile<{ consolidatedKnowledge: SemanticContext["consolidatedKnowledge"] }>(knowledgePath);

    const interviewSessions = await this.loadInterviewSessions(contextDir);

    return {
      version: metadata.version,
      forgemindVersion: metadata.forgemindVersion,
      generatedAt: metadata.generatedAt,
      consolidatedKnowledgeHash: metadata.consolidatedKnowledgeHash,
      signals: signalsArtifact.signals,
      hypotheses: hypothesesArtifact.hypotheses,
      interviewSessions,
      consolidatedKnowledge: knowledgeArtifact.consolidatedKnowledge
    };
  }

  private async loadInterviewSessions(contextDir: string): Promise<InterviewSession[]> {
    const interviewsDir = resolve(contextDir, CONTEXT_INTERVIEWS_DIR);
    if (!(await fileExists(interviewsDir))) {
      return [];
    }

    const interviewIndexPath = resolve(interviewsDir, CONTEXT_INTERVIEW_INDEX_FILE);
    let sessionFiles: string[] = [];

    if (await fileExists(interviewIndexPath)) {
      const index = await readJsonFile<InterviewIndexArtifact>(interviewIndexPath);
      sessionFiles = [...index.sessions];
    } else {
      const dirEntries = await readdir(interviewsDir, { withFileTypes: true });
      sessionFiles = dirEntries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => entry.name)
        .filter((fileName) => fileName !== CONTEXT_INTERVIEW_INDEX_FILE)
        .sort((left, right) => left.localeCompare(right));
    }

    const sessions: InterviewSession[] = [];
    for (const fileName of sessionFiles) {
      if (basename(fileName) === CONTEXT_INTERVIEW_INDEX_FILE) {
        continue;
      }
      const sessionPath = resolve(interviewsDir, fileName);
      if (!(await fileExists(sessionPath))) {
        continue;
      }
      sessions.push(await readJsonFile<InterviewSession>(sessionPath));
    }

    return sessions.sort((left, right) => left.id.localeCompare(right.id));
  }
}
