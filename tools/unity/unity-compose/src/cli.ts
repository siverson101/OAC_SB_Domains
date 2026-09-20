import { join, resolve } from 'node:path';
import { parsePositiveInt } from './shared';
import { COMPOSE_ABILITIES, type ComposeAbility, type ComposeOptions } from './types';

function parseArgs(argv: string[]): Record<string, string | boolean> {
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

function firstString(args: Record<string, string | boolean>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = args[key];
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return undefined;
}

export function resolveOptions(argv: string[]): ComposeOptions {
  const args = parseArgs(argv);
  const projectRoot = resolve(String(args['project-root'] || process.cwd()));
  const opencodeDir = resolve(String(args['opencode-dir'] || join(projectRoot, '.opencode')));
  const requested = String(args.ability || 'coordination-board');
  const ability: ComposeAbility = (COMPOSE_ABILITIES as string[]).includes(requested)
    ? (requested as ComposeAbility)
    : 'coordination-board';

  const leaseRaw = args['lease-seconds'] ?? args.leaseSeconds;
  const leaseSeconds = leaseRaw === undefined ? undefined : parsePositiveInt(leaseRaw, 0);

  return {
    projectRoot,
    opencodeDir,
    ability,
    json: Boolean(args.json),
    list: Boolean(args.list),
    verb: firstString(args, ['verb', 'operation']),
    resource: firstString(args, ['resource', 'scope']),
    holder: firstString(args, ['holder', 'agent']),
    note: firstString(args, ['note']),
    leaseSeconds: leaseSeconds && leaseSeconds > 0 ? leaseSeconds : undefined,
    now: firstString(args, ['now']),
    primitivesDir: firstString(args, ['primitives-dir', 'primitivesDir']),
    capabilitiesDir: firstString(args, ['capabilities-dir', 'capabilitiesDir']),
    schema: firstString(args, ['schema']),
    source: firstString(args, ['source']),
    cliCommand: firstString(args, ['unity-cli', 'unityCli']) ?? 'unity',
  };
}
