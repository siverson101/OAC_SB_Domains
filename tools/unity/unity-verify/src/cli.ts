import { join, resolve } from 'node:path';
import { firstString, parseArgs, rejectPositionals, resolveAbility } from '../../../shared/cli-args';
import {
  VERIFY_ABILITIES,
  type ReviewIntensity,
  type VerifyOptions,
  type VerifyPhase,
} from './types';

const PHASES: VerifyPhase[] = ['checkpoint', 'validate'];
const INTENSITIES: ReviewIntensity[] = ['full', 'lean', 'solo'];

export function resolveOptions(argv: string[]): VerifyOptions {
  const { values: args, positional } = parseArgs(argv);
  rejectPositionals(positional);
  const projectRoot = resolve(String(args['project-root'] || process.cwd()));
  const opencodeDir = resolve(String(args['opencode-dir'] || join(projectRoot, '.opencode')));
  const requested = String(args.ability || 'compile-and-verify-project');
  const ability = resolveAbility(requested, VERIFY_ABILITIES, 'compile-and-verify-project');

  const phaseRaw = firstString(args, ['phase']);
  const intensityRaw = firstString(args, ['review-intensity', 'reviewIntensity']);

  return {
    projectRoot,
    opencodeDir,
    ability,
    json: Boolean(args.json),
    list: Boolean(args.list),
    phase: phaseRaw && (PHASES as string[]).includes(phaseRaw) ? (phaseRaw as VerifyPhase) : 'validate',
    cliCommand: firstString(args, ['unity-cli', 'unityCli']) ?? 'unity',
    reviewIntensity:
      intensityRaw && (INTENSITIES as string[]).includes(intensityRaw)
        ? (intensityRaw as ReviewIntensity)
        : 'full',
    gatesJson: firstString(args, ['gates', 'gates-json', 'gatesJson']),
  };
}
