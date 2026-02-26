import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, expect, afterEach } from "vitest";
import { LanguageDetector } from "../../src/core/scanner/detectors/languageDetector.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("LanguageDetector", () => {
  it("detects TypeScript as dominant language", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-lang-"));
    createdDirs.push(root);

    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src", "a.ts"), "export const a = 1;", "utf-8");
    await writeFile(join(root, "src", "b.ts"), "export const b = 2;", "utf-8");
    await writeFile(join(root, "src", "c.js"), "module.exports = {};", "utf-8");

    const detector = new LanguageDetector();
    const result = await detector.detect(root, ["node_modules", ".git"]);

    expect(result[0]).toBe("typescript");
  });
});
