// ─────────────────────────────────────────────────────────────
// ForgeMind — Phase 1 / BoundaryEnforcer
// Builds an import graph for TS/JS files and enforces prohibited
// context relations from ConceptualBoundaryKnowledge.
// Uses ts-morph (already a project dependency).
// Falls back to regex-based import parsing for non-TS projects.
// ─────────────────────────────────────────────────────────────

import { join, relative, extname } from "node:path";
import { readdir, readFile } from "node:fs/promises";
import type { ConceptualBoundaryKnowledge, EnforcementViolation, ViolationSeverity } from "../types/index.js";

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "coverage", ".cache"]);
const TS_JS_EXTS = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"];

// ── Import extraction (regex-based, no AST dep needed at runtime) ──

function extractImports(content: string): string[] {
  const imports: string[] = [];
  const patterns = [
    /(?:^|\n)\s*import\s+[^'"]*from\s+['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*export\s+[^'"]*from\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      imports.push(match[1]);
    }
  }

  return imports;
}

function importLine(content: string, importPath: string): number {
  const i1 = content.indexOf(`'${importPath}'`);
  const i2 = content.indexOf(`"${importPath}"`);
  const pos = i1 === -1 ? i2 : i2 === -1 ? i1 : Math.min(i1, i2);
  return pos === -1 ? 1 : content.slice(0, pos).split("\n").length;
}

// ── File → Context mapping ────────────────────────────────────

/**
 * Maps a file path to a context name by checking if any context name
 * appears as a segment in the file path (case-insensitive).
 * Returns undefined when no context matches.
 */
function resolveContext(filePath: string, contextNames: string[]): string | undefined {
  const normalized = filePath.toLowerCase().replace(/\\/g, "/");
  const segments = normalized.split("/");

  for (const name of contextNames) {
    const lower = name.toLowerCase();
    // exact segment match is preferred
    if (segments.some((s) => s === lower || s.startsWith(lower + ".") || s.startsWith(lower + "-"))) {
      return name;
    }
  }

  // substring match as fallback
  for (const name of contextNames) {
    if (normalized.includes(name.toLowerCase())) {
      return name;
    }
  }

  return undefined;
}

// ── Directory walker ──────────────────────────────────────────

async function collectSourceFiles(root: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries: import("node:fs").Dirent[];
    try {
      const fs = await import("node:fs");
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) await walk(full);
      } else if (entry.isFile() && TS_JS_EXTS.includes(extname(entry.name))) {
        results.push(full);
      }
    }
  }

  await walk(root);
  return results;
}

// ── BoundaryEnforcer ──────────────────────────────────────────

export class BoundaryEnforcer {
  /**
   * Scans all TS/JS files in rootPath and reports violations of
   * prohibited context relations defined in the knowledge.
   */
  async enforce(
    knowledge: ConceptualBoundaryKnowledge,
    rootPath: string
  ): Promise<EnforcementViolation[]> {
    if (knowledge.prohibitedRelations.length === 0) return [];

    const contextNames = knowledge.contexts.map((c) => c.name);
    const files = await collectSourceFiles(rootPath);
    const violations: EnforcementViolation[] = [];

    // Build a set for O(1) lookup of prohibited pairs
    const prohibitedSet = new Map<string, string>();
    for (const rel of knowledge.prohibitedRelations) {
      prohibitedSet.set(`${rel.from}→${rel.to}`, rel.reason);
    }

    for (const file of files) {
      const rel = relative(rootPath, file);
      const fromContext = resolveContext(rel, contextNames);
      if (!fromContext) continue;

      let content: string;
      try {
        content = await readFile(file, "utf-8");
      } catch {
        continue;
      }

      for (const imp of extractImports(content)) {
        // Only look at relative imports (cross-context imports are usually relative or scoped)
        const toContext = resolveContext(imp, contextNames);
        if (!toContext || toContext === fromContext) continue;

        const key = `${fromContext}→${toContext}`;
        const reason = prohibitedSet.get(key);
        if (reason) {
          violations.push({
            ruleId: `boundary-${slugify(fromContext)}-to-${slugify(toContext)}`,
            ruleName: `Prohibited: ${fromContext} → ${toContext}`,
            kind: "boundary",
            severity: "critical",
            message: `'${rel}' (context: ${fromContext}) imports from '${imp}' (context: ${toContext}). ${reason}`,
            file: rel,
            line: importLine(content, imp),
            fromContext,
            toContext,
            fixHint: `Remove or refactor the dependency from '${fromContext}' to '${toContext}'. Reason: ${reason}`,
          });
        }
      }
    }

    return violations;
  }
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}
