import { join, resolve } from 'node:path';
import { parseBool } from './shared';
import { RUN_ABILITIES, type RunAbility, type RunOptions } from './types';

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

export function resolveOptions(argv: string[]): RunOptions {
  const args = parseArgs(argv);
  const projectRoot = resolve(String(args['project-root'] || process.cwd()));
  const opencodeDir = resolve(String(args['opencode-dir'] || join(projectRoot, '.opencode')));
  const requested = String(args.ability || 'unity-change-loop');
  const ability: RunAbility = (RUN_ABILITIES as string[]).includes(requested)
    ? (requested as RunAbility)
    : 'unity-change-loop';

  return {
    projectRoot,
    opencodeDir,
    ability,
    json: Boolean(args.json),
    list: Boolean(args.list),
    claim: firstString(args, ['claim']),
    scope: firstString(args, ['scope']),
    operation: firstString(args, ['operation']),
    code: firstString(args, ['code']),
    approveCodeExecution: parseBool(
      args['approve-code-execution'] ?? args.approveCodeExecution ?? args['approve-code'],
      false
    ),
    live: undefined,
    cliCommand: firstString(args, ['unity-cli', 'unityCli']) ?? 'unity',
  };
}
