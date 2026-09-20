import { join, resolve } from 'node:path';
import { firstString, parseArgs, rejectPositionals, resolveAbility } from '../../../shared/cli-args';
import { SENSE_ABILITIES, type SenseOptions } from './types';

export function resolveOptions(argv: string[]): SenseOptions {
  const { values: args, positional } = parseArgs(argv);
  rejectPositionals(positional);
  const projectRoot = resolve(String(args['project-root'] || process.cwd()));
  const opencodeDir = resolve(String(args['opencode-dir'] || join(projectRoot, '.opencode')));
  const requested = String(args.ability || 'project-status');
  const ability = resolveAbility(requested, SENSE_ABILITIES, 'project-status');
  const tableDir = firstString(args, ['table-dir', 'tableDir']);
  const assetFolder = firstString(args, ['asset-folder', 'assetFolder']);

  return {
    projectRoot,
    opencodeDir,
    ability,
    query: firstString(args, ['query']),
    json: Boolean(args.json),
    list: Boolean(args.list),
    tableDir: tableDir ? resolve(tableDir) : undefined,
    assetFolder: assetFolder ? resolve(assetFolder) : undefined,
  };
}
