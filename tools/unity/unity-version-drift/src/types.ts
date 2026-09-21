// Shared types for the version-drift Sense ability (tickets 01–03).
//
// The ability is offline-first (`family: sense`, `mode: both`): the Editor and
// package baselines are read from disk, and the Unity CLI probe is best-effort.
// A missing CLI reports `unavailable` rather than throwing, and the only files
// ever written are the baseline files under `version-baselines/`.
import type { Route } from '../../../shared/tool-routing';

const VERSION_DRIFT_ABILITY_NAMES = ['version-drift'] as const;

export type VersionDriftAbility = (typeof VERSION_DRIFT_ABILITY_NAMES)[number];

export const VERSION_DRIFT_ABILITIES: VersionDriftAbility[] = [...VERSION_DRIFT_ABILITY_NAMES];

export type VersionDriftStatus = 'observed_locally' | 'unavailable' | 'unknown' | 'skipped';

// Per-category outcome. `not_checked` means the cadence skipped the run, so the
// category was never read (distinct from `unavailable`, which is a real read).
export type VersionDriftChange =
  | 'unchanged'
  | 'changed'
  | 'baseline_created'
  | 'unavailable'
  | 'unknown'
  | 'not_checked';

export interface VersionDriftBase {
  schemaVersion: number;
  generatedAt: string;
  ability: VersionDriftAbility;
  family: 'sense';
  mode: 'both';
  route: Route;
  status: VersionDriftStatus;
  summary: string;
  errors: string[];
}

export interface CliVersionProbe {
  available: boolean;
  version: string | null;
}

// The CLI probe is a seam: the default implementation shells out to `unity`,
// and tests inject a fake so no wall-clock/process is involved.
export interface CliProbe {
  version: (command: string) => CliVersionProbe;
  commands: (command: string) => string[] | null;
}

export interface VersionDriftOptions {
  projectRoot: string;
  opencodeDir: string;
  ability: VersionDriftAbility;
  json: boolean;
  list: boolean;
  ifDue: boolean;
  maxAgeHours: number;
  // Injected "now" (ISO-8601) so cadence tests never read the wall-clock.
  now: string;
  cliCommand: string;
  cliProbe?: CliProbe;
}
