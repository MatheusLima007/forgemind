import { resolve } from "node:path";
import { fileExists, writeTextFile } from "../../../utils/fileSystem.js";
import { resolveTemplateContent } from "../../templates/templateResolver.js";
import type { GeneratorContext, PolicyChecklist, PolicyItem } from "../../types/index.js";

function requiredItems(context: GeneratorContext): PolicyItem[] {
  const { outputPaths } = context.config;
  return [
    { id: "DOC_AGENT_FIRST", description: "Agent-first documentation", path: `${outputPaths.docs}/agent-first.md`, required: true, status: "missing" },
    { id: "DOC_ARCHITECTURE", description: "Architecture documentation", path: `${outputPaths.docs}/architecture.md`, required: true, status: "missing" },
    { id: "PROMPT_REVIEW", description: "Review prompt", path: `${outputPaths.prompts}/review.md`, required: true, status: "missing" },
    { id: "PROMPT_FEATURE", description: "Feature prompt", path: `${outputPaths.prompts}/feature.md`, required: true, status: "missing" },
    { id: "PROMPT_REFACTOR", description: "Refactor prompt", path: `${outputPaths.prompts}/refactor.md`, required: true, status: "missing" },
    { id: "PROMPT_TROUBLESHOOTING", description: "Troubleshooting prompt", path: `${outputPaths.prompts}/troubleshooting.md`, required: true, status: "missing" },
    { id: "AI_CONTRACT", description: "AI contract", path: `${outputPaths.ai}/contract.json`, required: true, status: "missing" },
    { id: "AI_FINGERPRINT", description: "AI fingerprint", path: `${outputPaths.ai}/fingerprint.json`, required: true, status: "missing" }
  ];
}

export class PolicyGenerator {
  async buildChecklist(context: GeneratorContext): Promise<PolicyChecklist> {
    const items = requiredItems(context);

    for (const item of items) {
      const fullPath = resolve(context.scan.rootPath, item.path);
      item.status = (await fileExists(fullPath)) ? "present" : "missing";
    }

    return {
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
      level: context.config.compliance.level,
      items
    };
  }

  async generate(context: GeneratorContext): Promise<string> {
    const checklist = await this.buildChecklist(context);
    const path = resolve(context.scan.rootPath, context.config.outputPaths.policies, "checklist.json");
    const content = await resolveTemplateContent(
      context,
      "policies.checklist",
      JSON.stringify(checklist, null, 2),
      {
        "policy.checklist.json": JSON.stringify(checklist, null, 2)
      }
    );
    await writeTextFile(path, content);
    return path;
  }
}
