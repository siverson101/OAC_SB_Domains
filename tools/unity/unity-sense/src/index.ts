// unity-sense — CLI entry for the six offline Sense abilities (Phase 2 Step 2.3).
//
// Usage:
//   unity-sense --project-root . --opencode-dir .opencode --ability project-status [--json]
//   unity-sense ... --ability code-navigation --query PlayerController --json
//   unity-sense --list
//
// Every ability is read-only and offline: missing files report
// `unavailable`/`unknown` rather than throwing.
import { resolveOptions } from './cli';
import { runSense, type SenseResult } from './abilities';
import { SENSE_ABILITIES } from './types';

function render(result: SenseResult): string {
  const lines = [`[${result.ability}] ${result.status} — ${result.summary}`];
  for (const error of result.errors) lines.push(`  error: ${error}`);
  return lines.join('\n');
}

function main(): void {
  const options = resolveOptions(process.argv.slice(2));
  if (options.list) {
    process.stdout.write(SENSE_ABILITIES.join('\n') + '\n');
    return;
  }
  const result = runSense(options);
  if (options.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  process.stdout.write(render(result) + '\n');
}

main();
