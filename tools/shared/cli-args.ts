// Shared CLI argument parsing for the Unity family modules.
//
// The five family CLIs all accept `--flag value`, `--flag=value` and bare
// `--flag` (boolean). `firstString` picks the first non-empty alias, and
// `resolveAbility` coerces a requested ability to the family's known set.
//
// Positional (non-flag) arguments are never dropped silently: they are returned
// in `positional` so callers can reject them. Negative numeric values such as
// `--timeout -1` are accepted as values, not mistaken for flags — only a `--`
// prefix starts a flag.
export interface ParsedArgs {
  values: Record<string, string | boolean>;
  positional: string[];
}

function isFlag(token: string): boolean {
  return token.startsWith('--');
}

export function parseArgs(argv: string[]): ParsedArgs {
  const values: Record<string, string | boolean> = {};
  const positional: string[] = [];
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (isFlag(arg) && arg.includes('=')) {
      const eq = arg.indexOf('=');
      values[arg.slice(2, eq)] = arg.slice(eq + 1);
      i++;
      continue;
    }
    if (isFlag(arg)) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !isFlag(next)) {
        values[key] = next;
        i += 2;
      } else {
        values[key] = true;
        i++;
      }
      continue;
    }
    positional.push(arg);
    i++;
  }
  return { values, positional };
}

// The family CLIs are flag-only: a bare word is almost always a typo (a missing
// `--flag` or a misplaced value). Reject it with a usage error rather than
// dropping it silently, so the caller sees exactly which token was unexpected.
export function rejectPositionals(positional: string[]): void {
  if (positional.length === 0) return;
  throw new Error(`unexpected positional argument(s): ${positional.join(' ')}; use --flag value pairs`);
}

export function firstString(args: Record<string, string | boolean>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = args[key];
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return undefined;
}

// Parse a comma-separated CLI list (e.g. `--change-scope a,b`,
// `--abilities a,b,c`). Trims each entry and drops empty ones; an absent value
// yields `undefined`. Note the `undefined`/empty distinction is not currently
// used: callers treat both as "no list supplied" (e.g.
// `compile-and-verify-project` refuses on either), so an empty `--change-scope`
// is no-scope, not an error.
export function parseCommaList(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  return value
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token !== '');
}

export function resolveAbility<T extends string>(requested: string, abilities: readonly T[], fallback: T): T {
  return (abilities as readonly string[]).includes(requested) ? (requested as T) : fallback;
}

// Convention for optional positive-int CLI flags (e.g. --lease-seconds,
// --wait-seconds, --timeout): an absent, empty, non-numeric or `<= 0` value
// means "unset", yielding `undefined` so the caller's default applies. Returns
// `undefined` for a missing or non-positive value so callers resolve their
// default in exactly one place; `--lease-seconds 0` therefore means "unset",
// not "expire immediately".
export function parseOptionalPositiveInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.floor(parsed);
}
