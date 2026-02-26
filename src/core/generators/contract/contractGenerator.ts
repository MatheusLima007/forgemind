import { resolve } from "node:path";
import type { AIContract, GeneratorContext, RepoFingerprint } from "../../types/index.js";
import { writeTextFile } from "../../../utils/fileSystem.js";
import { resolveTemplateContent } from "../../templates/templateResolver.js";
import { SUPPORTED_ARRC_VERSION } from "../../validation/arrcSchema.js";

export class ContractGenerator {
  async generate(context: GeneratorContext, fingerprint: RepoFingerprint): Promise<string> {
    const contract: AIContract = {
      arrcVersion: SUPPORTED_ARRC_VERSION,
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
      complianceLevel: context.config.compliance.level,
      scanSummary: {
        languages: context.scan.languages,
        frameworks: context.scan.frameworks,
        dependencyFiles: [
          ...(context.scan.dependencies.packageJson ? ["package.json"] : []),
          ...(context.scan.dependencies.composerJson ? ["composer.json"] : [])
        ]
      },
      fingerprint
    };

    const path = resolve(context.scan.rootPath, context.config.outputPaths.ai, "contract.json");
    const content = await resolveTemplateContent(
      context,
      "ai.contract",
      JSON.stringify(contract, null, 2),
      {
        "contract.json": JSON.stringify(contract, null, 2),
        "fingerprint.value": fingerprint.fingerprint,
        "fingerprint.structureHash": fingerprint.structureHash,
        "fingerprint.dependenciesHash": fingerprint.dependenciesHash,
        "fingerprint.docsHash": fingerprint.docsHash
      }
    );
    await writeTextFile(path, content);
    return path;
  }
}
