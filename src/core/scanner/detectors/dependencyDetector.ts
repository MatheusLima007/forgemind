import { resolve } from "node:path";
import type { DependencyInfo } from "../../types/index.js";
import { fileExists, readTextFile } from "../../../utils/fileSystem.js";

interface NodePackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface ComposerJson {
  require?: Record<string, string>;
}

export class DependencyDetector {
  async detect(rootPath: string): Promise<DependencyInfo> {
    const packageJsonPath = resolve(rootPath, "package.json");
    const composerJsonPath = resolve(rootPath, "composer.json");

    const packageJsonExists = await fileExists(packageJsonPath);
    const composerJsonExists = await fileExists(composerJsonPath);

    let packageDependencies: string[] = [];
    let composerDependencies: string[] = [];

    if (packageJsonExists) {
      const packageJson = JSON.parse(await readTextFile(packageJsonPath)) as NodePackageJson;
      packageDependencies = [
        ...Object.keys(packageJson.dependencies ?? {}),
        ...Object.keys(packageJson.devDependencies ?? {})
      ].sort();
    }

    if (composerJsonExists) {
      const composerJson = JSON.parse(await readTextFile(composerJsonPath)) as ComposerJson;
      composerDependencies = Object.keys(composerJson.require ?? {}).sort();
    }

    return {
      packageJson: packageJsonExists,
      composerJson: composerJsonExists,
      packageDependencies,
      composerDependencies
    };
  }
}
