// studio-config — CLI entry for the pattern-toggle resolver (Phase 3 Step 3.4).
//
// Usage:
//   studio-config --opencode-dir .opencode [--config <file>] [--catalog <file>] [--json]
//
// Reads `.opencode/unity-studio.json` (fail-soft: absent -> defaults), resolves
// the enabled patterns against `programming-patterns.json`, and reports every
// conflict. Never exits non-zero for a config problem: conflicts are surfaced
// in the output, not enforced by failing a build.
import { runCli } from '../../../shared/cli-bootstrap';
import { loadPatternCatalog } from './catalog';
import { resolveOptions, type StudioConfigOptions } from './cli';
import { loadStudioConfig } from './config';
import { resolveStudioConfig } from './resolver';
import type { ConfigProblem, ResolvedStudioConfig } from './types';

export interface StudioConfigResult {
  configPath: string;
  catalogPath: string | null;
  present: boolean;
  resolution: ResolvedStudioConfig;
}

function run(options: StudioConfigOptions): StudioConfigResult {
  const load = loadStudioConfig(options.configPath);
  const catalog = options.catalogPath ? loadPatternCatalog(options.catalogPath) : null;

  const problems: ConfigProblem[] = [...load.problems];
  if (load.present && !catalog) {
    problems.push({ field: 'catalog', message: 'pattern catalog not found; pattern conflicts were not validated' });
  }

  const resolution = resolveStudioConfig(load.config, catalog ?? { categories: [], patterns: [] }, problems);
  return { configPath: options.configPath, catalogPath: options.catalogPath, present: load.present, resolution };
}

function render(result: StudioConfigResult): string {
  const { resolution } = result;
  const lines: string[] = [];
  lines.push(`Studio config: ${result.present ? result.configPath : 'not present (using defaults)'}`);
  lines.push(`Pattern catalog: ${result.catalogPath ?? 'not found'}`);
  lines.push(`Studio mode: ${resolution.config.studioMode} | Review intensity: ${resolution.config.reviewIntensity}`);
  lines.push(`Toggles: tdd=${resolution.config.toggles.tdd}, ftf=${resolution.config.toggles.ftf}`);
  lines.push(`Patterns (${resolution.enabledPatterns.length}): ${resolution.enabledPatterns.join(', ') || '(none)'}`);
  lines.push(`Packages (${resolution.enabledPackages.length}): ${resolution.enabledPackages.join(', ') || '(none)'}`);
  if (resolution.conflicts.length > 0) {
    lines.push(`Conflicts (${resolution.conflicts.length}):`);
    for (const conflict of resolution.conflicts) lines.push(`  - [${conflict.kind}] ${conflict.message}`);
  }
  if (resolution.problems.length > 0) {
    lines.push(`Problems (${resolution.problems.length}):`);
    for (const problem of resolution.problems) lines.push(`  - [${problem.field}] ${problem.message}`);
  }
  lines.push(`Valid: ${resolution.valid}`);
  return lines.join('\n');
}

runCli<StudioConfigOptions, StudioConfigResult>({ abilities: [], resolveOptions, run, render });
