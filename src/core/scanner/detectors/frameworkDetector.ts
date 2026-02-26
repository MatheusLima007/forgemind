import { resolve } from "node:path";
import { fileExists, readTextFile } from "../../../utils/fileSystem.js";
import type { SupportedFramework } from "../../types/index.js";

interface NodePackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface ComposerJson {
  require?: Record<string, string>;
}

export class FrameworkDetector {
  async detect(rootPath: string): Promise<SupportedFramework[]> {
    const detected = new Set<SupportedFramework>();

    const packageJsonPath = resolve(rootPath, "package.json");
    if (await fileExists(packageJsonPath)) {
      const packageJson = JSON.parse(await readTextFile(packageJsonPath)) as NodePackageJson;
      const deps = new Set([
        ...Object.keys(packageJson.dependencies ?? {}),
        ...Object.keys(packageJson.devDependencies ?? {})
      ]);

      if (deps.has("@nestjs/core")) {
        detected.add("nestjs");
      }
      if (deps.has("react")) {
        detected.add("react");
      }
    }

    const composerJsonPath = resolve(rootPath, "composer.json");
    if (await fileExists(composerJsonPath)) {
      const composerJson = JSON.parse(await readTextFile(composerJsonPath)) as ComposerJson;
      const deps = new Set(Object.keys(composerJson.require ?? {}));
      if (deps.has("laravel/framework")) {
        detected.add("laravel");
      }
    }

    return detected.size ? [...detected] : ["unknown"];
  }
}
