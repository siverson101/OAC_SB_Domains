// Shared types for the offline Sense family (Phase 2 Step 2.3).
//
// Every ability is `family: sense`, `mode: offline`: it reads on-disk state only
// and never needs a running Editor. Results are fail-soft — a missing file or
// folder yields `unavailable`/`unknown`, never a thrown error.

export type SenseAbility =
  | 'project-status'
  | 'asset-intelligence'
  | 'offline-project-inspection'
  | 'unity-api-lookup'
  | 'platform-info'
  | 'code-navigation';

export const SENSE_ABILITIES: SenseAbility[] = [
  'project-status',
  'asset-intelligence',
  'offline-project-inspection',
  'unity-api-lookup',
  'platform-info',
  'code-navigation',
];

export type SenseStatus = 'observed_locally' | 'available_but_unverified' | 'unavailable' | 'unknown';

export interface SenseBase {
  schemaVersion: number;
  generatedAt: string;
  ability: SenseAbility;
  family: 'sense';
  mode: 'offline';
  route: 'offline';
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
}

export type Json = Record<string, unknown>;

export function asRecord(value: unknown): Json | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : null;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function str(obj: Json | null, key: string): string | null {
  const value = obj?.[key];
  return typeof value === 'string' ? value : null;
}

export function num(obj: Json | null, key: string): number | null {
  const value = obj?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function bool(obj: Json | null, key: string): boolean | null {
  const value = obj?.[key];
  return typeof value === 'boolean' ? value : null;
}

export function stringArray(obj: Json | null, key: string): string[] {
  const value = obj?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
