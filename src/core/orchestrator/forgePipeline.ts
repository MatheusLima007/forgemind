import { resolve } from "node:path";
import { LLMOrchestrator } from "../../llm/llm.orchestrator.js";
import { createLLMProvider } from "../../llm/providerFactory.js";
import { ensureDir } from "../../utils/fileSystem.js";
import { ContractGenerator } from "../generators/contract/contractGenerator.js";
import { FingerprintGenerator } from "../generators/contract/fingerprintGenerator.js";
import { writeFingerprint } from "../generators/contract/fingerprintWriter.js";
import { DocumentationGenerator } from "../generators/documentation/documentationGenerator.js";
import { PolicyGenerator } from "../generators/policy/policyGenerator.js";
import { PromptPackGenerator } from "../generators/prompts/promptPackGenerator.js";
import { RepositoryScanner } from "../scanner/repositoryScanner.js";
import type { ForgemindConfig, LLMProviderName, RepoFingerprint } from "../types/index.js";

export interface EnrichmentInfo {
  provider: LLMProviderName;
  docsFilesEnriched: number;
  promptFilesEnriched: number;
  skippedReason?: string;
}

export interface PipelineResult {
  generatedFiles: string[];
  fingerprint: RepoFingerprint;
  enrichment: EnrichmentInfo;
}

export interface PipelineRunOptions {
  llmProviderName?: LLMProviderName;
  llmStrict?: boolean;
}

export class ForgePipeline {
  private readonly scanner = new RepositoryScanner();
  private readonly docsGenerator = new DocumentationGenerator();
  private readonly promptGenerator = new PromptPackGenerator();
  private readonly policyGenerator = new PolicyGenerator();
  private readonly contractGenerator = new ContractGenerator();
  private readonly fingerprintGenerator = new FingerprintGenerator();
  private readonly llmOrchestrator = new LLMOrchestrator();

  async run(rootPath: string, config: ForgemindConfig, options: PipelineRunOptions = {}): Promise<PipelineResult> {
    const llmProviderName = options.llmProviderName ?? "none";
    const llmStrict = options.llmStrict ?? false;

    await this.ensureOutputDirs(rootPath, config);

    const scan = await this.scanner.scan(rootPath, config);
    const context = { scan, config };

    const docsFiles = await this.docsGenerator.generate(context);
    const promptFiles = await this.promptGenerator.generate(context);

    const { provider: llmProvider, skipReason } = createLLMProvider(config.llm, llmProviderName);

    if (llmStrict && !llmProvider) {
      throw new Error(`LLM strict mode enabled but provider was not initialized: ${skipReason ?? "unknown"}`);
    }

    const fingerprint = await this.fingerprintGenerator.generate(context);
    const contractData = this.contractGenerator.build(context, fingerprint);

    const docsEnrichment = await this.llmOrchestrator.enrichFiles(llmProvider, context, contractData, "docs", docsFiles, llmStrict);
    const promptsEnrichment = await this.llmOrchestrator.enrichFiles(llmProvider, context, contractData, "prompts", promptFiles, llmStrict);

    const fingerprintFile = await writeFingerprint(context, fingerprint);
    const contractFile = await this.contractGenerator.generate(context, fingerprint);
    const policyFile = await this.policyGenerator.generate(context);

    return {
      generatedFiles: [...docsFiles, ...promptFiles, fingerprintFile, contractFile, policyFile],
      fingerprint,
      enrichment: {
        provider: llmProviderName,
        docsFilesEnriched: docsEnrichment.appliedFiles.length,
        promptFilesEnriched: promptsEnrichment.appliedFiles.length,
        skippedReason: skipReason ?? docsEnrichment.skippedReason ?? promptsEnrichment.skippedReason
      }
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
