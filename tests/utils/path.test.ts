import { describe, expect, it } from "vitest";
import { normalizeToPosixPath } from "../../src/utils/path.js";

describe("normalizeToPosixPath", () => {
  it("normalizes windows-style separators", () => {
    expect(normalizeToPosixPath("docs\\agent-first.md")).toBe("docs/agent-first.md");
  });

  it("keeps posix path unchanged", () => {
    expect(normalizeToPosixPath("docs/architecture.md")).toBe("docs/architecture.md");
  });
});
