export interface ContractValidation {
  ok: boolean;
  errors: string[];
}

interface ContractPropertySchema {
  type?: string | string[];
  enum?: string[];
  items?: { type?: string };
}

interface ContractSchema {
  required?: string[];
  properties?: Record<string, ContractPropertySchema>;
}

function isMissing(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function isType(value: unknown, type: string, property: ContractPropertySchema): boolean {
  if (type === 'string') return typeof value === 'string';
  if (type === 'number') return typeof value === 'number';
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'array') {
    if (!Array.isArray(value)) return false;
    return property.items?.type !== 'string' || value.every((item) => typeof item === 'string');
  }
  return true;
}

// Deliberately small JSON-Schema subset: top-level `required` presence,
// top-level `enum` membership, top-level scalar `type` (string/number/
// boolean/object) and `array`, plus `items.type === 'string'` element checks.
// It does NOT recurse into nested `properties`, does not support `oneOf`
// (the capability contract schema uses none), and does not enforce
// `additionalProperties`, `pattern`, or numeric bounds. Nested objects are
// type-checked as a whole but their members are not validated.
export function validateContract(data: Record<string, unknown>, schema: ContractSchema): ContractValidation {
  const errors: string[] = [];

  for (const key of schema.required ?? []) {
    if (isMissing(data[key])) {
      errors.push(`missing required field: ${key}`);
    }
  }

  for (const [key, property] of Object.entries(schema.properties ?? {})) {
    const value = data[key];
    if (value === undefined || value === null) continue;

    if (property.enum) {
      if (!property.enum.includes(value as string)) {
        errors.push(`invalid ${key}: expected one of ${property.enum.join('|')}, got ${JSON.stringify(value)}`);
      }
      continue;
    }

    const types = Array.isArray(property.type) ? property.type : property.type ? [property.type] : [];
    if (types.length === 0) continue;

    const matches = types.some((type) => isType(value, type, property));
    if (!matches) {
      errors.push(`invalid ${key}: expected ${types.join('|')}, got ${JSON.stringify(value)}`);
    }
  }

  return { ok: errors.length === 0, errors };
}
