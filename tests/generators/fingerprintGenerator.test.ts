import { describe, expect, it } from "vitest";
import { hashJson, stableStringify } from "../../src/utils/hashing.js";

describe("fingerprint generator compatibility", () => {
  it("keeps deterministic hash for equivalent semantic payload", () => {
    const payloadA = {
      knowledge: {
        invariants: [{ name: "a", status: "confirmed" }],
        decisions: [{ title: "d1", choice: "x" }]
      },
      generatedAt: "2026-01-01T00:00:00.000Z"
    };

    const payloadB = {
      generatedAt: "2026-01-01T00:00:00.000Z",
      knowledge: {
        decisions: [{ choice: "x", title: "d1" }],
        invariants: [{ status: "confirmed", name: "a" }]
      }
    };

    expect(stableStringify(payloadA)).toBe(stableStringify(payloadB));
    expect(hashJson(payloadA)).toBe(hashJson(payloadB));
  });

  it("changes fingerprint when semantic content changes", () => {
    const base = { knowledge: { invariants: [{ name: "a" }] } };
    const changed = { knowledge: { invariants: [{ name: "b" }] } };

    expect(hashJson(base)).not.toBe(hashJson(changed));
  });
});
