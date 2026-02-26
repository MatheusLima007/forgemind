import { resolve } from "node:path";
import type { ForgemindConfig, RepoFingerprint, ValidationResult } from "../types/index.js";
import { FingerprintGenerator } from "../generators/contract/fingerprintGenerator.js";
import { RepositoryScanner } from "../scanner/repositoryScanner.js";
import { fileExists, readTextFile } from "../../utils/fileSystem.js";
import {
  validateContractSchema,
  validateFingerprintSchema,
  validatePolicyChecklistSchema,
  SUPPORTED_ARRC_VERSION
} from "./arrcSchema.js";

const REQUIRED_POLICY_FILES = [
  "docs/agent-first.md",
  "docs/architecture.md",
  "prompts/review.md",
  "prompts/feature.md",
  "prompts/refactor.md",
  "prompts/troubleshooting.md",
  "policies/checklist.json"
];

const REQUIRED_POLICY_ITEMS = [
  { id: "DOC_AGENT_FIRST", path: "docs/agent-first.md" },
  { id: "DOC_ARCHITECTURE", path: "docs/architecture.md" },
  { id: "PROMPT_REVIEW", path: "prompts/review.md" },
  { id: "PROMPT_FEATURE", path: "prompts/feature.md" },
  { id: "PROMPT_REFACTOR", path: "prompts/refactor.md" },
  { id: "PROMPT_TROUBLESHOOTING", path: "prompts/troubleshooting.md" },
  { id: "AI_CONTRACT", path: "ai/contract.json" },
  { id: "AI_FINGERPRINT", path: "ai/fingerprint.json" }
] as const;

interface PolicyChecklistItem {
  id: string;
  description: string;
  path: string;
  required: boolean;
  status: "present" | "missing";
}

export class Validator {
  private readonly scanner = new RepositoryScanner();
  private readonly fingerprintGenerator = new FingerprintGenerator();

  private normalizeStringArray(value: string[]): string[] {
    return [...new Set(value)].sort();
  }

  private normalizeConfiguredPath(config: ForgemindConfig, path: string): string {
    return path
      .replace("docs/", `${config.outputPaths.docs}/`)
      .replace("prompts/", `${config.outputPaths.prompts}/`)
      .replace("policies/", `${config.outputPaths.policies}/`)
      .replace("ai/", `${config.outputPaths.ai}/`);
  }

  private async validatePolicyChecklistSemantics(
    rootPath: string,
    config: ForgemindConfig,
    checklist: { items: PolicyChecklistItem[] }
  ): Promise<string[]> {
    const errors: string[] = [];
    const ids = checklist.items.map((item) => item.id);
    const duplicatedIds = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicatedIds.length > 0) {
      errors.push(`Policy checklist has duplicated IDs: ${[...new Set(duplicatedIds)].join(", ")}`);
    }

    for (const requiredItem of REQUIRED_POLICY_ITEMS) {
      const normalizedPath = this.normalizeConfiguredPath(config, requiredItem.path);
      const found = checklist.items.find((item) => item.id === requiredItem.id);

      if (!found) {
        errors.push(`Policy checklist missing required item ID: ${requiredItem.id}`);
        continue;
      }

      if (found.required !== true) {
        errors.push(`Policy checklist item '${requiredItem.id}' must have required=true`);
      }

      if (found.path !== normalizedPath) {
        errors.push(
          `Policy checklist item '${requiredItem.id}' path mismatch: expected '${normalizedPath}', found '${found.path}'`
        );
      }

      const exists = await fileExists(resolve(rootPath, normalizedPath));
      const expectedStatus = exists ? "present" : "missing";
      if (found.status !== expectedStatus) {
        errors.push(
          `Policy checklist item '${requiredItem.id}' status mismatch: expected '${expectedStatus}', found '${found.status}'`
        );
      }
    }

    return errors;
  }

  async validate(rootPath: string, config: ForgemindConfig): Promise<ValidationResult> {
    const errors: string[] = [];

    const fingerprintPath = resolve(rootPath, config.outputPaths.ai, "fingerprint.json");
    const contractPath = resolve(rootPath, config.outputPaths.ai, "contract.json");
    const policyChecklistPath = resolve(rootPath, config.outputPaths.policies, "checklist.json");

    if (!(await fileExists(contractPath)) || !(await fileExists(fingerprintPath))) {
      return {
        valid: false,
        exitCode: 3,
        errors: ["Contract or fingerprint file is missing"]
      };
    }

    const required = REQUIRED_POLICY_FILES.map((file) => file
      .replace("docs/", `${config.outputPaths.docs}/`)
      .replace("prompts/", `${config.outputPaths.prompts}/`)
      .replace("policies/", `${config.outputPaths.policies}/`)
    );

    for (const rel of required) {
      const path = resolve(rootPath, rel);
      if (!(await fileExists(path))) {
        errors.push(`Missing required file: ${rel}`);
      }
    }

    if (errors.length > 0) {
      return { valid: false, exitCode: 1, errors };
    }

    let stored: RepoFingerprint;
    let storedContractRaw: unknown;
    let storedFingerprintRaw: unknown;
    let storedPolicyChecklistRaw: unknown;

    try {
      storedContractRaw = JSON.parse(await readTextFile(contractPath));
    } catch {
      return {
        valid: false,
        exitCode: 3,
        errors: ["Contract file is invalid JSON"]
      };
    }

    try {
      storedFingerprintRaw = JSON.parse(await readTextFile(fingerprintPath));
      stored = storedFingerprintRaw as RepoFingerprint;
    } catch {
      return {
        valid: false,
        exitCode: 3,
        errors: ["Fingerprint file is invalid JSON"]
      };
    }

    try {
      storedPolicyChecklistRaw = JSON.parse(await readTextFile(policyChecklistPath));
    } catch {
      return {
        valid: false,
        exitCode: 3,
        errors: ["Policy checklist file is invalid JSON"]
      };
    }

    const contractSchema = validateContractSchema(storedContractRaw);
    if (!contractSchema.valid) {
      return {
        valid: false,
        exitCode: 3,
        errors: contractSchema.errors.map((error) => `Contract schema invalid: ${error}`)
      };
    }

    const fingerprintSchema = validateFingerprintSchema(storedFingerprintRaw);
    if (!fingerprintSchema.valid) {
      return {
        valid: false,
        exitCode: 3,
        errors: fingerprintSchema.errors.map((error) => `Fingerprint schema invalid: ${error}`)
      };
    }

    const policyChecklistSchema = validatePolicyChecklistSchema(storedPolicyChecklistRaw);
    if (!policyChecklistSchema.valid) {
      return {
        valid: false,
        exitCode: 3,
        errors: policyChecklistSchema.errors.map((error) => `Policy checklist schema invalid: ${error}`)
      };
    }

    const policySemanticErrors = await this.validatePolicyChecklistSemantics(
      rootPath,
      config,
      storedPolicyChecklistRaw as { items: PolicyChecklistItem[] }
    );
    if (policySemanticErrors.length > 0) {
      return {
        valid: false,
        exitCode: 3,
        errors: policySemanticErrors.map((error) => `Policy checklist invalid: ${error}`)
      };
    }

    const contract = storedContractRaw as { arrcVersion?: string };
    if (contract.arrcVersion !== SUPPORTED_ARRC_VERSION) {
      return {
        valid: false,
        exitCode: 3,
        errors: [
          `ARRC version mismatch: expected ${SUPPORTED_ARRC_VERSION}, found ${contract.arrcVersion ?? "undefined"}`
        ]
      };
    }

    const contractWithMetadata = storedContractRaw as {
      complianceLevel: string;
      fingerprint: RepoFingerprint;
    };

    if (contractWithMetadata.complianceLevel !== config.compliance.level) {
      return {
        valid: false,
        exitCode: 3,
        errors: [
          `Contract compliance mismatch: expected ${config.compliance.level}, found ${contractWithMetadata.complianceLevel}`
        ]
      };
    }

    const contractGeneratedAt = Date.parse((storedContractRaw as { generatedAt: string }).generatedAt);
    const fingerprintGeneratedAt = Date.parse(stored.generatedAt);
    if (contractGeneratedAt < fingerprintGeneratedAt) {
      return {
        valid: false,
        exitCode: 3,
        errors: [
          "Contract temporal mismatch: contract.generatedAt must be greater than or equal to fingerprint.generatedAt"
        ]
      };
    }

    const contractFingerprint = contractWithMetadata.fingerprint;
    const fingerprintMismatch =
      contractFingerprint.version !== stored.version ||
      contractFingerprint.generatedAt !== stored.generatedAt ||
      contractFingerprint.structureHash !== stored.structureHash ||
      contractFingerprint.dependenciesHash !== stored.dependenciesHash ||
      contractFingerprint.docsHash !== stored.docsHash ||
      contractFingerprint.fingerprint !== stored.fingerprint;

    if (fingerprintMismatch) {
      return {
        valid: false,
        exitCode: 3,
        errors: ["Contract fingerprint metadata does not match fingerprint.json"]
      };
    }

    const scan = await this.scanner.scan(rootPath, config);

    const expectedDependencyFiles = this.normalizeStringArray([
      ...(scan.dependencies.packageJson ? ["package.json"] : []),
      ...(scan.dependencies.composerJson ? ["composer.json"] : [])
    ]);
    const expectedLanguages = this.normalizeStringArray(scan.languages);
    const expectedFrameworks = this.normalizeStringArray(scan.frameworks);
    const contractDependencyFiles = this.normalizeStringArray(
      (storedContractRaw as { scanSummary: { dependencyFiles: string[] } }).scanSummary.dependencyFiles
    );
    const contractLanguages = this.normalizeStringArray(
      (storedContractRaw as { scanSummary: { languages: string[] } }).scanSummary.languages
    );
    const contractFrameworks = this.normalizeStringArray(
      (storedContractRaw as { scanSummary: { frameworks: string[] } }).scanSummary.frameworks
    );

    if (expectedLanguages.join("|") !== contractLanguages.join("|")) {
      return {
        valid: false,
        exitCode: 3,
        errors: [
          `Contract scanSummary mismatch: expected languages [${expectedLanguages.join(", ")}], found [${contractLanguages.join(", ")}]`
        ]
      };
    }

    if (expectedFrameworks.join("|") !== contractFrameworks.join("|")) {
      return {
        valid: false,
        exitCode: 3,
        errors: [
          `Contract scanSummary mismatch: expected frameworks [${expectedFrameworks.join(", ")}], found [${contractFrameworks.join(", ")}]`
        ]
      };
    }

    if (expectedDependencyFiles.join("|") !== contractDependencyFiles.join("|")) {
      return {
        valid: false,
        exitCode: 3,
        errors: [
          `Contract scanSummary mismatch: expected dependencyFiles [${expectedDependencyFiles.join(", ")}], found [${contractDependencyFiles.join(", ")}]`
        ]
      };
    }

    const current = await this.fingerprintGenerator.generate({ scan, config });

    if (current.fingerprint !== stored.fingerprint) {
      return {
        valid: false,
        exitCode: 2,
        errors: ["Documentation or repository fingerprint drift detected"]
      };
    }

    return {
      valid: true,
      exitCode: 0,
      errors: []
    };
  }
}
