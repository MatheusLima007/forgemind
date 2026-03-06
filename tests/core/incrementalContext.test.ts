import { describe, expect, it } from "vitest";
import { diffTrackedFiles, planPartialRegeneration } from "../../src/core/orchestrator/incrementalContext.js";

describe("incrementalContext", () => {
  it("detects changed and removed files deterministically", () => {
    const previous = {
      "src/a.ts": "hash-a",
      "src/b.ts": "hash-b",
      "docs/old.md": "hash-old"
    };

    const current = {
      "src/a.ts": "hash-a",
      "src/b.ts": "hash-b2",
      "src/c.ts": "hash-c"
    };

    const diff = diffTrackedFiles(previous, current);

    expect(diff.unchanged).toBe(false);
    expect(diff.changedFiles).toEqual(["src/b.ts", "src/c.ts"]);
    expect(diff.removedFiles).toEqual(["docs/old.md"]);
  });

  it("plans partial regeneration for boundary-only changes", () => {
    const plan = planPartialRegeneration({
      changedFiles: ["src/core/boundaries/paymentBoundary.ts"],
      removedFiles: [],
      unchanged: false
    });

    expect(plan.requiresFullRegeneration).toBe(false);
    expect(plan.docsToRegenerate).toEqual(["agent-operating-manual", "module-boundaries"]);
  });

  it("falls back to full regeneration for unknown source changes", () => {
    const plan = planPartialRegeneration({
      changedFiles: ["src/runtime/bootstrap.ts"],
      removedFiles: [],
      unchanged: false
    });

    expect(plan.requiresFullRegeneration).toBe(true);
    expect(plan.docsToRegenerate).toHaveLength(5);
  });

  it("does not regenerate documents when there are no tracked changes", () => {
    const plan = planPartialRegeneration({
      changedFiles: [],
      removedFiles: [],
      unchanged: true
    });

    expect(plan.docsToRegenerate).toEqual([]);
    expect(plan.areas).toEqual([]);
  });
});
