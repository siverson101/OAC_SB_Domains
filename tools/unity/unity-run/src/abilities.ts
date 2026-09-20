// Dispatcher for the five Run abilities (Phase 2 Step 2.6).
//
// `unity-change-loop` is a pure, offline fold over evidence. The other four are
// runtime abilities that need the live channel and fail soft to `unavailable`.
import { runChangeLoop, type ChangeLoopRunResult } from './change-loop';
import { isRuntimeAbility, runRuntimeAbility } from './runtime';
import type { RunOptions, RuntimeResult } from './types';

export type RunResult = ChangeLoopRunResult | RuntimeResult;

export async function runRun(options: RunOptions): Promise<RunResult> {
  if (options.ability === 'unity-change-loop') return runChangeLoop(options);
  if (isRuntimeAbility(options.ability)) return runRuntimeAbility(options);
  const exhaustive: never = options.ability;
  throw new Error(`unsupported Run ability: ${String(exhaustive)}`);
}
