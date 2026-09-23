// unity-run — CLI entry for the five Run abilities (Phase 2 Step 2.6).
//
// Usage:
//   unity-run --project-root . --opencode-dir .opencode \
//     --ability unity-change-loop [--claim done] --json
//   unity-run ... --ability runtime-debugging --operation get_logs --json
//   unity-run ... --ability runtime-debugging --operation execute-code \
//     --code "return 1+1;" --approve-code-execution --json
//   unity-run ... --ability runtime-ui-validation --operation ui_click --json
//   unity-run ... --ability performance-diagnostics --json
//   unity-run ... --ability ui-interaction --json
//   unity-run --list
//
// The change loop is fail-soft and offline; it refuses "done" without green
// tests. The runtime abilities are fail-soft too: without a live channel/Editor
// they report `unavailable` and never throw.
import { runCli } from '../../../shared/cli-bootstrap';
import { runRun, type RunResult } from './abilities';
import { resolveOptions } from './cli';
import { RUN_ABILITIES } from './types';

function render(result: RunResult): string {
  const lines = [`[${result.ability}] ${result.status} — ${result.summary}`];
  lines.push(`  route: ${result.route} · mode: ${result.mode}`);
  if ('gates' in result) {
    for (const entry of result.gates) lines.push(`  gate ${entry.gate}: ${entry.status} (${entry.detail})`);
    for (const citation of result.evidence) {
      lines.push(`  evidence ${citation.name}: ${citation.present ? 'present' : 'absent'} — ${citation.detail}`);
    }
  }
  if ('operation' in result) {
    lines.push(`  operation: ${result.operation} · transport: ${result.transport ?? 'none'}`);
    if (result.command) lines.push(`  command: ${result.command.join(' ')}`);
  }
  for (const error of result.errors) lines.push(`  error: ${error}`);
  return lines.join('\n');
}

runCli({ abilities: RUN_ABILITIES, resolveOptions, run: runRun, render });
