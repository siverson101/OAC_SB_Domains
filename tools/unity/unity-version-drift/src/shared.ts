// Shared helpers for the version-drift Sense ability.
export * from './types';
export { asRecord, str } from '../../../shared/json-helpers';

import { join } from 'node:path';
import { makeEnvelope } from '../../../shared/result-envelope';
import type { Route } from '../../../shared/tool-routing';
import type {
  VersionDriftAbility,
  VersionDriftBase,
  VersionDriftOptions,
  VersionDriftSafetyGate,
  VersionDriftStatus,
} from './types';

export const BASELINE_DIR = 'version-baselines';

export const MAX_AGE_HOURS_DEFAULT = 24;

export const EDITOR_BASELINE = 'unity-editor-version.txt';
export const PACKAGE_BASELINE = 'package-versions.json';
export const CLI_VERSION_BASELINE = 'unity-cli-version.txt';
export const CLI_COMMANDS_BASELINE = 'unity-cli-commands.json';
export const LAST_RUN = 'last-run.json';

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
  errors: string[],
  route: Route = 'offline'
): VersionDriftBase {
  // The Editor/package reads are on-disk; the route reports `batch` only when the
  // best-effort Unity CLI probe actually answered.
  return {
    ...makeEnvelope({ ability, family: 'sense', mode: 'both', route, status, summary, errors }),
    safetyGate: { ...VERSION_DRIFT_SAFETY_GATE },
  };
}

// Mirrors the command frontmatter `safetyGate`; `tests/version-drift.test.ts`
// asserts the runtime value equals the declaration.
export const VERSION_DRIFT_SAFETY_GATE: VersionDriftSafetyGate = {
  mutates: false,
  requiresEditor: false,
  requiresApproval: false,
  writesState: true,
};
