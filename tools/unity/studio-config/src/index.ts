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
import { resolveOptions, type StudioConfigOptions } from './cli';
import { renderStudioConfigLines } from './render';
import { resolveStudioConfigProject, type StudioConfigResult } from './resolve';

function run(options: StudioConfigOptions): StudioConfigResult {
  return resolveStudioConfigProject({ configPath: options.configPath, catalogPath: options.catalogPath });
}

function render(result: StudioConfigResult): string {
  const { resolution } = result;
  const lines: string[] = [];
  lines.push(`Studio config: ${result.present ? result.configPath : 'not present (using defaults)'}`);
  lines.push(`Pattern catalog: ${result.catalogPath ?? 'not found'}`);
  lines.push(
    ...renderStudioConfigLines({
      studioMode: resolution.config.studioMode,
      reviewIntensity: resolution.config.reviewIntensity,
      toggles: resolution.config.toggles,
      patterns: resolution.enabledPatterns,
      packages: resolution.enabledPackages,
      conflicts: resolution.conflicts,
      problems: resolution.problems,
    })
  );
  lines.push(`Valid: ${resolution.valid}`);
  return lines.join('\n');
}

runCli<StudioConfigOptions, StudioConfigResult>({ abilities: [], resolveOptions, run, render });
