import type { ForgemindConfig, ScanResult } from "../types/index.js";
import { DependencyDetector } from "./detectors/dependencyDetector.js";
import { FrameworkDetector } from "./detectors/frameworkDetector.js";
import { LanguageDetector } from "./detectors/languageDetector.js";
import { StructureDetector } from "./detectors/structureDetector.js";

export class RepositoryScanner {
  private readonly languageDetector = new LanguageDetector();
  private readonly frameworkDetector = new FrameworkDetector();
  private readonly structureDetector = new StructureDetector();
  private readonly dependencyDetector = new DependencyDetector();

  async scan(rootPath: string, config: ForgemindConfig): Promise<ScanResult> {
    const [languages, frameworks, structure, dependencies] = await Promise.all([
      this.languageDetector.detect(rootPath, config.ignoreDirs),
      this.frameworkDetector.detect(rootPath),
      this.structureDetector.detect(rootPath, config.ignoreDirs),
      this.dependencyDetector.detect(rootPath)
    ]);

    const signals: string[] = [];
    if (dependencies.packageJson) {
      signals.push("node-project");
    }
    if (dependencies.composerJson) {
      signals.push("php-project");
    }

    return {
      rootPath,
      languages,
      frameworks,
      structure,
      dependencies,
      signals,
      scannedAt: new Date().toISOString()
    };
  }
}
