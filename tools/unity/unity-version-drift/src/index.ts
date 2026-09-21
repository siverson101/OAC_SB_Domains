// version-drift — CLI entry for the Session-Start Version Check ability.
//
// Usage:
//   version-drift --project-root . --opencode-dir .opencode [--json]
//   version-drift ... --if-due --max-age-hours 24 [--json]
//   version-drift --list
//
// The Editor/package reads are offline and read-only; the Unity CLI probe is
// best-effort (absent CLI reports `unavailable`). Only baseline files are
// written, and every change needing judgement is surfaced as ACTION REQUIRED.
import { runCli } from '../../../shared/cli-bootstrap';
import { resolveOptions } from './cli';
import { runVersionDrift, type VersionDriftResult } from './abilities';
import { VERSION_DRIFT_ABILITIES } from './types';

function render(result: VersionDriftResult): string {
  return result.report;
}

runCli({ abilities: VERSION_DRIFT_ABILITIES, resolveOptions, run: runVersionDrift, render });
