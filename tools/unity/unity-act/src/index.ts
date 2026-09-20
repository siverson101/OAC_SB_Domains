// unity-act — CLI entry for the six Act abilities (Phase 2 Step 2.4).
//
// Usage:
//   unity-act --project-root . --opencode-dir .opencode --ability prefab-automation \
//     --prefab Assets/Prefabs/Player.prefab --ops patch.json --dryRun true --json
//   unity-act ... --ability scene-editing --change-kind structural --json
//   unity-act ... --ability pattern-library --pattern tdd --json
//   unity-act ... --ability script-scaffolding --template monobehaviour --name Player --json
//   unity-act --list
//
// Mutating paths default to a dry run and refuse to write without --confirm.
// Every ability is fail-soft: a missing table or template is reported, never thrown.
import { runCli } from '../../../shared/cli-bootstrap';
import { runAct, type ActResult } from './abilities';
import { resolveOptions } from './cli';
import { ACT_ABILITIES } from './types';

function render(result: ActResult): string {
  const lines = [`[${result.ability}] ${result.status} — ${result.summary}`];
  lines.push(`  mutated: ${result.mutated} · route: ${result.route} · mode: ${result.mode}`);
  if ('escalation' in result) lines.push(`  rung: ${result.escalation.rung}`);
  if ('written' in result && result.fileName) lines.push(`  file: ${result.fileName}`);
  if ('conflicts' in result && result.conflicts.length > 0) {
    for (const conflict of result.conflicts) lines.push(`  conflict: ${conflict.pattern} vs ${conflict.conflictsWith}`);
  }
  for (const error of result.errors) lines.push(`  error: ${error}`);
  return lines.join('\n');
}

runCli({ abilities: ACT_ABILITIES, resolveOptions, run: runAct, render });
