import { join, resolve } from 'node:path';
import {
  VERIFY_ABILITIES,
  type ReviewIntensity,
  type VerifyAbility,
  type VerifyOptions,
  type VerifyPhase,
} from './types';

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

const PHASES: VerifyPhase[] = ['checkpoint', 'validate'];
const INTENSITIES: ReviewIntensity[] = ['full', 'lean', 'solo'];

export function resolveOptions(argv: string[]): VerifyOptions {
  const args = parseArgs(argv);
  const projectRoot = resolve(String(args['project-root'] || process.cwd()));
  const opencodeDir = resolve(String(args['opencode-dir'] || join(projectRoot, '.opencode')));
  const requested = String(args.ability || 'compile-and-verify-project');
  const ability: VerifyAbility = (VERIFY_ABILITIES as string[]).includes(requested)
    ? (requested as VerifyAbility)
    : 'compile-and-verify-project';

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
