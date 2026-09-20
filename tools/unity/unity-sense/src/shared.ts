// Shared helpers for the offline Sense family.
export * from './types';

import { join } from 'node:path';
import { nowIso } from '../../../shared/io';
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
  return {
    schemaVersion: 1,
    generatedAt: nowIso(),
    ability,
    family: 'sense',
    mode: 'offline',
    route: 'offline',
    status,
    summary,
    errors,
  };
}
