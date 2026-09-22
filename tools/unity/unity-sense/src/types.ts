// Shared types for the offline Sense family (Phase 2 Step 2.3).
//
// Every ability is `family: sense`, `mode: offline`: it reads on-disk state only
// and never needs a running Editor. Results are fail-soft — a missing file or
// folder yields `unavailable`/`unknown`, never a thrown error.
import type { Route } from '../../../shared/tool-routing';

const SENSE_ABILITY_NAMES = [
  'project-status',
  'asset-intelligence',
  'offline-project-inspection',
  'unity-api-lookup',
  'platform-info',
  'code-navigation',
  'version-matrix',
] as const;

export type SenseAbility = (typeof SENSE_ABILITY_NAMES)[number];

export const SENSE_ABILITIES: SenseAbility[] = [...SENSE_ABILITY_NAMES];

export type SenseStatus = 'observed_locally' | 'available_but_unverified' | 'unavailable' | 'unknown';

export interface SenseBase {
  schemaVersion: number;
  generatedAt: string;
  ability: SenseAbility;
  family: 'sense';
  mode: 'offline';
  route: Route;
  status: SenseStatus;
  summary: string;
  errors: string[];
}

export interface SenseOptions {
  projectRoot: string;
  opencodeDir: string;
  ability: SenseAbility;
  query?: string;
  json: boolean;
  list: boolean;
  tableDir?: string;
  assetFolder?: string;
  commandDir?: string;
}

export type Json = Record<string, unknown>;
