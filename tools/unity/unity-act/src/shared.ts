// Shared helpers for the Act family.
export * from './types';
export {
  asArray,
  asRecord,
  bool,
  num,
  parseBool,
  str,
  stringArray,
} from '../../../shared/json-helpers';

import { join } from 'node:path';
import { makeEnvelope } from '../../../shared/result-envelope';
import type { Route } from '../../../shared/tool-routing';
import type { ActAbility, ActBase, ActOptions, ActStatus } from './types';

export function projectDataDir(options: ActOptions): string {
  return join(options.opencodeDir, 'project-data');
}

export function makeResult(
  ability: ActAbility,
  status: ActStatus,
  summary: string,
  errors: string[],
  route: Route = 'offline'
): ActBase {
  return {
    ...makeEnvelope({ ability, family: 'act', mode: 'offline', status, summary, errors, route }),
    mutated: false,
    safetyGate: { dryRunFirst: true, requireConfirm: true },
  };
}
