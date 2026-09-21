import { join, resolve } from 'node:path';
import { firstString, parseArgs, parseOptionalPositiveInt, rejectPositionals, resolveAbility } from '../../../shared/cli-args';
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
  const abilitiesRaw = firstString(args, ['abilities', 'plan-abilities', 'planAbilities']);
  const planAbilities = abilitiesRaw
    ? abilitiesRaw.split(',').map((token) => token.trim()).filter((token) => token !== '')
    : undefined;

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
    feature: firstString(args, ['feature', 'slug']),
    context: firstString(args, ['context']),
    design: firstString(args, ['design']),
    testCases: firstString(args, ['test-cases', 'testCases']),
    testingDecisions: firstString(args, ['testing-decisions', 'testingDecisions']),
    testability: firstString(args, ['testability']),
    tradeOffs: firstString(args, ['trade-offs', 'tradeOffs']),
    planAbilities,
    commandsDir: firstString(args, ['commands-dir', 'commandsDir']),
    featuresMap: firstString(args, ['features-map', 'featuresMap', 'map']),
  };
}
