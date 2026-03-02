import { extname } from "node:path";
import { walkFiles } from "../../../utils/fileSystem.js";

const extensionMap: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".php": "php",
  ".py": "python",
  ".pyw": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".kt": "kotlin",
  ".rb": "ruby",
  ".swift": "swift",
  ".dart": "dart",
  ".ex": "elixir",
  ".exs": "elixir",
  ".scala": "scala",
  ".cs": "csharp",
  ".c": "c",
  ".cpp": "cpp",
  ".h": "c",
  ".hpp": "cpp",
  ".lua": "lua",
  ".zig": "zig"
};

export class LanguageDetector {
  async detect(rootPath: string, ignoredDirs: string[]): Promise<string[]> {
    const files = await walkFiles(rootPath, ignoredDirs);
    const counts = new Map<string, number>();

    for (const file of files) {
      const language = extensionMap[extname(file)] ?? "unknown";
      if (language === "unknown") {
        continue;
      }
      counts.set(language, (counts.get(language) ?? 0) + 1);
    }

    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([language]) => language);
    return sorted.length ? sorted : ["unknown"];
  }
}
