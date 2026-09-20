// The runtime abilities — debugging, UI validation, profiling, UI Toolkit.
//
// Each one reaches the *running* Editor/Player through the live Unity CLI
// channel. The concrete `cli`/`mcp` transports land later; this module consumes
// the `RuntimeChannel` seam and is strictly fail-soft: no channel, a channel
// that reports unavailable, or a channel that throws all resolve to
// `unavailable`, never a thrown error.
import { findExecutable } from '../../../shared/toolchain';
import { findLiveInstance } from '../../gather-unity-context/src/editor';
import { checkCodeExecutionApproval } from './approval';
import { makeResult } from './shared';
import {
  RUN_MODES,
  RUNTIME_ABILITIES,
  type ApprovalDecision,
  type RunOptions,
  type RuntimeAbility,
  type RuntimeChannel,
  type RuntimeResult,
} from './types';

export interface RuntimeOperationSpec {
  operation: string;
  command: string;
  args: string[];
  codeExecution: boolean;
}

const OPERATION_SPECS: Record<string, RuntimeOperationSpec> = {
  get_logs: { operation: 'get_logs', command: 'get_logs', args: ['--logType', 'Error'], codeExecution: false },
  'execute-code': { operation: 'execute-code', command: 'eval', args: [], codeExecution: true },
  ui_snapshot: { operation: 'ui_snapshot', command: 'ui_snapshot', args: [], codeExecution: false },
  ui_find: { operation: 'ui_find', command: 'ui_find', args: [], codeExecution: false },
  ui_click: { operation: 'ui_click', command: 'ui_click', args: [], codeExecution: false },
  ui_key: { operation: 'ui_key', command: 'ui_key', args: [], codeExecution: false },
  profiler_counters: { operation: 'profiler_counters', command: 'profiler_counters', args: [], codeExecution: false },
  profiler_snapshot: { operation: 'profiler_snapshot', command: 'profiler_snapshot', args: [], codeExecution: false },
  uitk_tree: { operation: 'uitk_tree', command: 'uitk_tree', args: [], codeExecution: false },
  uitk_click: { operation: 'uitk_click', command: 'uitk_click', args: [], codeExecution: false },
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
  const args = spec.codeExecution ? [options.code ?? ''] : [...spec.args];
  return [
    spec.command,
    ...args,
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

// Probe for a live channel: an explicitly injected channel wins (including an
// explicit `null`); otherwise the Unity CLI must exist and report a live
// instance for this project. No custom bridge is built — this is the CLI seam.
//
// TODO(Phase 6): the concrete `cli`/`mcp` transports are not wired yet. The
// channel returned here only reports `available`; it carries no `invoke`, so
// `runRuntimeAbility` still ends `unavailable` below. Selecting the `cli`
// transport therefore means "a live channel was chosen", NOT "the call
// succeeded" — the result is fail-soft until a transport lands.
export function resolveRuntimeChannel(options: RunOptions): RuntimeChannel | null {
  if (options.live !== undefined) return options.live;
  if (!findExecutable(options.cliCommand)) return null;
  const instance = findLiveInstance(options.projectRoot, options.cliCommand);
  if (!instance) return null;
  return { transport: 'cli', available: () => true };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function runRuntimeAbility(options: RunOptions): Promise<RuntimeResult> {
  const ability = options.ability as RuntimeAbility;
  const { spec, errors } = resolveOperation(ability, options.operation);
  const command = buildCommand(options, spec);

  const base = makeResult(ability, 'unavailable', `${spec.operation} unavailable`, [], {
    route: 'offline',
    requiresEditor: true,
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
    const response = await channel.invoke({ operation: spec.operation, args: command });
    if (!response.ok) {
      return {
        ...base,
        status: 'unknown',
        summary: `${spec.operation} failed on the live channel`,
        errors: [...errors, ...response.errors],
        route: 'live',
        operation: spec.operation,
        transport,
        data: response.data,
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
}
