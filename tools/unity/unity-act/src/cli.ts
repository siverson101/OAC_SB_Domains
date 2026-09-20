import { join, resolve } from 'node:path';
import { parseBool } from './shared';
import { ACT_ABILITIES, type ActAbility, type ActOptions } from './types';

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

export function resolveOptions(argv: string[]): ActOptions {
  const args = parseArgs(argv);
  const projectRoot = resolve(String(args['project-root'] || process.cwd()));
  const opencodeDir = resolve(String(args['opencode-dir'] || join(projectRoot, '.opencode')));
  const requested = String(args.ability || 'scene-editing');
  const ability: ActAbility = (ACT_ABILITIES as string[]).includes(requested)
    ? (requested as ActAbility)
    : 'scene-editing';

  const dryRunRaw = args.dryRun ?? args['dry-run'] ?? args.dryrun;
  const enabled = firstString(args, ['enabled']);

  return {
    projectRoot,
    opencodeDir,
    ability,
    json: Boolean(args.json),
    list: Boolean(args.list),
    dryRun: parseBool(dryRunRaw, true),
    confirm: parseBool(args.confirm, false),
    gate: parseBool(args.gate, false),
    query: firstString(args, ['query']),
    category: firstString(args, ['category']),
    pattern: firstString(args, ['pattern']),
    enabled: enabled ? enabled.split(',').map((item) => item.trim()).filter(Boolean) : undefined,
    changeKind: firstString(args, ['change-kind', 'changeKind']),
    prefab: firstString(args, ['prefab', 'prefab-path', 'prefabPath']),
    opsFile: firstString(args, ['ops', 'ops-file']),
    opsJson: firstString(args, ['ops-json', 'opsJson']),
    template: firstString(args, ['template']),
    name: firstString(args, ['name']),
    namespace: firstString(args, ['namespace']),
    map: firstString(args, ['map']),
    out: firstString(args, ['out']),
    patternsFile: firstString(args, ['patterns-file', 'patternsFile']),
  };
}
