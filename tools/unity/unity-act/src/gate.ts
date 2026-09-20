// Act gate planning (ADR-0015).
//
// Every mutating Act ability runs checkpoint -> mutate -> validate -> delta with
// named gates and strictest-wins. Actually running the gate needs a live Editor,
// so this module is opt-in and fail-soft: without the Unity CLI it reports
// `unavailable` rather than throwing or invoking bare `unity mcp`.
import { findExecutable } from '../../../shared/toolchain';

export type GateStatus = 'not_run' | 'planned' | 'unavailable';

export interface GatePlan {
  status: GateStatus;
  requiresEditor: boolean;
  cliAvailable: boolean | null;
  reviewIntensity: 'full' | 'lean' | 'solo';
  checkpoint: string[];
  mutate: string[];
  validate: string[];
  delta: string[];
  gates: string[];
  commands: string[];
  errors: string[];
}

const CHECKPOINT = [
  'Record the target asset hash before the edit (checkpoint).',
  'Confirm a change scope: the exact files and properties that may change.',
];

const MUTATE = [
  'Apply the approved ops (dry run first, then the confirmed write).',
];

const VALIDATE = [
  'Force a compile and read compile-state (ScriptAssemblies mtimes + Editor.log).',
  'Run EditMode tests, then PlayMode tests when the change touches runtime code.',
  'For scene/asset edits, re-read the hierarchy and confirm the delta.',
];

const DELTA = [
  'Report newIssues and resolvedIssues; `null` means no delta was computed, not clean.',
  'Flag validate_scan_failed and compilePending honestly.',
];

const GATES = ['compile', 'EditMode', 'PlayMode', 'scene/asset', 'build', 'performance'];

export function planActGate(gate: boolean, cliAvailable: boolean | null): GatePlan {
  if (!gate) {
    return {
      status: 'not_run',
      requiresEditor: false,
      cliAvailable,
      reviewIntensity: 'full',
      checkpoint: [],
      mutate: [],
      validate: [],
      delta: [],
      gates: [],
      commands: [],
      errors: [],
    };
  }

  if (cliAvailable !== true) {
    return {
      status: 'unavailable',
      requiresEditor: true,
      cliAvailable,
      reviewIntensity: 'full',
      checkpoint: CHECKPOINT,
      mutate: MUTATE,
      validate: VALIDATE,
      delta: DELTA,
      gates: GATES,
      commands: [],
      errors: ['No Unity CLI available; the Act gate is opt-in and needs a live Editor.'],
    };
  }

  return {
    status: 'planned',
    requiresEditor: true,
    cliAvailable,
    reviewIntensity: 'full',
    checkpoint: CHECKPOINT,
    mutate: MUTATE,
    validate: VALIDATE,
    delta: DELTA,
    gates: GATES,
    commands: [
      'unity command compile --json --no-banner --quiet --non-interactive',
      'unity command run_tests --mode editor --json --no-banner --quiet --non-interactive',
      'unity command run_tests --mode playmode --json --no-banner --quiet --non-interactive',
    ],
    errors: [],
  };
}

export function detectUnityCli(): boolean {
  return findExecutable('unity') !== null;
}
