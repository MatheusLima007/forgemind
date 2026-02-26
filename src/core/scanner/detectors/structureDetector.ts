import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { FolderStructure } from "../../types/index.js";

export class StructureDetector {
  async detect(rootPath: string, ignoredDirs: string[]): Promise<FolderStructure> {
    const topLevelEntries = await readdir(rootPath, { withFileTypes: true });
    const topLevel = topLevelEntries
      .filter((entry) => entry.isDirectory() && !ignoredDirs.includes(entry.name))
      .map((entry) => entry.name)
      .sort();

    const secondLevel: Record<string, string[]> = {};

    for (const folder of topLevel) {
      const nestedPath = resolve(rootPath, folder);
      const nested = await readdir(nestedPath, { withFileTypes: true });
      secondLevel[folder] = nested
        .filter((entry) => entry.isDirectory() && !ignoredDirs.includes(entry.name))
        .map((entry) => entry.name)
        .sort();
    }

    return {
      topLevel,
      secondLevel
    };
  }
}
