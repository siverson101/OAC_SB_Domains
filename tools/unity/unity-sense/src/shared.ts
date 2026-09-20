// Shared helpers for the offline Sense family.
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
import type { SenseAbility, SenseBase, SenseOptions, SenseStatus } from './types';

export function projectDataDir(options: SenseOptions): string {
  return join(options.opencodeDir, 'project-data');
}

export function makeResult(
  ability: SenseAbility,
  status: SenseStatus,
  summary: string,
  errors: string[]
): SenseBase {
  // `makeEnvelope` defaults the route to 'offline'; no override is needed.
  return makeEnvelope({ ability, family: 'sense', mode: 'offline', status, summary, errors });
}
