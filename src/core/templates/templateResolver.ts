import { isAbsolute, resolve } from "node:path";
import type { GeneratorContext } from "../types/index.js";
import { fileExists, readTextFile } from "../../utils/fileSystem.js";

function buildVariables(context: GeneratorContext, extra: Record<string, string>): Record<string, string> {
  const { scannedAt: _, ...stableScan } = context.scan;
  const dependencyFiles = [
    ...(context.scan.dependencies.packageJson ? ["package.json"] : []),
    ...(context.scan.dependencies.composerJson ? ["composer.json"] : [])
  ];

  return {
    "rootPath": context.scan.rootPath,
    "compliance.level": context.config.compliance.level,
    "scan.languages": context.scan.languages.join(", "),
    "scan.frameworks": context.scan.frameworks.join(", "),
    "scan.signals": context.scan.signals.join(", "),
    "scan.structure.topLevel": context.scan.structure.topLevel.join(", "),
    "scan.dependencies.packageJson": String(context.scan.dependencies.packageJson),
    "scan.dependencies.composerJson": String(context.scan.dependencies.composerJson),
    "scan.dependencies.packageDependencies": context.scan.dependencies.packageDependencies.join(", "),
    "scan.dependencies.composerDependencies": context.scan.dependencies.composerDependencies.join(", "),
    "scan.dependencies.files": dependencyFiles.join(", "),
    "scan.json": JSON.stringify(stableScan, null, 2),
    ...extra
  };
}

function renderPlaceholders(template: string, variables: Record<string, string>): string {
  return template.replace(/{{\s*([a-zA-Z0-9._-]+)\s*}}/g, (_, key: string) => {
    return variables[key] ?? "";
  });
}

export async function resolveTemplateContent(
  context: GeneratorContext,
  key: string,
  defaultContent: string,
  extra: Record<string, string> = {}
): Promise<string> {
  const overridePathOrUndefined = context.config.templateOverrides[key];
  const variables = buildVariables(context, extra);

  if (!overridePathOrUndefined) {
    return renderPlaceholders(defaultContent, variables);
  }

  const overridePath = isAbsolute(overridePathOrUndefined)
    ? overridePathOrUndefined
    : resolve(context.scan.rootPath, overridePathOrUndefined);

  if (!(await fileExists(overridePath))) {
    throw new Error(`Template override not found for '${key}': ${overridePath}`);
  }

  const template = await readTextFile(overridePath);
  return renderPlaceholders(template, variables);
}