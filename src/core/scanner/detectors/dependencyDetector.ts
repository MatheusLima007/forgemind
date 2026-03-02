import { resolve } from "node:path";
import { fileExists, readTextFile } from "../../../utils/fileSystem.js";
import type { DependencyInfo } from "../../types/index.js";

const KNOWN_CONFIG_FILES = [
  "package.json",
  "composer.json",
  "requirements.txt",
  "Pipfile",
  "pyproject.toml",
  "go.mod",
  "Cargo.toml",
  "build.gradle",
  "pom.xml",
  "Gemfile",
  "mix.exs",
  "pubspec.yaml",
  "Package.swift",
  "CMakeLists.txt",
  "flake.nix"
];

interface NodePackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

interface ComposerJson {
  require?: Record<string, string>;
  "require-dev"?: Record<string, string>;
}

function parseRequirementsTxt(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("-"))
    .map((line) => line.split(/[>=<~!;@\s]/)[0].trim())
    .filter(Boolean);
}

function parseGoMod(content: string): string[] {
  const dependencies = new Set<string>();
  const requireBlock = content.match(/require\s*\(([\s\S]*?)\)/g);

  if (requireBlock) {
    for (const block of requireBlock) {
      const lines = block.split("\n").slice(1, -1);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("//")) {
          const parts = trimmed.split(/\s+/);
          if (parts[0]) dependencies.add(parts[0]);
        }
      }
    }
  }

  for (const match of content.matchAll(/^require\s+(\S+)/gm)) {
    if (match[1]) dependencies.add(match[1]);
  }

  return [...dependencies];
}

function parseGemfile(content: string): string[] {
  const dependencies = new Set<string>();
  for (const match of content.matchAll(/^\s*gem\s+["']([^"']+)["']/gm)) {
    if (match[1]) dependencies.add(match[1]);
  }
  return [...dependencies];
}

function parseCargoToml(content: string): string[] {
  const dependencies = new Set<string>();
  let inDeps = false;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[dependencies")) {
      inDeps = true;
      continue;
    }
    if (inDeps && trimmed.startsWith("[")) {
      inDeps = false;
    }
    if (inDeps && trimmed && !trimmed.startsWith("#")) {
      const key = trimmed.split("=")[0]?.trim();
      if (key) dependencies.add(key);
    }
  }

  return [...dependencies];
}

export class DependencyDetector {
  async detect(rootPath: string): Promise<DependencyInfo> {
    const configFiles: string[] = [];
    const dependencies = new Set<string>();

    for (const file of KNOWN_CONFIG_FILES) {
      const path = resolve(rootPath, file);
      if (!(await fileExists(path))) continue;
      configFiles.push(file);

      try {
        const content = await readTextFile(path);

        if (file === "package.json") {
          const packageJson = JSON.parse(content) as NodePackageJson;
          for (const dep of Object.keys(packageJson.dependencies ?? {})) dependencies.add(dep);
          for (const dep of Object.keys(packageJson.devDependencies ?? {})) dependencies.add(dep);
          for (const dep of Object.keys(packageJson.peerDependencies ?? {})) dependencies.add(dep);
        } else if (file === "composer.json") {
          const composerJson = JSON.parse(content) as ComposerJson;
          for (const dep of Object.keys(composerJson.require ?? {})) dependencies.add(dep);
          for (const dep of Object.keys(composerJson["require-dev"] ?? {})) dependencies.add(dep);
        } else if (file === "requirements.txt") {
          for (const dep of parseRequirementsTxt(content)) dependencies.add(dep);
        } else if (file === "go.mod") {
          for (const dep of parseGoMod(content)) dependencies.add(dep);
        } else if (file === "Gemfile") {
          for (const dep of parseGemfile(content)) dependencies.add(dep);
        } else if (file === "Cargo.toml") {
          for (const dep of parseCargoToml(content)) dependencies.add(dep);
        }
      } catch {
        // ignore malformed files
      }
    }

    const ecosystemHints = this.buildEcosystemHints(configFiles);

    return {
      configFiles: configFiles.sort(),
      dependencies: [...dependencies].sort(),
      ecosystemHints
    };
  }

  private buildEcosystemHints(configFiles: string[]): string[] {
    const hints = new Set<string>();

    if (configFiles.includes("package.json")) hints.add("node-ecosystem");
    if (configFiles.includes("go.mod")) hints.add("go-ecosystem");
    if (configFiles.includes("requirements.txt") || configFiles.includes("pyproject.toml") || configFiles.includes("Pipfile")) {
      hints.add("python-ecosystem");
    }
    if (configFiles.includes("Cargo.toml")) hints.add("rust-ecosystem");
    if (configFiles.includes("composer.json")) hints.add("php-ecosystem");
    if (configFiles.includes("Gemfile")) hints.add("ruby-ecosystem");
    if (configFiles.includes("pom.xml") || configFiles.includes("build.gradle")) hints.add("jvm-ecosystem");

    return [...hints].sort();
  }
}
