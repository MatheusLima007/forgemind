import { extname } from "node:path";
import { walkFiles } from "../../../utils/fileSystem.js";
import type { SupportedLanguage } from "../../types/index.js";

const extensionMap: Record<string, SupportedLanguage> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".php": "php"
};

export class LanguageDetector {
  async detect(rootPath: string, ignoredDirs: string[]): Promise<SupportedLanguage[]> {
    const files = await walkFiles(rootPath, ignoredDirs);
    const counts = new Map<SupportedLanguage, number>();

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
