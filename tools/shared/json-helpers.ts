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

// Recursively sort object keys so a hash is insensitive to key order (and to
// whether the value came from a file or inline JSON). Arrays keep their order.
export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) out[key] = canonicalize(source[key]);
    return out;
  }
  return value;
}

// Convention for optional positive-int CLI flags (e.g. --lease-seconds,
// --wait-seconds, --timeout): an absent, empty, non-numeric or `<= 0` value
// means "unset", yielding `undefined` so the caller's default applies. The
// helper for this lives in `tools/unity/unity-compose/src/shared.ts`
// (`parseOptionalPositiveInt`); reuse that shape rather than re-inventing it.
export function parseBool(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  const text = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(text)) return true;
  if (['false', '0', 'no', 'off'].includes(text)) return false;
  return fallback;
}
