export const SUPPORTED_ARRC_VERSION = "1.0.0";

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validateGeneratedAt(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    errors.push(`${path} must be an ISO date string`);
  }
}

function validateHash(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/i.test(value)) {
    errors.push(`${path} must be a SHA-256 hex string`);
  }
}

export function validateContractSchema(value: unknown): SchemaValidationResult {
  const errors: string[] = [];

  if (!isObject(value)) {
    return { valid: false, errors: ["contract must be an object"] };
  }

  if (value.arrcVersion !== SUPPORTED_ARRC_VERSION) {
    errors.push(`arrcVersion must be '${SUPPORTED_ARRC_VERSION}'`);
  }

  if (value.version !== "1.0.0") {
    errors.push("version must be '1.0.0'");
  }

  validateGeneratedAt(value.generatedAt, "generatedAt", errors);

  if (value.complianceLevel !== "L1") {
    errors.push("complianceLevel must be 'L1'");
  }

  if (!isObject(value.scanSummary)) {
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

  if (!isObject(value.fingerprint)) {
    errors.push("fingerprint must be an object");
  } else {
    if (value.fingerprint.version !== "1.0.0") {
      errors.push("fingerprint.version must be '1.0.0'");
    }
    validateGeneratedAt(value.fingerprint.generatedAt, "fingerprint.generatedAt", errors);
    validateHash(value.fingerprint.structureHash, "fingerprint.structureHash", errors);
    validateHash(value.fingerprint.dependenciesHash, "fingerprint.dependenciesHash", errors);
    validateHash(value.fingerprint.docsHash, "fingerprint.docsHash", errors);
    validateHash(value.fingerprint.fingerprint, "fingerprint.fingerprint", errors);
  }

  return { valid: errors.length === 0, errors };
}

export function validateFingerprintSchema(value: unknown): SchemaValidationResult {
  const errors: string[] = [];

  if (!isObject(value)) {
    return { valid: false, errors: ["fingerprint must be an object"] };
  }

  if (value.version !== "1.0.0") {
    errors.push("version must be '1.0.0'");
  }

  validateGeneratedAt(value.generatedAt, "generatedAt", errors);
  validateHash(value.structureHash, "structureHash", errors);
  validateHash(value.dependenciesHash, "dependenciesHash", errors);
  validateHash(value.docsHash, "docsHash", errors);
  validateHash(value.fingerprint, "fingerprint", errors);

  return { valid: errors.length === 0, errors };
}

export function validatePolicyChecklistSchema(value: unknown): SchemaValidationResult {
  const errors: string[] = [];

  if (!isObject(value)) {
    return { valid: false, errors: ["policy checklist must be an object"] };
  }

  if (value.version !== "1.0.0") {
    errors.push("version must be '1.0.0'");
  }

  validateGeneratedAt(value.generatedAt, "generatedAt", errors);

  if (value.level !== "L1") {
    errors.push("level must be 'L1'");
  }

  if (!Array.isArray(value.items)) {
    errors.push("items must be an array");
    return { valid: false, errors };
  }

  for (let index = 0; index < value.items.length; index += 1) {
    const item = value.items[index];
    if (!isObject(item)) {
      errors.push(`items[${index}] must be an object`);
      continue;
    }

    if (typeof item.id !== "string" || item.id.trim() === "") {
      errors.push(`items[${index}].id must be a non-empty string`);
    }

    if (typeof item.description !== "string" || item.description.trim() === "") {
      errors.push(`items[${index}].description must be a non-empty string`);
    }

    if (typeof item.path !== "string" || item.path.trim() === "") {
      errors.push(`items[${index}].path must be a non-empty string`);
    }

    if (typeof item.required !== "boolean") {
      errors.push(`items[${index}].required must be a boolean`);
    }

    if (item.status !== "present" && item.status !== "missing") {
      errors.push(`items[${index}].status must be 'present' or 'missing'`);
    }
  }

  return { valid: errors.length === 0, errors };
}
