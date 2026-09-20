// unity-change-loop — the Run family's change loop as data (ADR-0015).
//
// The loop is: resolve -> inspect -> smallest change -> compile -> logs ->
// tests -> observe. It is driven by named gates (compile, logs, tests, observe)
// and it *cites evidence* for each. "Done" is only declared when the required
// gates are green; a caller that claims "done" without green tests is refused.
//
// Everything here is a pure function over evidence so it can be unit-tested
// without a Unity install. `gatherChangeLoopEvidence` is the only part that
// touches disk, and it is read-only.
import { join } from 'node:path';
import { readJson } from '../../../shared/io';
import type { TestCounts } from '../../gather-unity-context/src/gate';
import {
  asRecord,
  bool,
  makeResult,
  num,
  projectDataDir,
  runDataDir,
  str,
  type Json,
} from './shared';
import { RUN_MODES, type RunBase, type RunOptions, type RunStatus } from './types';

export type ChangeLoopStageName =
  | 'resolve'
  | 'inspect'
  | 'change'
  | 'compile'
  | 'logs'
  | 'tests'
  | 'observe';

export type EvidenceName = 'change-scope' | 'compile-state' | 'logs' | 'tests' | 'screenshot';

export type LoopGateName = 'compile' | 'logs' | 'tests' | 'observe';

export type LoopGateStatus = 'passed' | 'failed' | 'missing' | 'unavailable';

export interface ChangeLoopStage {
  name: ChangeLoopStageName;
  order: number;
  purpose: string;
  gate: LoopGateName | null;
  requires: EvidenceName[];
}

// The seven stages, in order. `gate` names the gate the stage feeds; `requires`
// names the evidence the stage must cite.
export const CHANGE_LOOP_STAGES: ChangeLoopStage[] = [
  { name: 'resolve', order: 1, purpose: 'Resolve the request to concrete files and symbols.', gate: null, requires: ['change-scope'] },
  { name: 'inspect', order: 2, purpose: 'Read the current code/scene before touching it.', gate: null, requires: [] },
  { name: 'change', order: 3, purpose: 'Make the smallest change that satisfies the request.', gate: null, requires: ['change-scope'] },
  { name: 'compile', order: 4, purpose: 'Compile and confirm fresh assemblies, not a silent no-op.', gate: 'compile', requires: ['compile-state'] },
  { name: 'logs', order: 5, purpose: 'Read the Editor/runtime logs for errors introduced by the change.', gate: 'logs', requires: ['logs'] },
  { name: 'tests', order: 6, purpose: 'Run the applicable tests; green tests are required for done.', gate: 'tests', requires: ['tests'] },
  { name: 'observe', order: 7, purpose: 'Observe the result (screenshot/visual verification) when relevant.', gate: 'observe', requires: ['screenshot'] },
];

// The gates that must be green before "done" can be declared. Tests are the
// hard gate the ticket calls out; compile and logs are the other hard gates.
export const REQUIRED_GATES: LoopGateName[] = ['compile', 'logs', 'tests'];

export interface ChangeLoopEvidence {
  changeScope?: string | null;
  compileState?: Json | null;
  logDigest?: Json | null;
  testResults?: { editMode?: TestCounts | null; playMode?: TestCounts | null } | null;
  screenshot?: { path?: string | null; captured?: boolean } | null;
}

export interface EvidenceCitation {
  name: EvidenceName;
  present: boolean;
  source: string;
  detail: string;
}

export interface LoopGate {
  gate: LoopGateName;
  status: LoopGateStatus;
  detail: string;
}

export interface ChangeLoopResult {
  stages: ChangeLoopStage[];
  gates: LoopGate[];
  evidence: EvidenceCitation[];
  done: boolean;
  refusals: string[];
  status: RunStatus;
  summary: string;
}

function gate(compileState: Json | null): LoopGate {
  if (!compileState) {
    return { gate: 'compile', status: 'unavailable', detail: 'no compile-state artefact' };
  }
  if (str(compileState, 'status') === 'unavailable') {
    return { gate: 'compile', status: 'unavailable', detail: 'Library/ScriptAssemblies missing' };
  }
  if (bool(compileState, 'stale') === true) {
    return { gate: 'compile', status: 'failed', detail: 'scripts newer than assemblies' };
  }
  if (bool(compileState, 'noOpRecompile') === true) {
    return { gate: 'compile', status: 'failed', detail: 'silent no-op recompile' };
  }
  if (num(compileState, 'assemblyCount') === 0) {
    return { gate: 'compile', status: 'failed', detail: 'no assemblies produced' };
  }
  return { gate: 'compile', status: 'passed', detail: 'fresh assemblies observed' };
}

function logsGate(logDigest: Json | null): LoopGate {
  if (!logDigest) {
    return { gate: 'logs', status: 'unavailable', detail: 'no log-digest artefact' };
  }
  if (str(logDigest, 'status') === 'unavailable') {
    return { gate: 'logs', status: 'unavailable', detail: 'Editor log unavailable' };
  }
  const errors = num(logDigest, 'errorCount') ?? 0;
  if (errors > 0) {
    return { gate: 'logs', status: 'failed', detail: `${errors} error(s) in the log digest` };
  }
  return { gate: 'logs', status: 'passed', detail: 'no errors in the log digest' };
}

function countsTotal(counts: TestCounts | null | undefined): number {
  return counts?.total ?? 0;
}

function countsFailed(counts: TestCounts | null | undefined): number {
  return counts?.failed ?? 0;
}

function testsGate(testResults: ChangeLoopEvidence['testResults']): LoopGate {
  const editMode = testResults?.editMode ?? null;
  const playMode = testResults?.playMode ?? null;
  if (!editMode && !playMode) {
    return { gate: 'tests', status: 'missing', detail: 'no test results recorded' };
  }
  const total = countsTotal(editMode) + countsTotal(playMode);
  const failed = countsFailed(editMode) + countsFailed(playMode);
  if (total === 0) {
    return { gate: 'tests', status: 'missing', detail: 'tests ran but reported zero tests' };
  }
  if (failed > 0) {
    return { gate: 'tests', status: 'failed', detail: `${failed} failing test(s) of ${total}` };
  }
  return { gate: 'tests', status: 'passed', detail: `${total} test(s) green` };
}

function observeGate(screenshot: ChangeLoopEvidence['screenshot']): LoopGate {
  if (!screenshot) {
    return { gate: 'observe', status: 'missing', detail: 'no screenshot evidence' };
  }
  if (screenshot.captured === false) {
    return { gate: 'observe', status: 'missing', detail: 'screenshot not captured' };
  }
  return { gate: 'observe', status: 'passed', detail: `screenshot: ${screenshot.path ?? 'captured'}` };
}

function citation(
  name: EvidenceName,
  present: boolean,
  source: string,
  detail: string
): EvidenceCitation {
  return { name, present, source, detail };
}

export function citeEvidence(evidence: ChangeLoopEvidence): EvidenceCitation[] {
  const compile = evidence.compileState ?? null;
  const logs = evidence.logDigest ?? null;
  const tests = evidence.testResults ?? null;
  const screenshot = evidence.screenshot ?? null;
  const hasTests = Boolean(tests && (tests.editMode || tests.playMode));
  const testDetail = hasTests
    ? `${countsTotal(tests?.editMode) + countsTotal(tests?.playMode)} test(s), ${
        countsFailed(tests?.editMode) + countsFailed(tests?.playMode)
      } failing`
    : 'not recorded';

  return [
    citation('change-scope', Boolean(evidence.changeScope), 'request', evidence.changeScope ?? 'not recorded'),
    citation('compile-state', compile !== null, 'project-data/compile-state.json', str(compile, 'status') ?? 'not recorded'),
    citation('logs', logs !== null, 'project-data/log-digest.json', `${num(logs, 'errorCount') ?? 0} error(s)`),
    citation('tests', hasTests, 'project-data/unity-verification-report.json', testDetail),
    citation('screenshot', screenshot !== null, screenshot?.path ?? 'project-data/run/screenshot.json', screenshot?.path ?? 'not recorded'),
  ];
}

function refusalReasons(gates: LoopGate[]): string[] {
  const reasons: string[] = [];
  const tests = gates.find((entry) => entry.gate === 'tests');
  const compile = gates.find((entry) => entry.gate === 'compile');
  const logs = gates.find((entry) => entry.gate === 'logs');

  if (!tests || tests.status !== 'passed') {
    reasons.push(`refuse "done": tests are not green (${tests?.detail ?? 'no test results'})`);
  }
  if (!compile || compile.status !== 'passed') {
    reasons.push(`refuse "done": compile gate not green (${compile?.detail ?? 'no compile state'})`);
  }
  if (!logs || logs.status !== 'passed') {
    reasons.push(`refuse "done": log gate not green (${logs?.detail ?? 'no logs'})`);
  }
  return reasons;
}

// Evaluate the loop against the evidence. `claim` is the caller's asserted
// outcome: claiming "done" without every required gate green is refused.
export function evaluateChangeLoop(evidence: ChangeLoopEvidence, claim?: string | null): ChangeLoopResult {
  const gates: LoopGate[] = [
    gate(evidence.compileState ?? null),
    logsGate(evidence.logDigest ?? null),
    testsGate(evidence.testResults ?? null),
    observeGate(evidence.screenshot ?? null),
  ];
  const evidenceCitations = citeEvidence(evidence);
  const required = gates.filter((entry) => REQUIRED_GATES.includes(entry.gate));
  const done = required.every((entry) => entry.status === 'passed');
  const wantsDone = (claim ?? '').trim().toLowerCase() === 'done';

  let status: RunStatus;
  const refusals: string[] = [];
  if (done) {
    status = 'done';
  } else if (wantsDone) {
    status = 'refused';
    refusals.push(...refusalReasons(gates));
  } else {
    status = 'in_progress';
  }

  const summary = done
    ? `done: ${required.length}/${required.length} required gates green`
    : wantsDone
      ? `refused "done": ${refusals.length} unmet required gate(s)`
      : `in progress: ${required.filter((entry) => entry.status === 'passed').length}/${required.length} required gates green`;

  return { stages: CHANGE_LOOP_STAGES, gates, evidence: evidenceCitations, done, refusals, status, summary };
}

function testCounts(data: Json | null, key: string): TestCounts | null {
  const record = asRecord(data?.[key]);
  if (!record) return null;
  const total = num(record, 'total');
  if (total === null) return null;
  return {
    total,
    passed: num(record, 'passed') ?? 0,
    failed: num(record, 'failed') ?? 0,
    skipped: num(record, 'skipped') ?? 0,
    inconclusive: num(record, 'inconclusive') ?? 0,
    result: str(record, 'result') ?? 'Unknown',
  };
}

// Read the on-disk evidence for the loop. Read-only and fail-soft: a missing
// artefact simply leaves that piece of evidence absent.
export function gatherChangeLoopEvidence(options: RunOptions, changeScope?: string | null): ChangeLoopEvidence {
  const dataDir = projectDataDir(options);
  const compileState = readJson<Json>(join(dataDir, 'compile-state.json'));
  const logDigest = readJson<Json>(join(dataDir, 'log-digest.json'));
  const report = readJson<Json>(join(dataDir, 'unity-verification-report.json'));
  const summary = asRecord(report?.summary);
  const screenshotRecord = readJson<Json>(join(runDataDir(options), 'screenshot.json'));
  const screenshotPath = str(screenshotRecord, 'path');

  return {
    changeScope: changeScope ?? null,
    compileState,
    logDigest,
    testResults: report
      ? { editMode: testCounts(summary, 'editMode'), playMode: testCounts(summary, 'playMode') }
      : null,
    screenshot: screenshotRecord
      ? { path: screenshotPath, captured: bool(screenshotRecord, 'captured') ?? screenshotPath !== null }
      : null,
  };
}

export interface ChangeLoopRunResult extends RunBase, ChangeLoopResult {}

export function runChangeLoop(options: RunOptions): ChangeLoopRunResult {
  const evidence = gatherChangeLoopEvidence(options, options.scope);
  const evaluation = evaluateChangeLoop(evidence, options.claim);
  const base = makeResult('unity-change-loop', evaluation.status, evaluation.summary, [], {
    route: 'offline',
    requiresEditor: false,
  });
  base.mode = RUN_MODES['unity-change-loop'];
  if (evaluation.status === 'refused') base.errors.push(...evaluation.refusals);
  return { ...base, ...evaluation };
}
