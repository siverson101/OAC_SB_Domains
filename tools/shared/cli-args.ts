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

export function firstString(args: Record<string, string | boolean>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = args[key];
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return undefined;
}

export function resolveAbility<T extends string>(requested: string, abilities: readonly T[], fallback: T): T {
  return (abilities as readonly string[]).includes(requested) ? (requested as T) : fallback;
}
