// Shared CLI argument parsing for the Unity family modules.
//
// The five family CLIs all accept `--flag value`, `--flag=value` and bare
// `--flag` (boolean). `firstString` picks the first non-empty alias, and
// `resolveAbility` coerces a requested ability to the family's known set.
export function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith('--') && arg.includes('=')) {
      const eq = arg.indexOf('=');
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
      i++;
      continue;
    }
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out[key] = next;
        i += 2;
      } else {
        out[key] = true;
        i++;
      }
      continue;
    }
    i++;
  }
  return out;
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
