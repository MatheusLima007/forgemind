import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DomainMiner } from "../../src/core/mining/domainMiner.js";
import type { ScanResult } from "../../src/core/types/index.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function buildScan(rootPath: string): ScanResult {
  return {
    rootPath,
    languages: ["typescript"],
    frameworks: ["unknown"],
    configFilesFound: [],
    dependencies: {
      configFiles: ["package.json"],
      dependencies: [],
      ecosystemHints: ["node-ecosystem"]
    },
    signals: [],
    scannedAt: new Date().toISOString()
  };
}

describe("DomainMiner", () => {
  it("extracts entities, guards and workflow candidates from generic code surfaces", async () => {
    const root = await mkdtemp(join(tmpdir(), "forgemind-domain-miner-"));
    createdDirs.push(root);

    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src", "createOrder.ts"), "export class CreateOrderService {}\n", "utf-8");
    await writeFile(join(root, "src", "approveOrder.ts"), "export class ApproveOrderService {}\n", "utf-8");
    await writeFile(join(root, "src", "orderValidator.ts"), "if (!order.id) throw new Error('missing');\nassert(order.items.length > 0);\nvalidateOrder(order);\n", "utf-8");

    const miner = new DomainMiner();
    const result = await miner.mine(buildScan(root), ["node_modules", ".git", "dist"]);

    expect(result.some((entry) => entry.kind === "entity" && entry.name.includes("Order"))).toBe(true);
    expect(result.some((entry) => entry.kind === "workflow" && entry.name === "lifecycle-workflow")).toBe(true);
    expect(result.some((entry) => entry.kind === "guard" || entry.kind === "invariant")).toBe(true);
  });
});
