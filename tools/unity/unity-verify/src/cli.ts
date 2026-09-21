import { join, resolve } from 'node:path';
import { firstString, parseArgs, parseCommaList, rejectPositionals, resolveAbility } from '../../../shared/cli-args';
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
  const changeScope = parseCommaList(firstString(args, ['change-scope', 'changeScope']));

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
    changeScope,
    gatesJson: firstString(args, ['gates', 'gates-json', 'gatesJson']),
    test: firstString(args, ['test', 'test-name', 'testName']),
    expectedReason: firstString(args, ['expected-reason', 'expectedReason']),
    failureMessage: firstString(args, ['failure-message', 'failureMessage']),
    testResults: firstString(args, ['test-results', 'testResults']),
    tdd: firstString(args, ['tdd']),
    feature: firstString(args, ['feature', 'slug']),
    testsDir: firstString(args, ['tests', 'tests-dir', 'testsDir']),
    testsJson: firstString(args, ['tests-json', 'testsJson']),
    apply: Boolean(args.apply),
  };
}
