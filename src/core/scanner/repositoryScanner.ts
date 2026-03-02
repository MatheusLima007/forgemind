import type { ForgemindConfig, ScanResult } from "../types/index.js";
import { DependencyDetector } from "./detectors/dependencyDetector.js";
import { FrameworkDetector } from "./detectors/frameworkDetector.js";
import { LanguageDetector } from "./detectors/languageDetector.js";

export class RepositoryScanner {
  private readonly languageDetector = new LanguageDetector();
  private readonly frameworkDetector = new FrameworkDetector();
  private readonly dependencyDetector = new DependencyDetector();

  async scan(rootPath: string, config: ForgemindConfig): Promise<ScanResult> {
    const [languages, frameworks, dependencies] = await Promise.all([
      this.languageDetector.detect(rootPath, config.ignoreDirs),
      this.frameworkDetector.detect(rootPath),
      this.dependencyDetector.detect(rootPath)
    ]);

    const signals: string[] = [];
    if (languages.length > 1) signals.push("polyglot-codebase");
    if (dependencies.ecosystemHints.length > 1) signals.push("multi-ecosystem");
    if (dependencies.configFiles.length > 0) signals.push("configuration-rich");
    if (dependencies.dependencies.length > 100) signals.push("high-dependency-surface");

    return {
      rootPath,
      languages,
      frameworks,
      configFilesFound: dependencies.configFiles,
      dependencies,
      signals,
      scannedAt: new Date().toISOString()
    };
  }
}
