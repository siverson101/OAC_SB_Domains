// Shared types for the Compose family (Phase 2 Step 2.7, ADR-0011/0012).
//
// Compose is the family that reasons *about* the other four: it keeps the
// advisory coordination board (claims + leases + a one-holder Editor hold),
// reports primitive composition, validates capability contracts, and records a
// CI status baseline. Every ability is offline-first and fail-soft: it reads and
// writes plain files under `.opencode/` and never needs the Editor.
import type { Route } from '../../../shared/tool-routing';

const COMPOSE_ABILITY_NAMES = [
  'coordination-board',
  'primitive-composition',
  'contract-aware-design',
  'ci-status-baseline',
] as const;

export type ComposeAbility = (typeof COMPOSE_ABILITY_NAMES)[number];

export const COMPOSE_ABILITIES: ComposeAbility[] = [...COMPOSE_ABILITY_NAMES];

export type ComposeMode = 'offline' | 'live' | 'both';

// All four abilities are offline-first. The CI baseline can additionally be
// recorded from a live CI run, hence `both`.
export const COMPOSE_MODES: Record<ComposeAbility, ComposeMode> = {
  'coordination-board': 'offline',
  'primitive-composition': 'offline',
  'contract-aware-design': 'offline',
  'ci-status-baseline': 'both',
};

export type ComposeStatus =
  | 'ok'
  | 'conflict'
  | 'not_found'
  | 'unavailable'
  | 'recorded'
  | 'observed_locally'
  | 'refused'
  | 'unknown';

export interface ComposeSafetyGate {
  requiresEditor: boolean;
  requiresApproval: boolean;
  approved: boolean;
}

export interface ComposeBase {
  schemaVersion: number;
  generatedAt: string;
  ability: ComposeAbility;
  family: 'compose';
  mode: ComposeMode;
  route: Route;
  status: ComposeStatus;
  summary: string;
  errors: string[];
  safetyGate: ComposeSafetyGate;
}

export type Json = Record<string, unknown>;

export interface ComposeOptions {
  projectRoot: string;
  opencodeDir: string;
  ability: ComposeAbility;
  json: boolean;
  list: boolean;
  verb?: string;
  resource?: string;
  holder?: string;
  note?: string;
  leaseSeconds?: number;
  waitSeconds?: number;
  now?: string;
  primitivesDir?: string;
  capabilitiesDir?: string;
  schema?: string;
  source?: string;
  cliCommand: string;
}
