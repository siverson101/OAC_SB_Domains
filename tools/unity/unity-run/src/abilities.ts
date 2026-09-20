// Dispatcher for the five Run abilities (Phase 2 Step 2.6).
//
// `unity-change-loop` is a pure, offline fold over evidence. The other four are
// runtime abilities that need the live channel and fail soft to `unavailable`.
import { runChangeLoop, type ChangeLoopRunResult } from './change-loop';
import { isRuntimeAbility, runRuntimeAbility } from './runtime';
import type { RunOptions, RuntimeResult } from './types';

export type RunResult = ChangeLoopRunResult | RuntimeResult;

export function runRun(options: RunOptions): RunResult {
  if (options.ability === 'unity-change-loop') return runChangeLoop(options);
  if (isRuntimeAbility(options.ability)) return runRuntimeAbility(options);
  return runChangeLoop({ ...options, ability: 'unity-change-loop' });
}
