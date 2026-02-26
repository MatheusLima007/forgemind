import { resolve } from "node:path";
import { writeTextFile } from "../../../utils/fileSystem.js";
import { stableStringify } from "../../../utils/hashing.js";
import type { GeneratorContext, RepoFingerprint } from "../../types/index.js";

export async function writeFingerprint(context: GeneratorContext, fingerprint: RepoFingerprint): Promise<string> {
  const path = resolve(context.scan.rootPath, context.config.outputPaths.ai, "fingerprint.json");
  await writeTextFile(path, stableStringify(fingerprint));
  return path;
}
