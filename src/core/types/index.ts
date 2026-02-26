export type SupportedLanguage = "typescript" | "javascript" | "php" | "unknown";
export type SupportedFramework = "nestjs" | "react" | "laravel" | "unknown";

export interface DependencyInfo {
  packageJson: boolean;
  composerJson: boolean;
  packageDependencies: string[];
  composerDependencies: string[];
}

export interface FolderStructure {
  topLevel: string[];
  secondLevel: Record<string, string[]>;
}

export interface ScanResult {
  rootPath: string;
  languages: SupportedLanguage[];
  frameworks: SupportedFramework[];
  structure: FolderStructure;
  dependencies: DependencyInfo;
  signals: string[];
  scannedAt: string;
}

export interface RepoFingerprint {
  version: string;
  generatedAt: string;
  structureHash: string;
  dependenciesHash: string;
  docsHash: string;
  fingerprint: string;
}

export interface AIContract {
  arrcVersion: string;
  version: string;
  generatedAt: string;
  complianceLevel: "L1";
  scanSummary: {
    languages: SupportedLanguage[];
    frameworks: SupportedFramework[];
    dependencyFiles: string[];
  };
  fingerprint: RepoFingerprint;
}

export interface PolicyItem {
  id: string;
  description: string;
  path: string;
  required: boolean;
  status: "present" | "missing";
}

export interface PolicyChecklist {
  version: string;
  generatedAt: string;
  level: "L1";
  items: PolicyItem[];
}

export interface ValidationResult {
  valid: boolean;
  exitCode: 0 | 1 | 2 | 3;
  errors: string[];
}

export interface ForgemindConfig {
  compliance: {
    level: "L1";
  };
  outputPaths: {
    docs: string;
    prompts: string;
    policies: string;
    ai: string;
  };
  ignoreDirs: string[];
  ignoreFilePatterns?: string[];
  templateOverrides: Record<string, string>;
}

export interface GeneratorContext {
  scan: ScanResult;
  config: ForgemindConfig;
}
