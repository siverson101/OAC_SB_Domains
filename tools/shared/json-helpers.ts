// Shared JSON coercion helpers for the Unity family modules.
//
// These are fail-soft readers: a wrong type yields `null`/`[]` rather than
// throwing. They are deliberately free of any family-specific types so every
// module can import them without creating a cycle.
export type Json = Record<string, unknown>;

export function asRecord(value: unknown): Json | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : null;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function str(obj: Json | null, key: string): string | null {
  const value = obj?.[key];
  return typeof value === 'string' ? value : null;
}

export function num(obj: Json | null, key: string): number | null {
  const value = obj?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function bool(obj: Json | null, key: string): boolean | null {
  const value = obj?.[key];
  return typeof value === 'boolean' ? value : null;
}

export function stringArray(obj: Json | null, key: string): string[] {
  const value = obj?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function parseBool(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  const text = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(text)) return true;
  if (['false', '0', 'no', 'off'].includes(text)) return false;
  return fallback;
}
