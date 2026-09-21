// The single renderer for a resolved studio config (Phase 3 Step 3.4).
//
// Both the studio-config CLI and the shared registry's markdown projection use
// these lines, so the mode/toggles/patterns/conflicts/problems formatting lives
// in exactly one place.

import type { ConfigProblem, PatternConflict, ReviewIntensity, StudioMode, StudioToggles } from './types';

export interface StudioConfigView {
  studioMode: StudioMode;
  reviewIntensity: ReviewIntensity;
  toggles: StudioToggles;
  patterns: string[];
  packages: string[];
  conflicts: PatternConflict[];
  problems: ConfigProblem[];
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function formatIds(ids: string[]): string {
  return ids.map((id) => `\`${id}\``).join(', ') || '(none)';
}

export function renderStudioConfigLines(view: StudioConfigView): string[] {
  const lines: string[] = [];
  lines.push(`- Studio mode: ${view.studioMode}`);
  lines.push(`- Review intensity: ${view.reviewIntensity}`);
  lines.push(`- Toggles: tdd=${view.toggles.tdd}, ftf=${view.toggles.ftf}`);
  lines.push(`- Enabled patterns: ${formatIds(view.patterns)}`);
  lines.push(`- Enabled packages: ${formatIds(view.packages)}`);
  if (view.conflicts.length > 0) {
    lines.push('', '### Pattern conflicts', '');
    for (const conflict of view.conflicts) lines.push(`- **${conflict.kind}**: ${escapeCell(conflict.message)}`);
  }
  if (view.problems.length > 0) {
    lines.push('', '### Config problems', '');
    for (const problem of view.problems) lines.push(`- \`${problem.field}\`: ${escapeCell(problem.message)}`);
  }
  return lines;
}
