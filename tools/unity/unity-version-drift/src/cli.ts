import { join, resolve } from 'node:path';
import { firstString, parseArgs, parseOptionalPositiveInt, rejectPositionals, resolveAbility } from '../../../shared/cli-args';
import { parseBool } from '../../../shared/json-helpers';
import { nowIso } from '../../../shared/io';
import { MAX_AGE_HOURS_DEFAULT } from './shared';
import { VERSION_DRIFT_ABILITIES, type VersionDriftOptions } from './types';

export function resolveOptions(argv: string[]): VersionDriftOptions {
  const { values: args, positional } = parseArgs(argv);
  rejectPositionals(positional);
  const projectRoot = resolve(String(args['project-root'] || process.cwd()));
  const opencodeDir = resolve(String(args['opencode-dir'] || join(projectRoot, '.opencode')));
  const ability = resolveAbility(String(args.ability || 'version-drift'), VERSION_DRIFT_ABILITIES, 'version-drift');
  const maxAgeHours =
    parseOptionalPositiveInt(firstString(args, ['max-age-hours', 'maxAgeHours'])) ?? MAX_AGE_HOURS_DEFAULT;

  return {
    projectRoot,
    opencodeDir,
    ability,
    json: parseBool(args.json, false),
    list: parseBool(args.list, false),
    ifDue: parseBool(args['if-due'] ?? args.ifDue, false),
    maxAgeHours,
    // `--now` is a test seam so cadence never reads the wall-clock.
    now: firstString(args, ['now']) ?? nowIso(),
    cliCommand: firstString(args, ['cli-command', 'cliCommand']) ?? 'unity',
  };
}
