// Dispatcher for the five Verify abilities (Phase 2 Step 2.5, Phase 5 Step 5.3, ADR-0015).
//
// None of these abilities mutate the project. They checkpoint, scan, run tests,
// and fold gates; the delta is always reported with the honesty rules from
// `delta.ts`.
import { join } from 'node:path';
import { readJson } from '../../../shared/io';
import { findExecutable } from '../../../shared/toolchain';
import { findLiveInstance } from '../../gather-unity-context/src/editor';
import { runTestMode, type TestRun } from '../../gather-unity-context/src/gate';
import {
  captureSnapshot,
  readCheckpoint,
  writeCheckpoint,
} from './checkpoint';
import { computeDelta, notComputedDelta } from './delta';
import { runFailingTestFirst, type FailingTestFirstResult } from './failing-test-first';
import {
  foldGates,
  gateEntriesFromState,
  parseGateOverrides,
  type FoldedGates,
  type GateStatus,
} from './gates';
import {
  makeResult,
  projectDataDir,
  type Json,
} from './shared';
import {
  VERIFY_MODES,
  type VerifyBase,
  type VerifyOptions,
  type VerifyPhase,
  type VerifyStatus,
} from './types';

export interface CompileVerifyResult extends VerifyBase {
  phase: VerifyPhase;
  checkpointPath: string | null;
}

export interface TestRunVerifyResult extends VerifyBase {
  testRun: TestRun | null;
  testRunSource: 'live-editor' | 'batch-editor' | null;
}

export interface GateReviewResult extends VerifyBase {
  gates: FoldedGates;
}

export type VerifyResult =
  | CompileVerifyResult
  | TestRunVerifyResult
  | GateReviewResult
  | FailingTestFirstResult;

function readData(options: VerifyOptions, file: string): Json | null {
  return readJson<Json>(join(projectDataDir(options), file));
}

// ---------------------------------------------------------------------------
// compile-and-verify-project — checkpoint the compile state, then diff it
// ---------------------------------------------------------------------------

function compileAndVerifyProject(options: VerifyOptions): CompileVerifyResult {
  const changeScope = (options.changeScope ?? []).map((token) => token.trim()).filter((token) => token !== '');

  if (options.phase === 'validate' && changeScope.length === 0) {
    const refusal = 'validate requires a declared change scope (--change-scope, comma-separated files/symbols); refusing to report a verdict';
    const base = makeResult(options.ability, 'refused', refusal, [refusal], 'offline');
    base.mode = VERIFY_MODES[options.ability];
    base.delta = notComputedDelta('change scope required; no delta computed');
    return { ...base, phase: options.phase, checkpointPath: null };
  }

  const snapshot = captureSnapshot(options);
  const base = makeResult(
    options.ability,
    'observed_locally',
    'Compile checkpoint captured from Library/ScriptAssemblies',
    [],
    'offline'
  );
  base.mode = VERIFY_MODES[options.ability];
  base.changeScope = changeScope.length > 0 ? changeScope : null;
  base.checkpoint = snapshot;

  if (options.phase === 'checkpoint') {
    const path = writeCheckpoint(options, snapshot);
    base.delta = notComputedDelta('checkpoint captured; no delta computed');
    base.summary = `Compile checkpoint captured (${snapshot.compile.assemblyCount ?? '?'} assemblies)`;
    return { ...base, phase: options.phase, checkpointPath: path };
  }

  const before = readCheckpoint(options);
  const delta = computeDelta(before, snapshot, { ok: true }, changeScope);
  base.delta = delta;

  if (snapshot.compile.status === 'unavailable') {
    base.status = 'unavailable';
    base.errors.push('compile state unavailable: Library/ScriptAssemblies not found');
  } else if (delta.computed && (delta.newIssues?.length ?? 0) > 0) {
    base.status = 'regressed';
  } else if (delta.computed) {
    base.status = 'verified';
  } else {
    base.status = 'unknown';
  }

  base.summary = delta.computed
    ? `${delta.newIssues?.length ?? 0} new, ${delta.resolvedIssues?.length ?? 0} resolved compile issue(s)`
    : `delta not computed (${delta.reasons[0] ?? 'unknown reason'})`;
  return { ...base, phase: options.phase, checkpointPath: null };
}

// ---------------------------------------------------------------------------
// run-edit-mode-tests / run-play-mode-tests — wrap runTestMode
// ---------------------------------------------------------------------------

function testCountsFor(mode: 'editor' | 'playmode', run: TestRun) {
  return mode === 'editor' ? { editMode: run.counts } : { playMode: run.counts };
}

function runModeTests(options: VerifyOptions, mode: 'editor' | 'playmode'): TestRunVerifyResult {
  const base = makeResult(
    options.ability,
    'unavailable',
    'No Unity CLI available; tests not run',
    [],
    'offline',
    true
  );
  base.mode = VERIFY_MODES[options.ability];

  if (!findExecutable(options.cliCommand)) {
    base.errors.push(`Unity CLI "${options.cliCommand}" not found on PATH`);
    return { ...base, testRun: null, testRunSource: null };
  }

  const testOptions = {
    projectRoot: options.projectRoot,
    scratchDir: join(options.opencodeDir, '.scratch', 'unity'),
    cliCommand: options.cliCommand,
  };
  const instance = findLiveInstance(options.projectRoot, options.cliCommand);
  const run = runTestMode(testOptions, mode, instance);
  base.route = instance ? 'live' : 'batch';

  const snapshot = captureSnapshot({ ...options, testCounts: testCountsFor(mode, run) });
  base.checkpoint = snapshot;
  const before = readCheckpoint(options);
  const delta = computeDelta(before, snapshot);
  base.delta = delta;

  if (run.status === 'failed') base.status = 'failed';
  else if (delta.computed && (delta.newIssues?.length ?? 0) > 0) base.status = 'regressed';
  else base.status = 'verified';

  const label = mode === 'editor' ? 'EditMode' : 'PlayMode';
  base.summary = `${label}: ${run.counts.passed}/${run.counts.total} passed (${run.status})`;
  return { ...base, testRun: run, testRunSource: run.source };
}

// ---------------------------------------------------------------------------
// gate-review — fold the named gates strictest-wins
// ---------------------------------------------------------------------------

function verifyStatusFromGate(status: GateStatus): VerifyStatus {
  switch (status) {
    case 'passed':
      return 'passed';
    case 'failed':
      return 'failed';
    case 'warning':
      return 'warning';
    case 'unavailable':
      return 'unavailable';
    case 'unknown':
      return 'unknown';
    case 'not_run':
      return 'not_run';
  }
}

function gateReview(options: VerifyOptions): GateReviewResult {
  const { entries: overrides, errors: overrideErrors } = parseGateOverrides(options.gatesJson);
  const entries = gateEntriesFromState({
    gateState: readData(options, 'gate-state.json'),
    verificationReport: readData(options, 'unity-verification-report.json'),
    compileState: readData(options, 'compile-state.json'),
    testInventory: readData(options, 'test-inventory.json'),
    overrides,
  });
  const folded = foldGates(entries, options.reviewIntensity);

  const base = makeResult(
    options.ability,
    verifyStatusFromGate(folded.status),
    `${folded.status} (strictest: ${folded.strictest ?? 'none'}, intensity ${folded.intensity})`,
    [],
    'offline'
  );
  base.mode = VERIFY_MODES[options.ability];
  base.delta = notComputedDelta('gate review folds named gates; no mutation delta computed');
  base.errors.push(...overrideErrors);
  if (folded.hardFailures > 0) {
    base.errors.push(`${folded.hardFailures} hard gate failure(s)`);
  }
  return { ...base, gates: folded };
}

// ---------------------------------------------------------------------------
// dispatcher
// ---------------------------------------------------------------------------

export function runVerify(options: VerifyOptions): VerifyResult {
  switch (options.ability) {
    case 'compile-and-verify-project':
      return compileAndVerifyProject(options);
    case 'run-edit-mode-tests':
      return runModeTests(options, 'editor');
    case 'run-play-mode-tests':
      return runModeTests(options, 'playmode');
    case 'gate-review':
      return gateReview(options);
    case 'failing-test-first':
      return runFailingTestFirst(options);
    default: {
      const exhaustive: never = options.ability;
      throw new Error(`unsupported Verify ability: ${String(exhaustive)}`);
    }
  }
}
