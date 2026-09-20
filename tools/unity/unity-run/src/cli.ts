import { join, resolve } from 'node:path';
import { firstString, parseArgs, resolveAbility } from '../../../shared/cli-args';
import { parseBool } from './shared';
import { RUN_ABILITIES, type RunOptions } from './types';

export function resolveOptions(argv: string[]): RunOptions {
  const { values: args } = parseArgs(argv);
  const projectRoot = resolve(String(args['project-root'] || process.cwd()));
  const opencodeDir = resolve(String(args['opencode-dir'] || join(projectRoot, '.opencode')));
  const requested = String(args.ability || 'unity-change-loop');
  const ability = resolveAbility(requested, RUN_ABILITIES, 'unity-change-loop');

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
    cliCommand: firstString(args, ['unity-cli', 'unityCli']) ?? 'unity',
  };
}
