import { join, resolve } from 'node:path';
import { firstString, parseArgs, resolveAbility } from '../../../shared/cli-args';
import { parsePositiveInt } from './shared';
import { COMPOSE_ABILITIES, type ComposeOptions } from './types';

export function resolveOptions(argv: string[]): ComposeOptions {
  const { values: args } = parseArgs(argv);
  const projectRoot = resolve(String(args['project-root'] || process.cwd()));
  const opencodeDir = resolve(String(args['opencode-dir'] || join(projectRoot, '.opencode')));
  const requested = String(args.ability || 'coordination-board');
  const ability = resolveAbility(requested, COMPOSE_ABILITIES, 'coordination-board');

  const leaseRaw = args['lease-seconds'] ?? args.leaseSeconds;
  const leaseSeconds = leaseRaw === undefined ? undefined : parsePositiveInt(leaseRaw, 0);
  const waitRaw = args['wait-seconds'] ?? args.waitSeconds;
  const waitSeconds = waitRaw === undefined ? undefined : parsePositiveInt(waitRaw, 0);

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
    leaseSeconds: leaseSeconds || undefined,
    waitSeconds: waitSeconds || undefined,
    now: firstString(args, ['now']),
    primitivesDir: firstString(args, ['primitives-dir', 'primitivesDir']),
    capabilitiesDir: firstString(args, ['capabilities-dir', 'capabilitiesDir']),
    schema: firstString(args, ['schema']),
    source: firstString(args, ['source']),
    cliCommand: firstString(args, ['unity-cli', 'unityCli']) ?? 'unity',
  };
}
