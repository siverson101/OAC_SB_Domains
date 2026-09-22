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
import type { CommandResult } from '../../../shared/toolchain';
import type { LiveEditorChannel, LiveTransport, Route } from '../../../shared/tool-routing';

// `unity-change-loop` is deliberately the same string in three namespaces: this
// Run ability, the recipe `xdomains/game-dev/unity-3d/recipes/unity-change-loop.json`,
// and the lifecycle-catalog `change-loop` step command. Registry `workflow-*`
// edges name the *recipe* id as `from`.
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

// The change loop folds on-disk evidence only; its live observation stage is a
// Phase 6 TODO, so it is honestly `offline` until the transport lands. Every
// runtime ability needs the live channel.
export const RUN_MODES: Record<RunAbility, RunMode> = {
  'unity-change-loop': 'offline',
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
  | 'failed'
  | 'observed_locally'
  | 'unknown'
  | 'not_run';

export interface RunSafetyGate {
  requiresEditor: boolean;
  requiresApproval: boolean;
  approved: boolean;
}

// The declared gate per ability, mirroring each `command/<ability>.md`
// frontmatter. `requiresApproval` is the ability's worst case: `runtime-debugging`
// can execute arbitrary Player code (the only approval-gated operation), so it
// declares `true`; the other runtime abilities never require approval. The
// runtime envelope reports the gate of the *invoked* operation, which is
// therefore always within (a subset of) this declaration — pinned by
// tests/unity-run.test.ts. `unity-change-loop` is a Run ability too; a command
// that composes it (e.g. `unity-implement`) may declare a *stricter* gate, but
// never a weaker one — also pinned by tests/unity-run.test.ts.
export interface DeclaredRunSafetyGate {
  requiresEditor: boolean;
  requiresApproval: boolean;
}

export const RUN_SAFETY_GATES: Record<RunAbility, DeclaredRunSafetyGate> = {
  'unity-change-loop': { requiresEditor: false, requiresApproval: false },
  'runtime-debugging': { requiresEditor: true, requiresApproval: true },
  'runtime-ui-validation': { requiresEditor: true, requiresApproval: false },
  'performance-diagnostics': { requiresEditor: true, requiresApproval: false },
  'uitk-interaction': { requiresEditor: true, requiresApproval: false },
};

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

// A single live invocation against the running Editor/Player. The `cli`
// transport implements this seam; the stdio-MCP transport may land later.
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
  // Transports may resolve synchronously (an in-process seam) or asynchronously
  // (a subprocess/CLI/MCP transport), so the caller always `await`s the result.
  invoke?: (request: RuntimeRequest) => RuntimeResponse | Promise<RuntimeResponse>;
}

// The CLI transport shells out to the Unity CLI; the runner is injected so the
// transport is unit-testable without a live Editor or Player.
export type CliRunner = (
  command: string,
  args: string[],
  options?: { cwd?: string; timeout?: number }
) => CommandResult;

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
  cliRunner?: CliRunner;
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
  // Only present when the result is actually actionable (observed on the live
  // channel). A refused/unavailable result carries no runnable command.
  command?: string[];
  data: Json | null;
  approval: ApprovalDecision | null;
}

export type Json = Record<string, unknown>;
