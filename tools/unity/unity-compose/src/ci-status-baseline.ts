// ci-status-baseline — read/record a CI status baseline from the project data.
//
// The baseline is a small, stable snapshot of the last known CI state:
// compile-state, log-digest and the Unity verification report, folded into a
// single `green`/`red`/`unknown` verdict. It is written to
// `.opencode/project-data/ci-status-baseline.json`. Offline and fail-soft: a
// missing artefact simply leaves that dimension unknown.
import { join } from 'node:path';
import { nowIso, readJson, toPosix, writeJson } from '../../../shared/io';
import { makeResult, num, str, type ComposeBase, type ComposeOptions, type Json } from './shared';

export const CI_BASELINE_FILE = 'ci-status-baseline.json';

export type CiStatus = 'green' | 'red' | 'unknown';

export interface CiStatusBaseline {
  schemaVersion: number;
  recordedAt: string;
  source: string;
  status: CiStatus;
  compile: Json | null;
  tests: Json | null;
  logs: Json | null;
}

export interface CiStatusBaselineResult extends ComposeBase {
  action: 'read' | 'record';
  baselinePath: string;
  baseline: CiStatusBaseline | null;
}

export function baselinePath(options: ComposeOptions): string {
  return join(options.opencodeDir, 'project-data', CI_BASELINE_FILE);
}

function testFailureCount(report: Json | null): number | null {
  const summary = report && typeof report.summary === 'object' && report.summary !== null ? (report.summary as Json) : null;
  if (!summary) return null;
  let failed = 0;
  let seen = false;
  for (const key of ['editMode', 'playMode']) {
    const counts = summary[key];
    if (counts && typeof counts === 'object') {
      seen = true;
      failed += num(counts as Json, 'failed') ?? 0;
    }
  }
  return seen ? failed : null;
}

export function deriveBaselineStatus(compile: Json | null, logs: Json | null, tests: Json | null): CiStatus {
  const errorCount = num(logs, 'errorCount');
  const failed = testFailureCount(tests);
  if ((errorCount ?? 0) > 0 || (failed ?? 0) > 0) return 'red';
  if (!compile || !tests) return 'unknown';
  if (str(compile, 'status') === 'unavailable') return 'unknown';
  return 'green';
}

export function gatherBaseline(options: ComposeOptions): CiStatusBaseline {
  const dataDir = join(options.opencodeDir, 'project-data');
  const compile = readJson<Json>(join(dataDir, 'compile-state.json'));
  const logs = readJson<Json>(join(dataDir, 'log-digest.json'));
  const tests = readJson<Json>(join(dataDir, 'unity-verification-report.json'));
  return {
    schemaVersion: 1,
    recordedAt: nowIso(),
    source: options.source ?? 'project-data',
    status: deriveBaselineStatus(compile, logs, tests),
    compile,
    tests,
    logs,
  };
}

export function readBaseline(path: string): CiStatusBaseline | null {
  const raw = readJson<Json>(path);
  if (!raw) return null;
  const status = str(raw, 'status');
  return {
    schemaVersion: num(raw, 'schemaVersion') ?? 1,
    recordedAt: str(raw, 'recordedAt') ?? nowIso(),
    source: str(raw, 'source') ?? 'project-data',
    status: status === 'green' || status === 'red' ? status : 'unknown',
    compile: (raw.compile as Json | null) ?? null,
    tests: (raw.tests as Json | null) ?? null,
    logs: (raw.logs as Json | null) ?? null,
  };
}

export function runCiStatusBaseline(options: ComposeOptions): CiStatusBaselineResult {
  const path = baselinePath(options);
  const action = (options.verb ?? 'read').trim().toLowerCase() === 'record' ? 'record' : 'read';

  if (action === 'record') {
    const baseline = gatherBaseline(options);
    writeJson(path, baseline);
    const base = makeResult('ci-status-baseline', 'recorded', `recorded CI baseline: ${baseline.status}`, [], { writesState: true });
    return { ...base, action, baselinePath: toPosix(path), baseline };
  }

  const baseline = readBaseline(path);
  if (!baseline) {
    const base = makeResult('ci-status-baseline', 'not_found', `no CI baseline at ${toPosix(path)}`, [], { writesState: true });
    return { ...base, action, baselinePath: toPosix(path), baseline: null };
  }
  const base = makeResult('ci-status-baseline', 'ok', `CI baseline: ${baseline.status} (recorded ${baseline.recordedAt})`, [], { writesState: true });
  return { ...base, action, baselinePath: toPosix(path), baseline };
}
