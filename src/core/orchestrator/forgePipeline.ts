import { resolve } from "node:path";
import { ensureDir } from "../../utils/fileSystem.js";
import { ContractGenerator } from "../generators/contract/contractGenerator.js";
import { FingerprintGenerator } from "../generators/contract/fingerprintGenerator.js";
import { writeFingerprint } from "../generators/contract/fingerprintWriter.js";
import { DocumentationGenerator } from "../generators/documentation/documentationGenerator.js";
import { PolicyGenerator } from "../generators/policy/policyGenerator.js";
import { PromptPackGenerator } from "../generators/prompts/promptPackGenerator.js";
import { RepositoryScanner } from "../scanner/repositoryScanner.js";
import type { ForgemindConfig, GeneratorContext, RepoFingerprint } from "../types/index.js";

export interface PipelineResult {
  generatedFiles: string[];
  fingerprint: RepoFingerprint;
}

export class ForgePipeline {
  private readonly scanner = new RepositoryScanner();
  private readonly docsGenerator = new DocumentationGenerator();
  private readonly promptGenerator = new PromptPackGenerator();
  private readonly policyGenerator = new PolicyGenerator();
  private readonly contractGenerator = new ContractGenerator();
  private readonly fingerprintGenerator = new FingerprintGenerator();

  async run(rootPath: string, config: ForgemindConfig): Promise<PipelineResult> {
    await this.ensureOutputDirs(rootPath, config);

    const scan = await this.scanner.scan(rootPath, config);
    const context: GeneratorContext = { scan, config };

    const docsFiles = await this.docsGenerator.generate(context);
    const promptFiles = await this.promptGenerator.generate(context);

    const fingerprint = await this.fingerprintGenerator.generate(context);
    const fingerprintFile = await writeFingerprint(context, fingerprint);
    const contractFile = await this.contractGenerator.generate(context, fingerprint);
    const policyFile = await this.policyGenerator.generate(context);

    return {
      generatedFiles: [...docsFiles, ...promptFiles, fingerprintFile, contractFile, policyFile],
      fingerprint
    };
  }

  private async ensureOutputDirs(rootPath: string, config: ForgemindConfig): Promise<void> {
    await Promise.all([
      ensureDir(resolve(rootPath, config.outputPaths.docs)),
      ensureDir(resolve(rootPath, config.outputPaths.prompts)),
      ensureDir(resolve(rootPath, config.outputPaths.policies)),
      ensureDir(resolve(rootPath, config.outputPaths.ai))
    ]);
  }
}
