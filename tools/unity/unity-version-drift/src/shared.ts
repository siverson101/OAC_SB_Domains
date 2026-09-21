// Shared helpers for the version-drift Sense ability.
export * from './types';
export { asRecord, str } from '../../../shared/json-helpers';

import { join } from 'node:path';
import { makeEnvelope } from '../../../shared/result-envelope';
import type { VersionDriftAbility, VersionDriftBase, VersionDriftOptions, VersionDriftStatus } from './types';

export const BASELINE_DIR = 'version-baselines';

export const MAX_AGE_HOURS_DEFAULT = 24;

export function baselineDir(options: VersionDriftOptions): string {
  return join(options.opencodeDir, 'project-data', BASELINE_DIR);
}

// A baseline file's path is reported relative to the opencode dir so the report
// reads `version-baselines/<file>` regardless of the install root.
export function baselineRelPath(file: string): string {
  return `${BASELINE_DIR}/${file}`;
}

export function makeResult(
  ability: VersionDriftAbility,
  status: VersionDriftStatus,
  summary: string,
  errors: string[]
): VersionDriftBase {
  // The ability reads on-disk state first; the CLI probe is best-effort, so the
  // route stays `offline` even when the CLI resolves.
  return makeEnvelope({ ability, family: 'sense', mode: 'both', route: 'offline', status, summary, errors });
}
