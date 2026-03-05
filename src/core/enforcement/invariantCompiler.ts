// ─────────────────────────────────────────────────────────────
// ForgeMind — Phase 1 / InvariantCompiler
// Compiles confirmed invariants into executable deterministic checks.
// No LLM calls — fully static analysis.
// ─────────────────────────────────────────────────────────────

import { readdir, readFile, access } from "node:fs/promises";
import { join, extname, basename, relative } from "node:path";
import type {
  DomainInvariantKnowledge,
  EnforcementViolation,
  InvariantEnforcementSpec,
  ViolationSeverity,
} from "../types/index.js";

// ── Helpers ───────────────────────────────────────────────────

async function collectSourceFiles(root: string, extensions: string[]): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries: import("node:fs").Dirent[];
    try {
      const { readdirSync } = await import("node:fs");
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          await walk(full);
        }
      } else if (entry.isFile() && extensions.includes(extname(entry.name))) {
        results.push(full);
      }
    }
  }

  await walk(root);
  return results;
}

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "coverage", ".cache"]);
const TS_JS_EXTS = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"];

// Extract import paths from file content (static analysis, no AST — fast and dependency-free)
function extractImports(content: string): string[] {
  const imports: string[] = [];
  // ESM static imports: import ... from "..."
  const esmStatic = /(?:^|\n)\s*import\s+[^'"]*from\s+['"]([^'"]+)['"]/g;
  // ESM re-exports: export ... from "..."
  const esmReexport = /(?:^|\n)\s*export\s+[^'"]*from\s+['"]([^'"]+)['"]/g;
  // Dynamic imports: import("...")
  const dynamicImport = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  // require("...")
  const cjsRequire = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (const regex of [esmStatic, esmReexport, dynamicImport, cjsRequire]) {
    let match: RegExpExecArray | null;
    regex.lastIndex = 0;
    while ((match = regex.exec(content)) !== null) {
      imports.push(match[1]);
    }
  }

  return imports;
}

function lineOf(content: string, offset: number): number {
  return content.slice(0, offset).split("\n").length;
}

function importLineNumber(content: string, importPath: string): number {
  const idx = content.indexOf(`'${importPath}'`);
  const idx2 = content.indexOf(`"${importPath}"`);
  const pos = idx === -1 ? idx2 : idx2 === -1 ? idx : Math.min(idx, idx2);
  return pos === -1 ? 1 : lineOf(content, pos);
}

// ── Rule Executors ────────────────────────────────────────────

async function runForbiddenImport(
  ruleId: string,
  ruleName: string,
  severity: ViolationSeverity,
  spec: InvariantEnforcementSpec,
  rootPath: string
): Promise<EnforcementViolation[]> {
  if (!spec.pattern) return [];

  const pattern = spec.pattern;
  let patternRegex: RegExp;
  try {
    patternRegex = new RegExp(pattern);
  } catch {
    // Fall back to substring match
    patternRegex = new RegExp(pattern.replace(/[$()*+.[\]?\\^{}|]/g, "\\$&"));
  }

  const files = await collectSourceFiles(rootPath, TS_JS_EXTS);
  const violations: EnforcementViolation[] = [];

  for (const file of files) {
    let content: string;
    try {
      content = await readFile(file, "utf-8");
    } catch {
      continue;
    }

    for (const imp of extractImports(content)) {
      if (patternRegex.test(imp)) {
        violations.push({
          ruleId,
          ruleName,
          kind: "invariant",
          severity,
          message: `Forbidden import '${imp}' (matches pattern '${pattern}')`,
          file: relative(rootPath, file),
          line: importLineNumber(content, imp),
          fixHint: spec.fixHint,
        });
      }
    }
  }

  return violations;
}

async function runRequiredFileExists(
  ruleId: string,
  ruleName: string,
  severity: ViolationSeverity,
  spec: InvariantEnforcementSpec,
  rootPath: string
): Promise<EnforcementViolation[]> {
  if (!spec.path) return [];

  const fullPath = join(rootPath, spec.path);
  try {
    await access(fullPath);
    return [];
  } catch {
    return [
      {
        ruleId,
        ruleName,
        kind: "invariant",
        severity,
        message: `Required file '${spec.path}' does not exist`,
        file: spec.path,
        fixHint: spec.fixHint ?? `Create '${spec.path}' as required by invariant '${ruleName}'`,
      },
    ];
  }
}

async function runRequiredSymbolExists(
  ruleId: string,
  ruleName: string,
  severity: ViolationSeverity,
  spec: InvariantEnforcementSpec,
  rootPath: string
): Promise<EnforcementViolation[]> {
  if (!spec.symbol || !spec.file) return [];

  const fullPath = join(rootPath, spec.file);
  let content: string;
  try {
    content = await readFile(fullPath, "utf-8");
  } catch {
    return [
      {
        ruleId,
        ruleName,
        kind: "invariant",
        severity,
        message: `Required symbol '${spec.symbol}' could not be checked: file '${spec.file}' not found`,
        file: spec.file,
        fixHint: spec.fixHint,
      },
    ];
  }

  // Look for export or class/function/const/type declaration of the symbol
  const symbolRegex = new RegExp(
    `(?:export\\s+(?:default\\s+)?(?:class|function|const|let|var|type|interface|enum)\\s+${escapeRegex(spec.symbol)}|export\\s*\\{[^}]*\\b${escapeRegex(spec.symbol)}\\b[^}]*\\})`
  );

  if (symbolRegex.test(content)) {
    return [];
  }

  return [
    {
      ruleId,
      ruleName,
      kind: "invariant",
      severity,
      message: `Required symbol '${spec.symbol}' not found in '${spec.file}'`,
      file: spec.file,
      fixHint: spec.fixHint ?? `Ensure '${spec.symbol}' is exported from '${spec.file}'`,
    },
  ];
}

async function runNamingConvention(
  ruleId: string,
  ruleName: string,
  severity: ViolationSeverity,
  spec: InvariantEnforcementSpec,
  rootPath: string
): Promise<EnforcementViolation[]> {
  if (!spec.glob || !spec.regex) return [];

  let namingRegex: RegExp;
  try {
    namingRegex = new RegExp(spec.regex);
  } catch {
    return [];
  }

  // Resolve glob to files (simple: treat spec.glob as a directory path + extension filter)
  const files = await collectSourceFiles(rootPath, TS_JS_EXTS);
  const violations: EnforcementViolation[] = [];

  const globPattern = spec.glob.replace(/\*/g, "");

  for (const file of files) {
    const rel = relative(rootPath, file);
    if (!rel.includes(globPattern.replace(/\//g, ""))) continue;
    const name = basename(file);
    if (!namingRegex.test(name)) {
      violations.push({
        ruleId,
        ruleName,
        kind: "invariant",
        severity,
        message: `File '${rel}' does not satisfy naming convention '${spec.regex}'`,
        file: rel,
        fixHint: spec.fixHint ?? `Rename '${name}' to match pattern '${spec.regex}'`,
      });
    }
  }

  return violations;
}

function escapeRegex(str: string): string {
  return str.replace(/[$()*+.[\]?\\^{}|]/g, "\\$&");
}

// ── InvariantCompiler ─────────────────────────────────────────

export class InvariantCompiler {
  async compile(
    knowledge: DomainInvariantKnowledge,
    rootPath: string
  ): Promise<EnforcementViolation[]> {
    const confirmed = knowledge.rules.filter((r) => r.status === "confirmed" && r.enforcement);
    const violations: EnforcementViolation[] = [];

    for (const rule of confirmed) {
      const spec = rule.enforcement!;
      const ruleId = slugify(rule.name);
      const severity: ViolationSeverity = rule.severity;

      let found: EnforcementViolation[] = [];

      switch (spec.kind) {
        case "forbiddenImport":
          found = await runForbiddenImport(ruleId, rule.name, severity, spec, rootPath);
          break;
        case "requiredFileExists":
          found = await runRequiredFileExists(ruleId, rule.name, severity, spec, rootPath);
          break;
        case "requiredSymbolExists":
          found = await runRequiredSymbolExists(ruleId, rule.name, severity, spec, rootPath);
          break;
        case "namingConvention":
          found = await runNamingConvention(ruleId, rule.name, severity, spec, rootPath);
          break;
      }

      violations.push(...found);
    }

    return violations;
  }

  /** Returns the list of confirmed rules that have no enforcement spec (not yet enforceable). */
  unenforceableRules(knowledge: DomainInvariantKnowledge): string[] {
    return knowledge.rules
      .filter((r) => r.status === "confirmed" && !r.enforcement)
      .map((r) => r.name);
  }
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}
