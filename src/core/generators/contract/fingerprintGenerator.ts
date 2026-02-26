import { relative, resolve } from "node:path";
import { fileExists, readTextFile, walkFiles } from "../../../utils/fileSystem.js";
import { hashContent } from "../../../utils/hashing.js";
import type { GeneratorContext, RepoFingerprint } from "../../types/index.js";

const DEFAULT_IGNORE_FILE_PATTERNS = [".*", "*.tmp", "*.temp", "*.swp", "*.swo", "*.bak", "*~"];

function wildcardToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");
  return new RegExp(`^${escaped}$`, "i");
}

function isIgnoredFingerprintFile(relativePath: string, patterns: string[]): boolean {
  const normalized = relativePath.replaceAll("\\", "/");
  const fileName = normalized.split("/").at(-1) ?? normalized;
  const matchers = patterns.map((pattern) => wildcardToRegExp(pattern));
  return matchers.some((matcher) => matcher.test(fileName) || matcher.test(normalized));
}

export class FingerprintGenerator {
  async generate(context: GeneratorContext): Promise<RepoFingerprint> {
    const structureHash = await this.hashStructure(context);
    const dependenciesHash = await this.hashDependencies(context);
    const docsHash = await this.hashDocs(context);
    const fingerprint = hashContent([structureHash, dependenciesHash, docsHash].join("::"));

    return {
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
      structureHash,
      dependenciesHash,
      docsHash,
      fingerprint
    };
  }

  private async hashStructure(context: GeneratorContext): Promise<string> {
    const ignoreFilePatterns = context.config.ignoreFilePatterns ?? DEFAULT_IGNORE_FILE_PATTERNS;
    const files = await walkFiles(context.scan.rootPath, context.config.ignoreDirs);
    const normalized = files
      .map((file) => relative(context.scan.rootPath, file).replaceAll("\\", "/"))
      .filter((file) => !isIgnoredFingerprintFile(file, ignoreFilePatterns))
      .sort();
    return hashContent(normalized.join("\n"));
  }

  private async hashDependencies(context: GeneratorContext): Promise<string> {
    const dependencyFiles = ["package.json", "composer.json"];
    const contentParts: string[] = [];

    for (const file of dependencyFiles) {
      const fullPath = resolve(context.scan.rootPath, file);
      if (!(await fileExists(fullPath))) {
        continue;
      }
      contentParts.push(file);
      contentParts.push(await readTextFile(fullPath));
    }

    return hashContent(contentParts.join("\n"));
  }

  private async hashDocs(context: GeneratorContext): Promise<string> {
    const ignoreFilePatterns = context.config.ignoreFilePatterns ?? DEFAULT_IGNORE_FILE_PATTERNS;
    const docsDir = resolve(context.scan.rootPath, context.config.outputPaths.docs);
    if (!(await fileExists(docsDir))) {
      return hashContent("");
    }

    const docs = await walkFiles(docsDir);
    const parts: string[] = [];
    for (const file of docs.sort()) {
      const relativePath = relative(context.scan.rootPath, file).replaceAll("\\", "/");
      if (isIgnoredFingerprintFile(relativePath, ignoreFilePatterns)) {
        continue;
      }
      parts.push(relativePath);
      parts.push(await readTextFile(file));
    }

    return hashContent(parts.join("\n"));
  }
}
