import { resolve } from "node:path";
import { writeTextFile } from "../../../utils/fileSystem.js";
import { stableStringify } from "../../../utils/hashing.js";
import { resolveTemplateContent } from "../../templates/templateResolver.js";
import type { AIContract, GeneratorContext, RepoFingerprint } from "../../types/index.js";
import { SUPPORTED_ARRC_VERSION } from "../../validation/arrcSchema.js";

export class ContractGenerator {
  build(context: GeneratorContext, fingerprint: RepoFingerprint): AIContract {
    return {
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
  }

  async generate(context: GeneratorContext, fingerprint: RepoFingerprint): Promise<string> {
    const contract = this.build(context, fingerprint);
    const serializedContract = stableStringify(contract);

    const path = resolve(context.scan.rootPath, context.config.outputPaths.ai, "contract.json");
    const content = await resolveTemplateContent(
      context,
      "ai.contract",
      serializedContract,
      {
        "contract.json": serializedContract,
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
