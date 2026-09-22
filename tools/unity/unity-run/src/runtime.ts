// The runtime abilities — debugging, UI validation, profiling, UI Toolkit.
//
// Each one reaches the *running* Editor/Player through the live Unity CLI
// channel (`unity command` / `unity eval`, ADR-0017). The `RuntimeChannel` seam
// is strictly fail-soft: no channel or a channel that reports unavailable
// resolves to `unavailable`, a channel that answers with an error or throws
// resolves to `failed` (preserving any partial payload), and nothing is ever a
// thrown error.
import { findExecutable, run, stripAnsi, type CommandResult } from '../../../shared/toolchain';
import { findLiveInstance } from '../../gather-unity-context/src/editor';
import { checkCodeExecutionApproval } from './approval';
import { makeResult } from './shared';
import {
  RUN_MODES,
  RUN_SAFETY_GATES,
  RUNTIME_ABILITIES,
  type ApprovalDecision,
  type CliRunner,
  type Json,
  type RunOptions,
  type RuntimeAbility,
  type RuntimeChannel,
  type RuntimeRequest,
  type RuntimeResponse,
  type RuntimeResult,
} from './types';

export interface RuntimeOperationSpec {
  operation: string;
  args: string[];
  // Executing arbitrary Player code is the only operation that is both routed
  // through `unity eval` and gated behind explicit approval; the two facts are
  // deliberately one flag so they cannot drift.
  codeExecution: boolean;
}

const OPERATION_SPECS: Record<string, RuntimeOperationSpec> = {
  get_logs: { operation: 'get_logs', args: ['--logType', 'Error'], codeExecution: false },
  'execute-code': { operation: 'execute-code', args: [], codeExecution: true },
  ui_snapshot: { operation: 'ui_snapshot', args: [], codeExecution: false },
  ui_find: { operation: 'ui_find', args: [], codeExecution: false },
  ui_click: { operation: 'ui_click', args: [], codeExecution: false },
  ui_key: { operation: 'ui_key', args: [], codeExecution: false },
  profiler_counters: { operation: 'profiler_counters', args: [], codeExecution: false },
  profiler_snapshot: { operation: 'profiler_snapshot', args: [], codeExecution: false },
  uitk_tree: { operation: 'uitk_tree', args: [], codeExecution: false },
  uitk_click: { operation: 'uitk_click', args: [], codeExecution: false },
};

// The operations each runtime ability may invoke.
export const ABILITY_OPERATIONS: Record<RuntimeAbility, string[]> = {
  'runtime-debugging': ['get_logs', 'execute-code'],
  'runtime-ui-validation': ['ui_snapshot', 'ui_find', 'ui_click', 'ui_key'],
  'performance-diagnostics': ['profiler_counters', 'profiler_snapshot'],
  'uitk-interaction': ['uitk_tree', 'uitk_click'],
};

export const DEFAULT_OPERATION: Record<RuntimeAbility, string> = {
  'runtime-debugging': 'get_logs',
  'runtime-ui-validation': 'ui_snapshot',
  'performance-diagnostics': 'profiler_counters',
  'uitk-interaction': 'uitk_tree',
};

export function isRuntimeAbility(ability: string): ability is RuntimeAbility {
  return (RUNTIME_ABILITIES as string[]).includes(ability);
}

export interface ResolvedOperation {
  spec: RuntimeOperationSpec;
  errors: string[];
}

export function resolveOperation(ability: RuntimeAbility, requested?: string): ResolvedOperation {
  const allowed = ABILITY_OPERATIONS[ability];
  const errors: string[] = [];
  let operation = DEFAULT_OPERATION[ability];
  if (requested && requested.trim() !== '') {
    if (allowed.includes(requested)) {
      operation = requested;
    } else {
      errors.push(`unknown --operation "${requested}" for ${ability}; defaulted to ${operation}`);
    }
  }
  return { spec: OPERATION_SPECS[operation], errors };
}

function buildCommand(options: RunOptions, spec: RuntimeOperationSpec): string[] {
  const head = spec.codeExecution ? ['eval', options.code ?? ''] : ['command', spec.operation];
  return [
    ...head,
    ...spec.args,
    '--json',
    '--no-banner',
    '--quiet',
    '--non-interactive',
    '--project-path',
    options.projectRoot,
  ];
}

function channelAvailable(channel: RuntimeChannel | null): boolean {
  if (!channel) return false;
  try {
    return channel.available() === true;
  } catch {
    return false;
  }
}

const CLI_TIMEOUT_MS = 30000;

interface CliEnvelope {
  success?: boolean;
  data?: unknown;
  errors?: { message?: string }[];
}

function parseEnvelope(stdout: string): CliEnvelope | null {
  try {
    const parsed = JSON.parse(stdout) as CliEnvelope;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function envelopeErrors(envelope: CliEnvelope): string[] {
  const errors = Array.isArray(envelope.errors) ? envelope.errors : [];
  return errors.map((entry) => (entry && typeof entry.message === 'string' ? entry.message : 'unity CLI error'));
}

export interface CliChannelOptions {
  // Injectable availability probe; defaults to CLI presence. `resolveRuntimeChannel`
  // passes a probe that also reflects the live Editor it already found.
  available?: () => boolean;
}

// The concrete CLI transport: `unity command <op> ...` for runtime handlers and
// `unity eval <code> ...` for code execution (ADR-0017 — never bare `unity mcp`).
// The runner is injected so the envelope parsing is testable without a live
// Editor; every failure mode resolves to an `ok: false` response, never a throw.
// `available` reflects CLI presence by default, so the transport is not a
// placeholder that claims to be usable when the Unity CLI is absent.
export function createCliChannel(
  cliCommand: string,
  runner: CliRunner = run,
  options: CliChannelOptions = {}
): RuntimeChannel {
  return {
    transport: 'cli',
    available: options.available ?? (() => findExecutable(cliCommand) !== null),
    invoke: async (request: RuntimeRequest): Promise<RuntimeResponse> => {
      let result: CommandResult;
      try {
        result = runner(cliCommand, request.args, { timeout: CLI_TIMEOUT_MS });
      } catch (err) {
        return { ok: false, data: null, errors: [`unity CLI invocation threw: ${errorMessage(err)}`] };
      }
      const raw = stripAnsi(result.stdout || result.stderr);
      const envelope = parseEnvelope(result.stdout);
      if (!envelope) {
        return { ok: false, data: null, errors: [`malformed unity CLI output: ${raw || `exit ${result.status}`}`], raw };
      }
      const errors = envelopeErrors(envelope);
      const ok = envelope.success === true && result.ok;
      if (!ok && errors.length === 0) errors.push(raw || `unity CLI exited ${result.status}`);
      return {
        ok,
        data: (envelope.data as Json | null) ?? null,
        errors: ok ? [] : errors,
        raw,
      };
    },
  };
}

// Probe for a live channel: an explicitly injected channel wins (including an
// explicit `null`); otherwise the Unity CLI must exist and report a live
// instance for this project, in which case the concrete CLI transport is wired.
// No custom bridge is built — this is the CLI seam.
export function resolveRuntimeChannel(options: RunOptions): RuntimeChannel | null {
  if (options.live !== undefined) return options.live;
  if (!findExecutable(options.cliCommand)) return null;
  const instance = findLiveInstance(options.projectRoot, options.cliCommand);
  if (!instance) return null;
  // Presence (CLI + live Editor for this project) was verified above, so the
  // probe reflects the resolved instance rather than re-probing on each call.
  return createCliChannel(options.cliCommand, options.cliRunner ?? run, { available: () => instance !== null });
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function runRuntimeAbility(options: RunOptions): Promise<RuntimeResult> {
  const ability = options.ability as RuntimeAbility;
  const { spec, errors } = resolveOperation(ability, options.operation);

  const base = makeResult(ability, 'unavailable', `${spec.operation} unavailable`, [], {
    route: 'offline',
    requiresEditor: RUN_SAFETY_GATES[ability].requiresEditor,
    requiresApproval: spec.codeExecution,
    approved: spec.codeExecution && options.approveCodeExecution,
  });
  base.mode = RUN_MODES[ability];

  if (spec.codeExecution && (options.code ?? '').trim() === '') {
    const reason = 'execute-code requires --code <csharp>';
    return {
      ...base,
      status: 'refused',
      summary: reason,
      errors: [...errors, reason],
      operation: spec.operation,
      transport: null,
      data: null,
      approval: null,
    };
  }

  let approval: ApprovalDecision | null = null;
  if (spec.codeExecution) {
    approval = checkCodeExecutionApproval(options);
    if (!approval.allowed) {
      return {
        ...base,
        status: 'refused',
        summary: approval.reason,
        errors: [...errors, approval.reason],
        operation: spec.operation,
        transport: null,
        data: null,
        approval,
      };
    }
  }

  const channel = resolveRuntimeChannel(options);
  const transport = channel?.transport ?? null;

  if (!channelAvailable(channel)) {
    const reason = `no live channel/Editor for ${ability}; ${spec.operation} unavailable`;
    return {
      ...base,
      status: 'unavailable',
      summary: reason,
      errors: [...errors, reason],
      route: 'offline',
      operation: spec.operation,
      transport,
      data: null,
      approval,
    };
  }

  if (!channel?.invoke) {
    const reason = `live ${channel?.transport} channel present but no transport wired for ${spec.operation}`;
    return {
      ...base,
      status: 'unavailable',
      summary: reason,
      errors: [...errors, reason],
      route: 'live',
      operation: spec.operation,
      transport,
      data: null,
      approval,
    };
  }

  try {
    // Build the command only on the path that can actually invoke the channel;
    // a refused/unavailable ability never constructs one (no dead empty-code arg).
    const command = buildCommand(options, spec);
    const response = await channel.invoke({ operation: spec.operation, args: command });
    if (!response.ok) {
      // A channel that answered with an error is distinct from "no channel":
      // report `failed` and preserve any partial payload the channel returned.
      const reason = `${spec.operation} failed on the live ${transport ?? 'runtime'} channel`;
      return {
        ...base,
        status: 'failed',
        summary: reason,
        errors: [...errors, ...response.errors],
        route: 'live',
        operation: spec.operation,
        transport,
        data: response.data ?? null,
        approval,
      };
    }
    return {
      ...base,
      status: 'observed_locally',
      summary: `${spec.operation} observed on the live channel`,
      errors,
      route: 'live',
      operation: spec.operation,
      transport,
      command,
      data: response.data,
      approval,
    };
  } catch (err) {
    const reason = `live channel threw for ${spec.operation}: ${errorMessage(err)}`;
    return {
      ...base,
      status: 'failed',
      summary: reason,
      errors: [...errors, reason],
      route: 'live',
      operation: spec.operation,
      transport,
      data: null,
      approval,
    };
  }
}
