// Runtime code execution approval gate (ADR-0018).
//
// Logs, screenshots, performance counters and UI clicks are in scope in full.
// Running *arbitrary code* in the Player is different: it is unsafe, so it sits
// behind an explicit approval flag. This module is the single decision point.
import type { ApprovalDecision, RunOptions } from './types';

export function checkCodeExecutionApproval(options: RunOptions): ApprovalDecision {
  const approved = options.approveCodeExecution === true;
  if (!approved) {
    return {
      required: true,
      approved: false,
      allowed: false,
      reason: 'runtime code execution requires explicit approval (--approve-code-execution)',
    };
  }
  return {
    required: true,
    approved: true,
    allowed: true,
    reason: 'explicit approval recorded',
  };
}
