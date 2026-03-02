import { resolve } from "node:path";
import { fileExists, readTextFile } from "../../../utils/fileSystem.js";

interface NodePackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export class FrameworkDetector {
  async detect(rootPath: string): Promise<string[]> {
    const packageJsonPath = resolve(rootPath, "package.json");
    if (!(await fileExists(packageJsonPath))) {
      return ["unknown"];
    }

    try {
      const packageJson = JSON.parse(await readTextFile(packageJsonPath)) as NodePackageJson;
      const deps = [
        ...Object.keys(packageJson.dependencies ?? {}),
        ...Object.keys(packageJson.devDependencies ?? {})
      ];

      // Generic heuristic only: return dependency names that look like platform/framework anchors
      const hints = deps
        .filter((name) => /framework|core|runtime|platform|engine|kit|sdk/i.test(name))
        .slice(0, 8)
        .map((name) => name.toLowerCase());

      const unique = [...new Set(hints)];
      return unique.length ? unique : ["unknown"];
    } catch {
      return ["unknown"];
    }
  }
}
