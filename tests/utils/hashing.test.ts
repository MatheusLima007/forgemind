import { describe, expect, it } from "vitest";
import { hashJson, stableStringify } from "../../src/utils/hashing.js";

describe("hashing stability", () => {
  it("stableStringify sorts nested keys deterministically", () => {
    const value = {
      z: 1,
      a: {
        y: 2,
        b: 3
      }
    };

    expect(stableStringify(value)).toBe(`{\n  \"a\": {\n    \"b\": 3,\n    \"y\": 2\n  },\n  \"z\": 1\n}`);
  });

  it("hashJson is stable for different key insertion orders", () => {
    const one = { a: 1, b: { c: 2, d: 3 } };
    const two = { b: { d: 3, c: 2 }, a: 1 };

    expect(hashJson(one)).toBe(hashJson(two));
  });
});
