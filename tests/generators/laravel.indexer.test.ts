import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultConfig } from "../../src/core/config/defaults.js";
import { CandidatesCollector } from "../../src/core/generators/candidates/candidatesCollector.js";
import { createIndexer } from "../../src/core/generators/indexers/indexerFactory.js";
import { ProfileGenerator } from "../../src/core/generators/profile/profileGenerator.js";
import { RepositoryScanner } from "../../src/core/scanner/repositoryScanner.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("Laravel indexer", () => {
  it("detects route hints from attributes when conventional routes files are missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-laravel-indexer-"));
    createdDirs.push(root);

    await mkdir(join(root, "app", "Http", "Controllers"), { recursive: true });
    await writeFile(
      join(root, "composer.json"),
      JSON.stringify({
        require: {
          "laravel/framework": "^11.0"
        }
      }),
      "utf-8"
    );

    await writeFile(
      join(root, "app", "Http", "Controllers", "OrderController.php"),
      `<?php
namespace App\\Http\\Controllers;

#[Route('/orders', methods: ['GET'])]
class OrderController extends Controller
{
    public function index() {}
}
`,
      "utf-8"
    );

    const scanner = new RepositoryScanner();
    const scan = await scanner.scan(root, defaultConfig);
    const context = { scan, config: defaultConfig };

    const candidates = await new CandidatesCollector().collect(context, "laravel");
    const profile = await new ProfileGenerator().generate(context, candidates, "laravel");
    const index = await createIndexer(candidates.framework, "laravel").index(context, candidates, profile);

    expect(candidates.files.some((item) => item.category === "laravel.route-source")).toBe(true);
    expect(index.endpoints.length).toBeGreaterThan(0);
    expect(index.endpoints[0].path).toBe("/orders");
  });
});
