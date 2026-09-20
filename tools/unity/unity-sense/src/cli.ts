import { join, resolve } from 'node:path';
import { SENSE_ABILITIES, type SenseAbility, type SenseOptions } from './types';

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

export function resolveOptions(argv: string[]): SenseOptions {
  const args = parseArgs(argv);
  const projectRoot = resolve(String(args['project-root'] || process.cwd()));
  const opencodeDir = resolve(String(args['opencode-dir'] || join(projectRoot, '.opencode')));
  const requested = String(args.ability || 'project-status');
  const ability: SenseAbility = (SENSE_ABILITIES as string[]).includes(requested)
    ? (requested as SenseAbility)
    : 'project-status';

  return {
    projectRoot,
    opencodeDir,
    ability,
    query: typeof args.query === 'string' ? args.query : undefined,
    json: Boolean(args.json),
    list: Boolean(args.list),
    tableDir: typeof args['table-dir'] === 'string' ? resolve(args['table-dir']) : undefined,
    assetFolder: typeof args['asset-folder'] === 'string' ? resolve(args['asset-folder']) : undefined,
  };
}
