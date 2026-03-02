import type { GeneratorContext, RepoFacts } from "./types/index.js";

export function buildRepoFacts(context: GeneratorContext): RepoFacts {
  const dependencyFiles = context.scan.dependencies.configFiles;
  const topLevelStructure = [...new Set(context.scan.configFilesFound.map((filePath) => filePath.split("/")[0]).filter(Boolean))].sort();

  return {
    languages: context.scan.languages,
    frameworks: context.scan.frameworks,
    topLevelStructure,
    dependencySummary: {
      files: dependencyFiles,
      packageDependenciesCount: context.scan.dependencies.dependencies.length,
      composerDependenciesCount: 0
    },
    architecturalSignals: context.scan.signals,
    complianceLevel: "L1"
  };
}
