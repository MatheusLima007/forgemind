import { basename, extname, relative } from "node:path";
import { readTextFile, walkFiles } from "../../utils/fileSystem.js";
import type { DomainCandidate, ScanResult } from "../types/index.js";

const TEXT_LIKE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".yaml", ".yml", ".toml", ".ini", ".env",
  ".py", ".go", ".java", ".kt", ".rb", ".php", ".rs", ".swift", ".dart", ".cs", ".c", ".cpp", ".h", ".hpp",
  ".md", ".txt", ".sh", ".sql", ".xml", ".proto"
]);

const ENTITY_FILE_PATTERNS = [
  /entity/i,
  /model/i,
  /aggregate/i,
  /dto/i,
  /schema/i,
  /validator/i,
  /error/i,
  /exception/i,
];

const CLASS_LIKE_PATTERNS: Array<{ regex: RegExp; kind: DomainCandidate["kind"] }> = [
  { regex: /\bclass\s+([A-Z][A-Za-z0-9_]*)/g, kind: "entity" },
  { regex: /\binterface\s+([A-Z][A-Za-z0-9_]*)/g, kind: "entity" },
  { regex: /\btype\s+([A-Z][A-Za-z0-9_]*)/g, kind: "entity" },
  { regex: /\benum\s+([A-Z][A-Za-z0-9_]*)/g, kind: "entity" },
  { regex: /\bstruct\s+([A-Z][A-Za-z0-9_]*)/g, kind: "entity" },
  { regex: /\bdata\s+class\s+([A-Z][A-Za-z0-9_]*)/g, kind: "entity" },
];

const GUARD_PATTERNS = [
  /if\s*\(\s*!/g,
  /\bthrow\b/g,
  /\bassert\b/g,
  /\bvalidate\w*\b/g,
  /\brequire\w*\b/g,
  /\bguard\w*\b/g,
];

const WORKFLOW_GROUPS: Array<{ key: string; actions: string[] }> = [
  { key: "lifecycle", actions: ["create", "approve", "cancel"] },
  { key: "process", actions: ["start", "stop"] },
  { key: "messaging", actions: ["publish", "consume"] },
  { key: "state", actions: ["open", "close"] },
  { key: "registration", actions: ["register", "activate", "deactivate"] },
];

const EVENT_PATTERNS = [/event/i, /message/i, /command/i, /handler/i];
const MAX_CANDIDATES = 500;
const MAX_FILE_BYTES = 100_000;
const MAX_CLASS_SCAN_CHARS = 16_000;

export class DomainMiner {
  async mine(scan: ScanResult, ignoreDirs: string[]): Promise<DomainCandidate[]> {
    const files = await walkFiles(scan.rootPath, ignoreDirs);
    const candidates: DomainCandidate[] = [];

    const pushCandidate = (candidate: DomainCandidate): void => {
      if (candidates.length >= MAX_CANDIDATES) return;
      if (candidates.some((existing) => existing.kind === candidate.kind && existing.filePath === candidate.filePath && existing.name === candidate.name)) {
        return;
      }
      candidates.push(candidate);
    };

    for (const absolutePath of files) {
      if (candidates.length >= MAX_CANDIDATES) break;

      const filePath = relative(scan.rootPath, absolutePath);
      const fileName = basename(absolutePath);
      const extension = extname(fileName).toLowerCase();
      const stem = fileName.replace(/\.[^/.]+$/, "");

      if (ENTITY_FILE_PATTERNS.some((pattern) => pattern.test(stem))) {
        pushCandidate({
          name: stem,
          kind: stem.toLowerCase().includes("schema") ? "schema" : "entity",
          source: "filename",
          filePath,
          symbol: stem
        });
      }

      if (EVENT_PATTERNS.some((pattern) => pattern.test(stem))) {
        pushCandidate({
          name: stem,
          kind: "event",
          source: "filename",
          filePath,
          symbol: stem
        });
      }

      if (!TEXT_LIKE_EXTENSIONS.has(extension)) continue;

      const content = await this.safeRead(absolutePath);
      if (!content) continue;

      this.extractClassLikeCandidates(content.slice(0, MAX_CLASS_SCAN_CHARS), filePath, pushCandidate);
      this.extractGuardCandidates(content, filePath, pushCandidate);
    }

    this.extractWorkflowCandidates(files.map((path) => relative(scan.rootPath, path)), pushCandidate);

    return candidates;
  }

  private async safeRead(path: string): Promise<string | null> {
    try {
      const content = await readTextFile(path);
      if (content.length > MAX_FILE_BYTES) {
        return content.slice(0, MAX_FILE_BYTES);
      }
      return content;
    } catch {
      return null;
    }
  }

  private extractClassLikeCandidates(
    content: string,
    filePath: string,
    pushCandidate: (candidate: DomainCandidate) => void
  ): void {
    for (const rule of CLASS_LIKE_PATTERNS) {
      const regex = new RegExp(rule.regex.source, rule.regex.flags);
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        const symbol = match[1];
        const lines = this.findLineRange(content, match.index);
        pushCandidate({
          name: symbol,
          kind: rule.kind,
          source: "symbol",
          filePath,
          symbol,
          lines
        });
      }
    }
  }

  private extractGuardCandidates(
    content: string,
    filePath: string,
    pushCandidate: (candidate: DomainCandidate) => void
  ): void {
    let hits = 0;
    for (const pattern of GUARD_PATTERNS) {
      const regex = new RegExp(pattern.source, pattern.flags);
      const matchCount = content.match(regex)?.length ?? 0;
      hits += matchCount;
    }

    if (hits < 3) return;

    pushCandidate({
      name: `guard-surface:${basename(filePath)}`,
      kind: hits >= 6 ? "invariant" : "guard",
      source: "validation-patterns",
      filePath,
      lines: "1-200"
    });
  }

  private extractWorkflowCandidates(
    relativePaths: string[],
    pushCandidate: (candidate: DomainCandidate) => void
  ): void {
    const lowerFiles = relativePaths.map((path) => ({ path, stem: basename(path).replace(/\.[^/.]+$/, "").toLowerCase() }));

    for (const group of WORKFLOW_GROUPS) {
      const matches = lowerFiles.filter((entry) => group.actions.some((action) => entry.stem.includes(action)));
      if (matches.length < 2) continue;

      pushCandidate({
        name: `${group.key}-workflow`,
        kind: "workflow",
        source: "naming-convention",
        filePath: matches[0].path,
        symbol: group.actions.join("/")
      });
    }
  }

  private findLineRange(content: string, index: number): string {
    const snippet = content.slice(0, index);
    const line = snippet.split("\n").length;
    return `${line}-${line + 2}`;
  }
}
