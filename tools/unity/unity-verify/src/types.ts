// Shared types for the Verify family (Phase 2 Step 2.5, ADR-0015).
//
// Every Verify ability implements the checkpoint -> mutate -> validate -> delta
// model. The honesty rules are encoded in `VerifyDelta`:
//   - `newIssues`/`resolvedIssues` are `null` when no delta was computed (NOT
//     "clean"); an empty array is a genuine clean delta.
//   - `validateScanFailed` records that the post-mutation scan could not run.
//   - `compilePending` records that the incremental compiler may not have
//     produced fresh assemblies (a silent no-op recompile).
import type { Route } from '../../../shared/tool-routing';
import type { TestCounts } from '../../gather-unity-context/src/gate';

const VERIFY_ABILITY_NAMES = [
  'compile-and-verify-project',
  'run-edit-mode-tests',
  'run-play-mode-tests',
  'gate-review',
  'failing-test-first',
  'test-deduplication',
] as const;

export type VerifyAbility = (typeof VERIFY_ABILITY_NAMES)[number];

export const VERIFY_ABILITIES: VerifyAbility[] = [...VERIFY_ABILITY_NAMES];

export type VerifyMode = 'offline' | 'live' | 'both';

// `both` = an offline checkpoint/scan plus a live (or batch) test run when an
// Editor is reachable. `gate-review` folds on-disk gate state only.
export const VERIFY_MODES: Record<VerifyAbility, VerifyMode> = {
  'compile-and-verify-project': 'both',
  'run-edit-mode-tests': 'both',
  'run-play-mode-tests': 'both',
  'gate-review': 'offline',
  'failing-test-first': 'both',
  'test-deduplication': 'offline',
};

export type VerifyStatus =
  | 'verified'
  | 'regressed'
  | 'observed_locally'
  | 'passed'
  | 'failed'
  | 'warning'
  | 'refused'
  | 'unavailable'
  | 'unknown'
  | 'not_run';

export type VerifyPhase = 'checkpoint' | 'validate';

export type ReviewIntensity = 'full' | 'lean' | 'solo';

export interface VerifySafetyGate {
  mutates: boolean;
  requiresEditor: boolean;
  dryRunFirst?: boolean;
  writesState?: boolean;
}

export interface VerifyBase {
  schemaVersion: number;
  generatedAt: string;
  ability: VerifyAbility;
  family: 'verify';
  mode: VerifyMode;
  route: Route;
  status: VerifyStatus;
  summary: string;
  errors: string[];
  safetyGate: VerifySafetyGate;
  // The declared change scope (comma-separated files/symbols) for a mutation
  // validation, or `null` when none was declared. `compile-and-verify-project
  // --phase validate` refuses without one; the declared scope bounds the
  // reported delta (see `VerifyDelta`).
  changeScope: string[] | null;
  checkpoint: VerifySnapshot | null;
  delta: VerifyDelta;
}

export interface VerifyOptions {
  projectRoot: string;
  opencodeDir: string;
  ability: VerifyAbility;
  json: boolean;
  list: boolean;
  phase: VerifyPhase;
  cliCommand: string;
  reviewIntensity: ReviewIntensity;
  changeScope?: string[];
  gatesJson?: string;
  test?: string;
  expectedReason?: string;
  failureMessage?: string;
  testResults?: string;
  tdd?: string;
  feature?: string;
  testsDir?: string;
  testsJson?: string;
  apply?: boolean;
}

export type IssueKind = 'compile' | 'editMode' | 'playMode';

export interface VerifyIssue {
  kind: IssueKind;
  id: string;
  message: string;
}

export interface VerifyCompile {
  status: string | null;
  stale: boolean | null;
  noOpRecompile: boolean | null;
  assemblyCount: number | null;
  newestAssemblyMtimeUtc: string | null;
  newestScriptMtimeUtc: string | null;
}

export interface VerifyTests {
  editMode: TestCounts | null;
  playMode: TestCounts | null;
}

export interface VerifySnapshot {
  capturedAt: string;
  compile: VerifyCompile;
  issues: VerifyIssue[];
  tests: VerifyTests;
  gateResult: string | null;
}

// The bounded delta. When a change scope is declared, only issues that match a
// scope token count as new/resolved: an out-of-scope issue never appears in
// `newIssues`/`resolvedIssues`, so a mutation cannot claim a verdict for
// changes outside the declared scope. `computed: false` with `null` issue
// arrays still means "not computed", never "clean".
export interface VerifyDelta {
  computed: boolean;
  newIssues: VerifyIssue[] | null;
  resolvedIssues: VerifyIssue[] | null;
  validateScanFailed: boolean;
  compilePending: boolean;
  reasons: string[];
}

export interface SnapshotOverrides {
  capturedAt?: string;
  compile?: Partial<VerifyCompile>;
  issues?: VerifyIssue[];
  tests?: Partial<VerifyTests>;
  gateResult?: string | null;
}

export type Json = Record<string, unknown>;
