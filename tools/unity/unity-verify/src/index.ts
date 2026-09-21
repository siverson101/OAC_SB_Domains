// unity-verify — CLI entry for the five Verify abilities (Phase 2 Step 2.5).
//
// Usage:
//   unity-verify --project-root . --opencode-dir .opencode \
//     --ability compile-and-verify-project --phase checkpoint --json
//   unity-verify ... --ability compile-and-verify-project --json
//   unity-verify ... --ability run-edit-mode-tests --json
//   unity-verify ... --ability run-play-mode-tests --json
//   unity-verify ... --ability gate-review --review-intensity lean --json
//   unity-verify ... --ability failing-test-first --test "PlayerTests.JumpTest" \
//     --expected-reason "NullReferenceException" --failure-message "..." --json
//   unity-verify ... --ability test-deduplication --feature <slug> \
//     --tests Assets/Tests --json
//   unity-verify --list
//
// Verify never mutates the project. Every ability is fail-soft: without a Unity
// CLI or a captured checkpoint it reports `unavailable`/`unknown` and a delta of
// `null` (no delta computed), never a false "clean".
import { runCli } from '../../../shared/cli-bootstrap';
import { runVerify, type VerifyResult } from './abilities';
import { resolveOptions } from './cli';
import { VERIFY_ABILITIES } from './types';

function render(result: VerifyResult): string {
  const lines = [`[${result.ability}] ${result.status} — ${result.summary}`];
  lines.push(`  route: ${result.route} · mode: ${result.mode}`);
  if (result.delta.computed) {
    lines.push(`  delta: +${result.delta.newIssues?.length ?? 0} / -${result.delta.resolvedIssues?.length ?? 0}`);
  } else {
    lines.push(`  delta: not computed${result.delta.compilePending ? ' (compilePending)' : ''}${
      result.delta.validateScanFailed ? ' (validateScanFailed)' : ''
    }`);
  }
  if ('testRun' in result && result.testRun) {
    lines.push(`  tests: ${result.testRun.counts.passed}/${result.testRun.counts.total} passed`);
  }
  if ('gates' in result) lines.push(`  gates: ${result.gates.status} (${result.gates.strictest ?? 'none'})`);
  if ('redStep' in result && result.redStep) lines.push(`  STATUS: ${result.redStep}`);
  if ('removals' in result) {
    lines.push(
      `  action: ${result.action} · tests: ${result.totalTests} · removals: ${result.removals.length} · merges: ${result.merges.length} · written: ${result.written}`
    );
    for (const removal of result.removals) lines.push(`  remove ${removal.name} (keep ${removal.keptName})`);
    for (const merge of result.merges) lines.push(`  merge ${merge.removedNames.join(', ')} into ${merge.keptName}`);
  }
  for (const error of result.errors) lines.push(`  error: ${error}`);
  return lines.join('\n');
}

runCli({ abilities: VERIFY_ABILITIES, resolveOptions, run: runVerify, render });
