import { createHash } from "node:crypto";

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortJson(item));
  }

  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sortedKeys = Object.keys(record).sort();
    const output: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      output[key] = sortJson(record[key]);
    }
    return output;
  }

  return value;
}

export function hashJson(value: unknown): string {
  return hashContent(JSON.stringify(sortJson(value)));
}
