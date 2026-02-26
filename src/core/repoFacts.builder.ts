import type { GeneratorContext, RepoFacts } from "./types/index.js";

export function buildRepoFacts(context: GeneratorContext): RepoFacts {
  const dependencyFiles = [
    ...(context.scan.dependencies.packageJson ? ["package.json"] : []),
    ...(context.scan.dependencies.composerJson ? ["composer.json"] : [])
  ];

  return {
    languages: context.scan.languages,
    frameworks: context.scan.frameworks,
    topLevelStructure: context.scan.structure.topLevel,
    dependencySummary: {
      files: dependencyFiles,
      packageDependenciesCount: context.scan.dependencies.packageDependencies.length,
      composerDependenciesCount: context.scan.dependencies.composerDependencies.length
    },
    architecturalSignals: context.scan.signals,
    complianceLevel: context.config.compliance.level
  };
}
