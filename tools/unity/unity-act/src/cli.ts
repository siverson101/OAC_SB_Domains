import { join, resolve } from 'node:path';
import { firstString, parseArgs, rejectPositionals, resolveAbility } from '../../../shared/cli-args';
import { parseBool } from './shared';
import { ACT_ABILITIES, type ActOptions } from './types';

export function resolveOptions(argv: string[]): ActOptions {
  const { values: args, positional } = parseArgs(argv);
  rejectPositionals(positional);
  const projectRoot = resolve(String(args['project-root'] || process.cwd()));
  const opencodeDir = resolve(String(args['opencode-dir'] || join(projectRoot, '.opencode')));
  const requested = String(args.ability || 'scene-editing');
  const ability = resolveAbility(requested, ACT_ABILITIES, 'scene-editing');

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
