import { resolve } from "node:path";
import type { GeneratorContext } from "../../types/index.js";
import { writeTextFile } from "../../../utils/fileSystem.js";
import { resolveTemplateContent } from "../../templates/templateResolver.js";

function renderAgentFirst(context: GeneratorContext): string {
  const { scan } = context;
  const dependencyFiles = [
    ...(scan.dependencies.packageJson ? ["package.json"] : []),
    ...(scan.dependencies.composerJson ? ["composer.json"] : [])
  ].join(", ") || "none";

  return `# Agent-First Repository Guide

## Purpose
This repository is governed by ForgeMind to support deterministic collaboration between humans and AI agents.

## Project Signals
- Languages: ${scan.languages.join(", ")}
- Frameworks: ${scan.frameworks.join(", ")}
- Dependency files: ${dependencyFiles}

## Agent Boundaries
- Follow existing architecture and contracts.
- Do not introduce undocumented framework conventions.
- Update documentation artifacts when changing architecture.

## Governance
- Always run \`forgemind scan\` after structural changes.
- Always run \`forgemind validate\` in CI.
`;
}

function renderArchitecture(context: GeneratorContext): string {
  const { scan } = context;
  const folders = scan.structure.topLevel.map((folder) => `- ${folder}`).join("\n") || "- (no directories found)";

  return `# Architecture Overview

## Stack Snapshot
- Languages: ${scan.languages.join(", ")}
- Frameworks: ${scan.frameworks.join(", ")}

## Top-Level Folders
${folders}

## Dependency Snapshot
- Node dependencies: ${scan.dependencies.packageDependencies.length}
- Composer dependencies: ${scan.dependencies.composerDependencies.length}

## Architectural Signals
${scan.signals.map((signal) => `- ${signal}`).join("\n") || "- none"}
`;
}

export class DocumentationGenerator {
  async generate(context: GeneratorContext): Promise<string[]> {
    const docsDir = resolve(context.scan.rootPath, context.config.outputPaths.docs);
    const agentFirstPath = resolve(docsDir, "agent-first.md");
    const architecturePath = resolve(docsDir, "architecture.md");

    const [agentFirstContent, architectureContent] = await Promise.all([
      resolveTemplateContent(context, "docs.agentFirst", renderAgentFirst(context)),
      resolveTemplateContent(context, "docs.architecture", renderArchitecture(context))
    ]);

    await Promise.all([
      writeTextFile(agentFirstPath, agentFirstContent),
      writeTextFile(architecturePath, architectureContent)
    ]);

    return [agentFirstPath, architecturePath];
  }
}
