import { describe, expect, it } from "vitest";
import { hashJson } from "../../src/utils/hashing.js";

describe("fingerprint independence", () => {
  it("keeps hash stable when object key order changes", () => {
    const a = {
      version: "1.0.0",
      metadata: {
        provider: "openai",
        model: "gpt-5-mini"
      },
      content: {
        one: "a",
        two: "b"
      }
    };

    const b = {
      content: {
        two: "b",
        one: "a"
      },
      metadata: {
        model: "gpt-5-mini",
        provider: "openai"
      },
      version: "1.0.0"
    };

    expect(hashJson(a)).toBe(hashJson(b));
  });

  it("changes hash when semantic content changes", () => {
    const base = {
      version: "1.0.0",
      content: {
        one: "a"
      }
    };

    const changed = {
      version: "1.0.0",
      content: {
        one: "different"
      }
    };

    expect(hashJson(base)).not.toBe(hashJson(changed));
  });
});
