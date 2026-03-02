export function validateLLMOutputSchema(value: unknown): boolean {
  if (!isRecord(value)) return false;

  if (!isRecord(value.enrichedContent)) return false;
  const enrichedEntries = Object.values(value.enrichedContent);
  if (!enrichedEntries.every((entry) => typeof entry === "string")) return false;

  if (!isRecord(value.metadata)) return false;
  if (!isNonEmptyString(value.metadata.provider)) return false;
  if (!isNonEmptyString(value.metadata.model)) return false;

  if (value.metadata.baseUrl !== undefined && !isNonEmptyString(value.metadata.baseUrl)) {
    return false;
  }

  if (value.metadata.tokensUsed !== undefined && typeof value.metadata.tokensUsed !== "number") {
    return false;
  }

  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
