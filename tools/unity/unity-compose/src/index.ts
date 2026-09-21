// unity-compose — CLI entry for the five Compose abilities (Phase 2 Step 2.7,
// Phase 5 Step 5.3).
//
// Usage:
//   unity-compose --project-root . --opencode-dir .opencode \
//     --ability coordination-board --verb claim --resource Assets/Player.cs \
//     --holder unity-3d-implementer --lease-seconds 900 --json
//   unity-compose ... --ability coordination-board --verb hold --holder qa --json
//   unity-compose ... --ability coordination-board --verb status --json
//   unity-compose ... --ability primitive-composition --json
//   unity-compose ... --ability contract-aware-design --json
//   unity-compose ... --ability ci-status-baseline --verb record --json
//   unity-compose ... --ability plan-feature --feature <slug> \
//     --test-cases "<verbatim>" --testability PASS --json
//   unity-compose --list
//
// Every ability is offline and fail-soft: it reads/writes plain files under
// `.opencode/` and never launches the Editor.
import { runCli } from '../../../shared/cli-bootstrap';
import { runCompose, type ComposeResult } from './abilities';
import { resolveOptions } from './cli';
import { COMPOSE_ABILITIES } from './types';

function render(result: ComposeResult): string {
  const lines = [`[${result.ability}] ${result.status} — ${result.summary}`];
  lines.push(`  route: ${result.route} · mode: ${result.mode}`);
  if ('action' in result && 'board' in result) {
    lines.push(`  action: ${result.action} · claims: ${result.board.claims.length}`);
    if (result.holder) lines.push(`  holder: ${result.holder} until ${result.expiresAt ?? 'n/a'}`);
    for (const claim of result.board.claims) lines.push(`  claim ${claim.resource} → ${claim.holder} (until ${claim.expiresAt})`);
    if (result.board.editorHold) lines.push(`  editor hold: ${result.board.editorHold.holder} until ${result.board.editorHold.expiresAt}`);
  }
  if ('report' in result) {
    lines.push(`  primitives: ${result.report.primitives.length} · edges: ${result.report.edges.length}`);
    for (const conflict of result.report.conflicts) lines.push(`  conflict ${conflict.a} ↔ ${conflict.b} (${conflict.reason})`);
    for (const unresolved of result.report.unresolved) lines.push(`  unresolved: ${unresolved}`);
  }
  if ('results' in result && 'checked' in result) {
    lines.push(`  checked: ${result.checked} · valid: ${result.valid} · invalid: ${result.invalid}`);
    for (const check of result.results) {
      if (!check.ok) lines.push(`  invalid ${check.id}: ${check.errors.join('; ')}`);
    }
  }
  if ('baselinePath' in result) {
    lines.push(`  action: ${result.action} · baseline: ${result.baseline?.status ?? 'none'}`);
  }
  if ('planPath' in result) {
    lines.push(
      `  action: ${result.action} · feature: ${result.feature ?? 'n/a'} · testability: ${result.testability ?? 'n/a'} · written: ${result.written}`
    );
    if (result.instruction) lines.push(`  instruction: ${result.instruction}`);
  }
  for (const error of result.errors) lines.push(`  error: ${error}`);
  return lines.join('\n');
}

runCli({ abilities: COMPOSE_ABILITIES, resolveOptions, run: runCompose, render });
