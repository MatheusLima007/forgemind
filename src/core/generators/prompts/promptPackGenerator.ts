import { resolve } from "node:path";
import type { GeneratorContext } from "../../types/index.js";
import { writeTextFile } from "../../../utils/fileSystem.js";
import { resolveTemplateContent } from "../../templates/templateResolver.js";

function commonHeader(context: GeneratorContext): string {
  return `Project languages: ${context.scan.languages.join(", ")}\nProject frameworks: ${context.scan.frameworks.join(", ")}\nGovernance level: ${context.config.compliance.level}`;
}

export class PromptPackGenerator {
  async generate(context: GeneratorContext): Promise<string[]> {
    const promptsDir = resolve(context.scan.rootPath, context.config.outputPaths.prompts);

    const review = `# Review Prompt\n\n${commonHeader(context)}\n\nReview the proposed change for architecture alignment, contract compliance, and deterministic behavior. Focus on repository governance, not style nitpicks.`;
    const feature = `# Feature Prompt\n\n${commonHeader(context)}\n\nImplement the requested feature while preserving module boundaries and updating AI-governance artifacts when needed.`;
    const refactor = `# Refactor Prompt\n\n${commonHeader(context)}\n\nRefactor for maintainability without changing behavior. Keep outputs deterministic and update docs/contracts if architecture changes.`;
    const troubleshooting = `# Troubleshooting Prompt\n\n${commonHeader(context)}\n\nDiagnose the issue using repository signals, dependency files, and documented architecture. Propose deterministic fixes and validation steps.`;

    const files = [
      { path: resolve(promptsDir, "review.md"), key: "prompts.review", content: review },
      { path: resolve(promptsDir, "feature.md"), key: "prompts.feature", content: feature },
      { path: resolve(promptsDir, "refactor.md"), key: "prompts.refactor", content: refactor },
      { path: resolve(promptsDir, "troubleshooting.md"), key: "prompts.troubleshooting", content: troubleshooting }
    ];

    await Promise.all(
      files.map(async (file) => {
        const content = await resolveTemplateContent(context, file.key, file.content);
        await writeTextFile(file.path, content);
      })
    );

    return files.map((file) => file.path);
  }
}
