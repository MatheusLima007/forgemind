interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}

const SHA256_HEX_REGEX = /^[a-f0-9]{64}$/i;

export function validateFingerprintSchema(value: unknown): SchemaValidationResult {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { valid: false, errors: ["fingerprint must be an object"] };
  }

  if (!isNonEmptyString(value.version)) {
    errors.push("version must be a non-empty string");
  }

  if (!isIsoDateString(value.generatedAt)) {
    errors.push("generatedAt must be a valid ISO date string");
  }

  if (!isSha256Hex(value.structureHash)) {
    errors.push("structureHash must be a SHA-256 hex string");
  }

  if (!isSha256Hex(value.dependenciesHash)) {
    errors.push("dependenciesHash must be a SHA-256 hex string");
  }

  if (!isSha256Hex(value.docsHash)) {
    errors.push("docsHash must be a SHA-256 hex string");
  }

  if (!isSha256Hex(value.fingerprint)) {
    errors.push("fingerprint must be a SHA-256 hex string");
  }

  return { valid: errors.length === 0, errors };
}

export function validateContractSchema(value: unknown): SchemaValidationResult {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { valid: false, errors: ["contract must be an object"] };
  }

  if (!isNonEmptyString(value.arrcVersion)) {
    errors.push("arrcVersion must be a non-empty string");
  }

  if (!isNonEmptyString(value.version)) {
    errors.push("version must be a non-empty string");
  }

  if (!isIsoDateString(value.generatedAt)) {
    errors.push("generatedAt must be a valid ISO date string");
  }

  if (value.complianceLevel !== "L1") {
    errors.push("complianceLevel must be 'L1'");
  }

  if (!isRecord(value.scanSummary)) {
    errors.push("scanSummary must be an object");
  } else {
    if (!isStringArray(value.scanSummary.languages)) {
      errors.push("scanSummary.languages must be an array of strings");
    }

    if (!isStringArray(value.scanSummary.frameworks)) {
      errors.push("scanSummary.frameworks must be an array of strings");
    }

    if (!isStringArray(value.scanSummary.dependencyFiles)) {
      errors.push("scanSummary.dependencyFiles must be an array of strings");
    }
  }

  const fingerprintResult = validateFingerprintSchema(value.fingerprint);
  if (!fingerprintResult.valid) {
    errors.push(...fingerprintResult.errors.map((message) => `fingerprint.${message}`));
  }

  return { valid: errors.length === 0, errors };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isIsoDateString(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function isSha256Hex(value: unknown): boolean {
  return typeof value === "string" && SHA256_HEX_REGEX.test(value);
}
