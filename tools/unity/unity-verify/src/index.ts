// unity-verify — CLI entry for the four Verify abilities (Phase 2 Step 2.5).
//
// Usage:
//   unity-verify --project-root . --opencode-dir .opencode \
//     --ability compile-and-verify-project --phase checkpoint --json
//   unity-verify ... --ability compile-and-verify-project --json
//   unity-verify ... --ability run-edit-mode-tests --json
//   unity-verify ... --ability run-play-mode-tests --json
//   unity-verify ... --ability gate-review --review-intensity lean --json
//   unity-verify --list
//
// Verify never mutates the project. Every ability is fail-soft: without a Unity
// CLI or a captured checkpoint it reports `unavailable`/`unknown` and a delta of
// `null` (no delta computed), never a false "clean".
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
  for (const error of result.errors) lines.push(`  error: ${error}`);
  return lines.join('\n');
}

function main(): void {
  const options = resolveOptions(process.argv.slice(2));
  if (options.list) {
    process.stdout.write(VERIFY_ABILITIES.join('\n') + '\n');
    return;
  }
  const result = runVerify(options);
  if (options.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  process.stdout.write(render(result) + '\n');
}

main();
