import { join, resolve } from 'node:path';
import { firstString, parseArgs, rejectPositionals, resolveAbility } from '../../../shared/cli-args';
import { parseBool, asRecord } from '../../../shared/json-helpers';
import { nowIso, readText } from '../../../shared/io';
import { UNITY_SKILLS_ABILITIES, type UnitySkillsOptions } from './types';

function configUiStack(opencodeDir: string): string | undefined {
  const text = readText(join(opencodeDir, 'unity-studio.json'));
  if (!text) return undefined;
  try {
    const stack = asRecord(JSON.parse(text))?.uiStack;
    return typeof stack === 'string' && stack ? stack : undefined;
  } catch {
    return undefined;
  }
}

export function resolveOptions(argv: string[]): UnitySkillsOptions {
  const { values: args, positional } = parseArgs(argv);
  rejectPositionals(positional);
  const projectRoot = resolve(String(args['project-root'] || process.cwd()));
  const opencodeDir = resolve(String(args['opencode-dir'] || join(projectRoot, '.opencode')));
  const ability = resolveAbility(String(args.ability || 'unity-skills'), UNITY_SKILLS_ABILITIES, 'unity-skills');
  const off = parseBool(args.off, false);
  const status = parseBool(args.status, false);
  const install = parseBool(args.install, false) || parseBool(args.yes, false);
  // An empty `uiStack` means "not chosen": the CLI prompts (or defaults) in the
  // run step. `--yes` is the only consent flag; `--install` alone does not
  // authorise the network download.
  const uiStack = firstString(args, ['ui-stack', 'uiStack']) ?? configUiStack(opencodeDir) ?? '';

  return {
    projectRoot,
    opencodeDir,
    ability,
    json: parseBool(args.json, false),
    list: parseBool(args.list, false),
    install,
    off,
    status,
    consent: parseBool(args.yes, false),
    uiStack,
    ref: firstString(args, ['ref']),
    now: firstString(args, ['now']) ?? nowIso(),
    source: firstString(args, ['source']),
  };
}
