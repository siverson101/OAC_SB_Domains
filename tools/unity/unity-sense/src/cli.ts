import { join, resolve } from 'node:path';
import { parseArgs, resolveAbility } from '../../../shared/cli-args';
import { SENSE_ABILITIES, type SenseOptions } from './types';

export function resolveOptions(argv: string[]): SenseOptions {
  const { values: args } = parseArgs(argv);
  const projectRoot = resolve(String(args['project-root'] || process.cwd()));
  const opencodeDir = resolve(String(args['opencode-dir'] || join(projectRoot, '.opencode')));
  const requested = String(args.ability || 'project-status');
  const ability = resolveAbility(requested, SENSE_ABILITIES, 'project-status');

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
