import { basename, extname, relative } from "node:path";
import { walkFiles, readTextFile } from "../../utils/fileSystem.js";
import type { CodeSample, ScanResult } from "../types/index.js";

const ENTRY_POINT_PATTERNS = [
  /^main\./i,
  /^index\./i,
  /^app\./i,
  /^server\./i,
  /^bootstrap\./i,
  /^startup\./i,
  /^cli\./i,
];

const CONFIG_PATTERNS = [
  /config/i,
  /settings/i,
  /^\.env/i,
  /manifest/i,
  /schema/i,
  /policy/i,
];

const DOMAIN_PATTERNS = [
  /domain/i,
  /entity/i,
  /model/i,
  /aggregate/i,
  /value-?object/i,
  /rule/i,
  /policy/i,
  /invariant/i,
];

const TEXT_LIKE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".yaml", ".yml", ".toml", ".ini", ".env",
  ".py", ".go", ".java", ".kt", ".rb", ".php", ".rs", ".swift", ".dart", ".cs", ".c", ".cpp", ".h", ".hpp",
  ".md", ".txt", ".sh", ".sql", ".xml"
]);

function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4);
}

export class CodeSampler {
  async sample(scan: ScanResult, ignoreDirs: string[], maxTokensBudget: number): Promise<CodeSample[]> {
    const files = await walkFiles(scan.rootPath, ignoreDirs);
    const candidates = files.map((absolute) => ({
      absolute,
      relative: relative(scan.rootPath, absolute),
      fileName: basename(absolute),
      ext: extname(absolute).toLowerCase()
    }));

    const samples: CodeSample[] = [];
    let totalTokens = 0;

    const tryAdd = async (candidate: typeof candidates[number], category: CodeSample["category"], reason: string): Promise<void> => {
      if (samples.some((s) => s.path === candidate.relative)) return;
      const sample = await this.tryCreateSample(candidate.absolute, candidate.relative, category, reason);
      if (!sample) return;
      if (totalTokens + sample.tokenEstimate > maxTokensBudget) return;
      samples.push(sample);
      totalTokens += sample.tokenEstimate;
    };

    for (const candidate of candidates) {
      if (totalTokens >= maxTokensBudget) break;
      if (ENTRY_POINT_PATTERNS.some((pattern) => pattern.test(candidate.fileName))) {
        await tryAdd(candidate, "entry-point", "Likely runtime entry point");
      }
    }

    for (const candidate of candidates) {
      if (totalTokens >= maxTokensBudget) break;
      if (CONFIG_PATTERNS.some((pattern) => pattern.test(candidate.fileName) || pattern.test(candidate.relative))) {
        await tryAdd(candidate, "config", "Configuration or policy surface");
      }
    }

    for (const candidate of candidates) {
      if (totalTokens >= maxTokensBudget) break;
      if (DOMAIN_PATTERNS.some((pattern) => pattern.test(candidate.fileName) || pattern.test(candidate.relative))) {
        await tryAdd(candidate, "domain", "Domain/invariant-related surface");
      }
    }

    const seenPatterns = new Set<string>();
    for (const candidate of candidates) {
      if (totalTokens >= maxTokensBudget) break;
      if (!TEXT_LIKE_EXTENSIONS.has(candidate.ext)) continue;
      const pattern = this.detectPatternType(candidate.fileName);
      if (!pattern || seenPatterns.has(pattern)) continue;
      seenPatterns.add(pattern);
      await tryAdd(candidate, "pattern-representative", `Representative for pattern '${pattern}'`);
    }

    if (totalTokens < maxTokensBudget) {
      const fanIn = await this.estimateFanIn(files);
      const top = [...fanIn.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
      for (const [filePath, count] of top) {
        if (totalTokens >= maxTokensBudget) break;
        const candidate = candidates.find((c) => c.absolute === filePath);
        if (!candidate) continue;
        await tryAdd(candidate, "high-fan-in", `Referenced by ${count} files`);
      }
    }

    return samples;
  }

  private async tryCreateSample(
    absolutePath: string,
    relativePath: string,
    category: CodeSample["category"],
    reason: string
  ): Promise<CodeSample | null> {
    try {
      const content = await readTextFile(absolutePath);
      const lines = content.split("\n");
      const truncated = lines.length > 500
        ? `${lines.slice(0, 220).join("\n")}\n\n// ... (${lines.length - 220} lines truncated)`
        : content;

      return {
        path: relativePath,
        content: truncated,
        reason,
        category,
        tokenEstimate: estimateTokens(truncated)
      };
    } catch {
      return null;
    }
  }

  private detectPatternType(fileName: string): string | null {
    const patterns: Array<[RegExp, string]> = [
      [/repository/i, "repository"],
      [/service/i, "service"],
      [/controller|handler/i, "request-handling"],
      [/policy|rule|validator/i, "rule-enforcement"],
      [/event|subscriber|listener/i, "event-flow"],
      [/adapter|gateway|port/i, "boundary-adapter"],
      [/factory|builder|strategy/i, "variation-point"]
    ];

    for (const [regex, type] of patterns) {
      if (regex.test(fileName)) return type;
    }

    return null;
  }

  private async estimateFanIn(files: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    const sourceFiles = files.filter((f) => /\.(ts|tsx|js|jsx|mjs|cjs|py|go|java|kt|rb|php|rs|swift|dart|cs)$/i.test(f)).slice(0, 250);

    for (const filePath of sourceFiles) {
      try {
        const content = await readTextFile(filePath);
        const referenceRegex = /(?:from\s+['"]|require\(\s*['"]|import\s+['"])(\.{1,2}\/[^'"]+)['"]/g;
        let match: RegExpExecArray | null;

        while ((match = referenceRegex.exec(content)) !== null) {
          const importPath = match[1];
          if (!importPath) continue;
          const base = basename(importPath).replace(/\.[a-z0-9]+$/i, "");
          const target = files.find((file) => basename(file).replace(/\.[a-z0-9]+$/i, "") === base);
          if (target) {
            counts.set(target, (counts.get(target) ?? 0) + 1);
          }
        }
      } catch {
        // ignore read errors
      }
    }

    return counts;
  }
}
