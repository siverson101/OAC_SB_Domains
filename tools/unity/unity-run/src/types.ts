// Shared types for the Run family (Phase 2 Step 2.6, ADR-0015/0018).
//
// Run is the only family that reaches the *running* Player/Editor. It has two
// shapes:
//   - `unity-change-loop` folds on-disk evidence (compile-state, log-digest,
//     test results, screenshot) into a gated verdict and refuses "done" without
//     green tests.
//   - the runtime abilities (debugging, UI validation, profiling, UI Toolkit)
//     speak to the live Editor through the Unity CLI channel and fail soft to
//     `unavailable` when no channel/Editor is present.
import type { LiveEditorChannel, LiveTransport, Route } from '../../../shared/tool-routing';

const RUN_ABILITY_NAMES = [
  'unity-change-loop',
  'runtime-debugging',
  'runtime-ui-validation',
  'performance-diagnostics',
  'uitk-interaction',
] as const;

export type RunAbility = (typeof RUN_ABILITY_NAMES)[number];

export const RUN_ABILITIES: RunAbility[] = [...RUN_ABILITY_NAMES];

export type RuntimeAbility = Exclude<RunAbility, 'unity-change-loop'>;

export const RUNTIME_ABILITIES: RuntimeAbility[] = [
  'runtime-debugging',
  'runtime-ui-validation',
  'performance-diagnostics',
  'uitk-interaction',
];

export type RunMode = 'offline' | 'live' | 'both';

// The change loop folds offline evidence and can cite live evidence when the
// Editor is reachable (`both`). Every runtime ability needs the live channel.
export const RUN_MODES: Record<RunAbility, RunMode> = {
  'unity-change-loop': 'both',
  'runtime-debugging': 'live',
  'runtime-ui-validation': 'live',
  'performance-diagnostics': 'live',
  'uitk-interaction': 'live',
};

export type RunStatus =
  | 'done'
  | 'in_progress'
  | 'refused'
  | 'unavailable'
  | 'observed_locally'
  | 'unknown'
  | 'not_run';

export interface RunSafetyGate {
  requiresEditor: boolean;
  requiresApproval: boolean;
  approved: boolean;
}

export interface RunBase {
  schemaVersion: number;
  generatedAt: string;
  ability: RunAbility;
  family: 'run';
  mode: RunMode;
  route: Route;
  status: RunStatus;
  summary: string;
  errors: string[];
  safetyGate: RunSafetyGate;
}

// A single live invocation against the running Editor/Player. The concrete
// `cli`/`mcp` transports land later; this is the seam they implement.
export interface RuntimeRequest {
  operation: string;
  args: string[];
}

export interface RuntimeResponse {
  ok: boolean;
  data: Json | null;
  errors: string[];
  raw?: string;
}

export interface RuntimeChannel extends LiveEditorChannel {
  invoke?: (request: RuntimeRequest) => RuntimeResponse;
}

export interface RunOptions {
  projectRoot: string;
  opencodeDir: string;
  ability: RunAbility;
  json: boolean;
  list: boolean;
  claim?: string;
  scope?: string;
  operation?: string;
  code?: string;
  approveCodeExecution: boolean;
  live?: RuntimeChannel | null;
  cliCommand: string;
}

export interface ApprovalDecision {
  required: boolean;
  approved: boolean;
  allowed: boolean;
  reason: string;
}

export interface RuntimeResult extends RunBase {
  operation: string;
  transport: LiveTransport | null;
  command: string[];
  data: Json | null;
  approval: ApprovalDecision | null;
}

export type Json = Record<string, unknown>;
