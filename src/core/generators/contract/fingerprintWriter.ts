import { resolve } from "node:path";
import type { GeneratorContext, RepoFingerprint } from "../../types/index.js";
import { writeTextFile } from "../../../utils/fileSystem.js";

export async function writeFingerprint(context: GeneratorContext, fingerprint: RepoFingerprint): Promise<string> {
  const path = resolve(context.scan.rootPath, context.config.outputPaths.ai, "fingerprint.json");
  await writeTextFile(path, JSON.stringify(fingerprint, null, 2));
  return path;
}
