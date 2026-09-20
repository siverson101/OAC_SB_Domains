import { join, resolve } from 'node:path';
import { firstString, parseArgs, rejectPositionals, resolveAbility } from '../../../shared/cli-args';
import { parseOptionalPositiveInt } from './shared';
import { COMPOSE_ABILITIES, type ComposeOptions } from './types';

export function resolveOptions(argv: string[]): ComposeOptions {
  const { values: args, positional } = parseArgs(argv);
  rejectPositionals(positional);
  const projectRoot = resolve(String(args['project-root'] || process.cwd()));
  const opencodeDir = resolve(String(args['opencode-dir'] || join(projectRoot, '.opencode')));
  const requested = String(args.ability || 'coordination-board');
  const ability = resolveAbility(requested, COMPOSE_ABILITIES, 'coordination-board');

  const leaseRaw = args['lease-seconds'] ?? args.leaseSeconds;
  const waitRaw = args['wait-seconds'] ?? args.waitSeconds;

  return {
    projectRoot,
    opencodeDir,
    ability,
    json: Boolean(args.json),
    list: Boolean(args.list),
    verb: firstString(args, ['verb', 'operation']),
    resource: firstString(args, ['resource', 'scope']),
    holder: firstString(args, ['holder', 'agent']),
    note: firstString(args, ['note']),
    leaseSeconds: parseOptionalPositiveInt(leaseRaw),
    waitSeconds: parseOptionalPositiveInt(waitRaw),
    now: firstString(args, ['now']),
    primitivesDir: firstString(args, ['primitives-dir', 'primitivesDir']),
    capabilitiesDir: firstString(args, ['capabilities-dir', 'capabilitiesDir']),
    schema: firstString(args, ['schema']),
    source: firstString(args, ['source']),
    cliCommand: firstString(args, ['unity-cli', 'unityCli']) ?? 'unity',
  };
}
