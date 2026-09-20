// Shared types for the Act family (Phase 2 Step 2.4).
//
// Every Act ability mutates something — a scene, a prefab, or files on disk — so
// each result carries an explicit `mutated` flag and a `safetyGate` record.
// Mutating paths default to a dry run and refuse to write without `--confirm`
// (ADR-0015, ADR-0018).
import type { Route } from '../../../shared/tool-routing';

export type ActAbility =
  | 'scene-editing'
  | 'prefab-automation'
  | 'script-scaffolding'
  | 'shader-helper'
  | 'pattern-library'
  | 'input-automation';

export const ACT_ABILITIES: ActAbility[] = [
  'scene-editing',
  'prefab-automation',
  'script-scaffolding',
  'shader-helper',
  'pattern-library',
  'input-automation',
];

export type ActMode = 'offline' | 'both' | 'live';

// `both` = an offline proposal/decision plus a live apply through the Unity CLI.
// `offline`/`local` abilities never need a running Editor.
export const ACT_MODES: Record<ActAbility, ActMode> = {
  'scene-editing': 'both',
  'prefab-automation': 'both',
  'script-scaffolding': 'offline',
  'shader-helper': 'offline',
  'pattern-library': 'offline',
  'input-automation': 'offline',
};

export type ActStatus =
  | 'proposed'
  | 'ready'
  | 'written'
  | 'observed_locally'
  | 'refused'
  | 'unavailable'
  | 'unknown'
  | 'not_run';

export interface ActSafetyGate {
  dryRunFirst: boolean;
  requireConfirm: boolean;
}

export interface ActBase {
  schemaVersion: number;
  generatedAt: string;
  ability: ActAbility;
  family: 'act';
  mode: ActMode;
  route: Route;
  status: ActStatus;
  summary: string;
  errors: string[];
  mutated: boolean;
  safetyGate: ActSafetyGate;
}

export interface ActOptions {
  projectRoot: string;
  opencodeDir: string;
  ability: ActAbility;
  json: boolean;
  list: boolean;
  dryRun: boolean;
  confirm: boolean;
  gate: boolean;
  query?: string;
  category?: string;
  pattern?: string;
  enabled?: string[];
  changeKind?: string;
  prefab?: string;
  opsFile?: string;
  opsJson?: string;
  template?: string;
  name?: string;
  namespace?: string;
  map?: string;
  out?: string;
  patternsFile?: string;
}

export type Json = Record<string, unknown>;
