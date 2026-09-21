import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runVerify } from '../tools/unity/unity-verify/src/abilities';
import { captureSnapshot, readCheckpoint } from '../tools/unity/unity-verify/src/checkpoint';
import { collectIssues, compilePending, computeDelta, issueInScope, notComputedDelta } from '../tools/unity/unity-verify/src/delta';
import {
  effectiveGateStatus,
  foldGates,
  gateEntriesFromState,
  gatesForIntensity,
  parseGateOverrides,
} from '../tools/unity/unity-verify/src/gates';
import { decideRedStep, parseTestCases } from '../tools/unity/unity-verify/src/failing-test-first';
import { makeSnapshot } from '../tools/unity/unity-verify/src/shared';
import { VERIFY_ABILITIES, VERIFY_MODES, type VerifyOptions } from '../tools/unity/unity-verify/src/types';
import type { TestCounts } from '../tools/unity/gather-unity-context/src/gate';
import { parseFrontmatter } from '../tools/shared/registry/src/frontmatter';
import { validateContract } from '../tools/shared/registry/src/contract';
import { SAFETY_GATE_KEYS } from '../tools/shared/safety-gate';

const repoRoot = resolve(import.meta.dir, '..');
const commandDir = join(repoRoot, 'xdomains', 'game-dev', 'unity-3d', 'command');
const schemaPath = join(repoRoot, 'xdomains', 'context', 'capability-contract.schema.json');
const bundle = join(repoRoot, 'xdomains', 'scripts', 'unity', 'unity-verify.mjs');

function assertSafetyGate(fm: Record<string, unknown>): void {
  const gate = fm.safetyGate;
  if (gate === undefined) return;
  expect(typeof gate).toBe('object');
  expect(Array.isArray(gate)).toBe(false);
  for (const [key, value] of Object.entries(gate as Record<string, unknown>)) {
    expect(SAFETY_GATE_KEYS as readonly string[]).toContain(key);
    expect(typeof value).toBe('boolean');
  }
}

function counts(partial: Partial<TestCounts>): TestCounts {
  return { total: 0, passed: 0, failed: 0, skipped: 0, inconclusive: 0, result: 'Passed', ...partial };
}

function write(path: string, body: string): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, body);
}

let fixture: string;
let projectRoot: string;
let opencodeDir: string;
let options: VerifyOptions;

beforeAll(() => {
  fixture = mkdtempSync(join(tmpdir(), 'oac-unity-verify-'));
  projectRoot = join(fixture, 'project');
  opencodeDir = join(projectRoot, '.opencode');
  const dataDir = join(opencodeDir, 'project-data');

  mkdirSync(join(projectRoot, 'Assets'), { recursive: true });
  write(join(projectRoot, 'Library', 'ScriptAssemblies', 'Game.dll'), 'MZ');

  write(join(dataDir, 'scan-result.json'), JSON.stringify({ projectName: 'VerifyFixture', assetFolder: join(projectRoot, 'Assets') }));
  write(
    join(dataDir, 'compile-state.json'),
    JSON.stringify({ status: 'observed_locally', stale: false, noOpRecompile: null, assemblyCount: 1 })
  );
  write(
    join(dataDir, 'gate-state.json'),
    JSON.stringify({ gateResult: 'passed', hardFailures: 0, reviewRequired: 0, fingerprint: 'abc123' })
  );
  write(
    join(dataDir, 'unity-verification-report.json'),
    JSON.stringify({
      schemaVersion: 1,
      status: 'passed',
      results: { editMode: { status: 'passed' }, playMode: { status: 'passed' } },
      summary: { editMode: counts({ total: 3, passed: 3 }), playMode: counts({ total: 1, passed: 1 }) },
    })
  );
  write(join(dataDir, 'test-inventory.json'), JSON.stringify({ visualVerification: { found: false, results: [] } }));

  options = {
    projectRoot,
    opencodeDir,
    ability: 'compile-and-verify-project',
    json: true,
    list: false,
    phase: 'validate',
    cliCommand: 'definitely-not-a-real-cli-xyz',
    reviewIntensity: 'full',
    changeScope: ['Game.dll'],
  };
});

afterAll(() => {
  try {
    rmSync(fixture, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

describe('computeDelta honesty rules', () => {
  test('reports newIssues when a mutation introduces a compile error', () => {
    const before = makeSnapshot({ issues: [] });
    const after = makeSnapshot({
      issues: [{ kind: 'compile', id: 'error CS1002: ; expected', message: 'error CS1002: ; expected' }],
    });
    const delta = computeDelta(before, after);
    expect(delta.computed).toBe(true);
    expect(delta.newIssues?.length).toBe(1);
    expect(delta.resolvedIssues?.length).toBe(0);
    expect(delta.compilePending).toBe(false);
    expect(delta.validateScanFailed).toBe(false);
  });

  test('reports resolvedIssues when a fix removes a compile error', () => {
    const before = makeSnapshot({ issues: [{ kind: 'compile', id: 'error CS1002', message: 'error CS1002' }] });
    const after = makeSnapshot({ issues: [] });
    const delta = computeDelta(before, after);
    expect(delta.computed).toBe(true);
    expect(delta.newIssues?.length).toBe(0);
    expect(delta.resolvedIssues?.length).toBe(1);
  });

  test('a genuine clean delta is an empty array, not null', () => {
    const delta = computeDelta(makeSnapshot(), makeSnapshot());
    expect(delta.computed).toBe(true);
    expect(delta.newIssues).toEqual([]);
    expect(delta.resolvedIssues).toEqual([]);
  });

  test('a no-op (stale assemblies) reports null, never clean', () => {
    const delta = computeDelta(makeSnapshot(), makeSnapshot({ compile: { stale: true } }));
    expect(delta.computed).toBe(false);
    expect(delta.newIssues).toBeNull();
    expect(delta.resolvedIssues).toBeNull();
    expect(delta.compilePending).toBe(true);
  });

  test('a silent no-op recompile reports compilePending and null', () => {
    const delta = computeDelta(makeSnapshot(), makeSnapshot({ compile: { noOpRecompile: true } }));
    expect(delta.computed).toBe(false);
    expect(delta.newIssues).toBeNull();
    expect(delta.compilePending).toBe(true);
  });

  test('zero assemblies reports compilePending', () => {
    expect(compilePending({ status: 'observed_locally', stale: null, noOpRecompile: null, assemblyCount: 0 })).toBe(true);
    const delta = computeDelta(makeSnapshot(), makeSnapshot({ compile: { assemblyCount: 0 } }));
    expect(delta.compilePending).toBe(true);
    expect(delta.newIssues).toBeNull();
  });

  test('a null stale (not determinable) is not compilePending', () => {
    expect(compilePending({ status: 'observed_locally', stale: null, noOpRecompile: null, assemblyCount: 1 })).toBe(false);
  });

  test('a failed validate scan reports null and validateScanFailed', () => {
    const delta = computeDelta(makeSnapshot(), makeSnapshot(), { ok: false, errors: ['boom'] });
    expect(delta.computed).toBe(false);
    expect(delta.validateScanFailed).toBe(true);
    expect(delta.newIssues).toBeNull();
    expect(delta.reasons.join(' ')).toContain('validate scan failed');
  });

  test('an unavailable compile state reports null and validateScanFailed', () => {
    const delta = computeDelta(makeSnapshot(), makeSnapshot({ compile: { status: 'unavailable', assemblyCount: 0 } }));
    expect(delta.computed).toBe(false);
    expect(delta.validateScanFailed).toBe(true);
    expect(delta.compilePending).toBe(false);
    expect(delta.newIssues).toBeNull();
  });

  test('no checkpoint reports null with a reason', () => {
    const delta = computeDelta(null, makeSnapshot());
    expect(delta.computed).toBe(false);
    expect(delta.newIssues).toBeNull();
    expect(delta.reasons.join(' ')).toContain('no checkpoint');
  });

  test('notComputedDelta carries a null delta', () => {
    const delta = notComputedDelta('checkpoint captured');
    expect(delta.computed).toBe(false);
    expect(delta.newIssues).toBeNull();
  });
});

describe('collectIssues', () => {
  test('bounds and dedupes compile errors', () => {
    const issues = collectIssues({
      logErrors: ['error CS1002: ; expected', 'error CS1002: ; expected  ', '  error CS1002: ; expected'],
    });
    expect(issues.length).toBe(1);
    expect(issues[0].kind).toBe('compile');
  });

  test('emits a single bounded issue per failing mode', () => {
    const issues = collectIssues({
      testFailures: [
        { kind: 'editMode', count: 2 },
        { kind: 'playMode', count: 0 },
      ],
    });
    expect(issues.length).toBe(1);
    expect(issues[0].kind).toBe('editMode');
    expect(issues[0].message).toContain('2');
  });
});

describe('change-scope bounded delta', () => {
  test('issueInScope matches file/symbol tokens case-insensitively', () => {
    const issue = { kind: 'compile' as const, id: 'error CS1002 in Player.cs', message: 'error CS1002 in Player.cs' };
    expect(issueInScope(issue, ['player.CS'])).toBe(true);
    expect(issueInScope(issue, ['Enemy.cs'])).toBe(false);
    expect(issueInScope(issue, [])).toBe(true);
    expect(issueInScope(issue, ['  '])).toBe(true);
  });

  test('an out-of-scope issue is not counted as new', () => {
    const before = makeSnapshot({ issues: [] });
    const after = makeSnapshot({
      issues: [
        { kind: 'compile', id: 'Assets/Player.cs: error CS1002', message: 'Assets/Player.cs: error CS1002' },
        { kind: 'compile', id: 'Assets/Enemy.cs: error CS9999', message: 'Assets/Enemy.cs: error CS9999' },
      ],
    });
    const delta = computeDelta(before, after, { ok: true }, ['Player.cs']);
    expect(delta.computed).toBe(true);
    expect(delta.newIssues?.map((issue) => issue.id)).toEqual(['Assets/Player.cs: error CS1002']);
    expect(delta.reasons.join(' ')).toContain('out-of-scope');
  });

  test('without a scope every issue counts', () => {
    const after = makeSnapshot({
      issues: [
        { kind: 'compile', id: 'Assets/Player.cs: error CS1002', message: 'Assets/Player.cs: error CS1002' },
        { kind: 'compile', id: 'Assets/Enemy.cs: error CS9999', message: 'Assets/Enemy.cs: error CS9999' },
      ],
    });
    const delta = computeDelta(makeSnapshot({ issues: [] }), after);
    expect(delta.newIssues?.length).toBe(2);
  });
});

describe('gate folding', () => {
  test('strictest-wins picks the failed gate over passed and not_run', () => {
    const folded = foldGates(
      [
        { gate: 'compile', status: 'passed' },
        { gate: 'editMode', status: 'failed' },
        { gate: 'scene', status: 'not_run' },
      ],
      'full'
    );
    expect(folded.status).toBe('failed');
    expect(folded.strictest).toBe('editMode');
    expect(folded.hardFailures).toBe(1);
  });

  test('the intensity knob filters which gates apply', () => {
    expect(gatesForIntensity('full')).toContain('performance');
    expect(gatesForIntensity('lean')).not.toContain('performance');
    expect(gatesForIntensity('solo')).toEqual(['compile', 'editMode', 'playMode']);

    const entries = [
      { gate: 'compile' as const, status: 'passed' as const },
      { gate: 'performance' as const, status: 'failed' as const },
    ];
    expect(foldGates(entries, 'full').status).toBe('failed');
    expect(foldGates(entries, 'lean').status).toBe('passed');
  });

  test('derives named gates from on-disk state', () => {
    const entries = gateEntriesFromState({
      compileState: { status: 'observed_locally', stale: false, noOpRecompile: null },
      verificationReport: { results: { editMode: { status: 'passed' }, playMode: { status: 'failed' } } },
      testInventory: { visualVerification: { found: true, results: [{ status: 'passed' }] } },
    });
    const byGate = Object.fromEntries(entries.map((entry) => [entry.gate, entry.status]));
    expect(byGate.compile).toBe('passed');
    expect(byGate.editMode).toBe('passed');
    expect(byGate.playMode).toBe('failed');
    expect(byGate.visual).toBe('passed');
    expect(byGate.build).toBe('not_run');
  });

  test('parses gate overrides and reports dropped entries', () => {
    const { entries, errors } = parseGateOverrides(
      '[{"gate":"build","status":"failed"},{"gate":"nope","status":"failed"}]'
    );
    expect(entries).toEqual([{ gate: 'build', status: 'failed', detail: undefined }]);
    expect(errors).toEqual(['ignored --gates override "nope": unknown gate']);
    expect(parseGateOverrides('not json')).toEqual({ entries: [], errors: [] });
  });
});

describe('external verdict folding', () => {
  test('uncertain folds at least as strict as warning', () => {
    const folded = foldGates([{ gate: 'scene', status: 'passed', externalVerdict: 'uncertain' }], 'full');
    expect(folded.status).toBe('warning');
    expect(folded.reviewRequired).toBe(1);
    expect(effectiveGateStatus({ gate: 'scene', status: 'not_run', externalVerdict: 'uncertain' })).toBe('warning');
  });

  test('confirmed fills a not_run gate but never overrides a harder status', () => {
    expect(foldGates([{ gate: 'scene', status: 'not_run', externalVerdict: 'confirmed' }], 'full').status).toBe('passed');
    expect(foldGates([{ gate: 'scene', status: 'failed', externalVerdict: 'confirmed' }], 'full').status).toBe('failed');
    expect(foldGates([{ gate: 'scene', status: 'warning', externalVerdict: 'confirmed' }], 'full').status).toBe('warning');
    expect(foldGates([{ gate: 'scene', status: 'unknown', externalVerdict: 'confirmed' }], 'full').status).toBe('unknown');
  });

  test('strictest-wins is unchanged: uncertain never masks a hard failure', () => {
    const folded = foldGates(
      [
        { gate: 'compile', status: 'failed', externalVerdict: 'uncertain' },
        { gate: 'scene', status: 'passed', externalVerdict: 'uncertain' },
      ],
      'full'
    );
    expect(folded.status).toBe('failed');
    expect(folded.strictest).toBe('compile');
    expect(folded.hardFailures).toBe(1);
  });

  test('parseGateOverrides accepts externalVerdict and drops an unknown one', () => {
    const { entries } = parseGateOverrides('[{"gate":"build","status":"not_run","externalVerdict":"uncertain"}]');
    expect(entries).toEqual([{ gate: 'build', status: 'not_run', externalVerdict: 'uncertain', detail: undefined }]);

    const bad = parseGateOverrides('[{"gate":"build","status":"passed","externalVerdict":"maybe"}]');
    expect(bad.entries).toEqual([{ gate: 'build', status: 'passed', detail: undefined }]);
    expect(bad.errors.join(' ')).toContain('unknown externalVerdict');
  });

  test('gate-review folds an uncertain override to warning', () => {
    const result = runVerify({
      ...options,
      ability: 'gate-review',
      gatesJson: '[{"gate":"scene","status":"passed","externalVerdict":"uncertain"}]',
    });
    expect(result.status).toBe('warning');
    if ('gates' in result) expect(result.gates.reviewRequired).toBe(1);
  });
});

describe('compile-and-verify-project', () => {
  test('the checkpoint phase writes a checkpoint and computes no delta', () => {
    const result = runVerify({ ...options, ability: 'compile-and-verify-project', phase: 'checkpoint' });
    expect(result.family).toBe('verify');
    expect(result.status).toBe('observed_locally');
    expect(result.delta.computed).toBe(false);
    expect(result.delta.newIssues).toBeNull();
    if ('checkpointPath' in result) expect(result.checkpointPath).toBeTruthy();
    expect(readCheckpoint(options)).not.toBeNull();
  });

  test('a mutation introducing a compile error surfaces as newIssues (deterministic scan)', () => {
    const before = captureSnapshot({ projectRoot, opencodeDir, logPaths: [] });
    const after = makeSnapshot({
      ...before,
      issues: [...before.issues, { kind: 'compile', id: 'error CS1002', message: 'error CS1002' }],
    });
    const delta = computeDelta(before, after);
    expect(delta.computed).toBe(true);
    expect(delta.newIssues?.map((issue) => issue.id)).toEqual(['error CS1002']);
  });

  test('fails soft with an unavailable compile state', () => {
    const emptyRoot = join(fixture, 'no-library');
    mkdirSync(join(emptyRoot, 'Assets'), { recursive: true });
    const result = runVerify({ ...options, projectRoot: emptyRoot, opencodeDir: join(emptyRoot, '.opencode') });
    expect(result.status).toBe('unavailable');
    expect(result.delta.computed).toBe(false);
    expect(result.delta.newIssues).toBeNull();
    expect(result.delta.validateScanFailed).toBe(true);
  });

  test('validate without a declared change scope is refused, never verified', () => {
    const result = runVerify({ ...options, ability: 'compile-and-verify-project', phase: 'validate', changeScope: [] });
    expect(result.status).toBe('refused');
    expect(result.status).not.toBe('verified');
    expect(result.delta.computed).toBe(false);
    expect(result.delta.newIssues).toBeNull();
    expect(result.changeScope).toBeNull();
    expect(result.errors.join(' ')).toContain('change scope');
  });

  test('records the declared change scope on the result', () => {
    const result = runVerify({
      ...options,
      ability: 'compile-and-verify-project',
      phase: 'validate',
      changeScope: ['Player.cs', 'Enemy.cs'],
    });
    expect(result.changeScope).toEqual(['Player.cs', 'Enemy.cs']);
  });

  test('an out-of-scope issue is not counted in the delta', () => {
    const checkpoint = join(opencodeDir, 'project-data', 'verify', 'checkpoint.json');
    write(
      checkpoint,
      JSON.stringify({
        schemaVersion: 1,
        generatedAt: '2026-01-01T00:00:00.000Z',
        project: projectRoot,
        snapshot: makeSnapshot({
          issues: [{ kind: 'compile', id: 'Assets/Enemy.cs: error CS1', message: 'Assets/Enemy.cs: error CS1' }],
        }),
      })
    );
    const result = runVerify({
      ...options,
      ability: 'compile-and-verify-project',
      phase: 'validate',
      changeScope: ['Player.cs'],
    });
    expect(result.delta.computed).toBe(true);
    expect(result.delta.resolvedIssues).toEqual([]);
    expect(result.status).toBe('verified');
  });
});

describe('run-edit-mode-tests / run-play-mode-tests fail soft', () => {
  test('reports unavailable without a Unity CLI', () => {
    const edit = runVerify({ ...options, ability: 'run-edit-mode-tests' });
    expect(edit.status).toBe('unavailable');
    expect(edit.route).toBe('offline');
    if ('testRun' in edit) {
      expect(edit.testRun).toBeNull();
      expect(edit.testRunSource).toBeNull();
    }

    const play = runVerify({ ...options, ability: 'run-play-mode-tests' });
    expect(play.status).toBe('unavailable');
  });
});

describe('gate-review', () => {
  test('folds the fixture gates to passed', () => {
    const result = runVerify({ ...options, ability: 'gate-review' });
    expect(result.status).toBe('passed');
    if ('gates' in result) {
      expect(result.gates.strictest).toBe('compile');
      expect(result.gates.hardFailures).toBe(0);
    }
  });

  test('an override can force a hard failure', () => {
    const result = runVerify({
      ...options,
      ability: 'gate-review',
      gatesJson: '[{"gate":"build","status":"failed"}]',
    });
    expect(result.status).toBe('failed');
    if ('gates' in result) expect(result.gates.strictest).toBe('build');
  });

  test('a dropped override is surfaced in the result errors, fail-soft', () => {
    const result = runVerify({
      ...options,
      ability: 'gate-review',
      gatesJson: '[{"gate":"nope","status":"failed"}]',
    });
    expect(result.errors).toContain('ignored --gates override "nope": unknown gate');
  });

  test('verify never mutates the existing gate-state / verification-report shape', () => {
    const gatePath = join(opencodeDir, 'project-data', 'gate-state.json');
    const reportPath = join(opencodeDir, 'project-data', 'unity-verification-report.json');
    const gateBefore = readFileSync(gatePath, 'utf8');
    const reportBefore = readFileSync(reportPath, 'utf8');

    runVerify({ ...options, ability: 'gate-review' });
    runVerify({ ...options, ability: 'compile-and-verify-project', phase: 'checkpoint' });
    runVerify({ ...options, ability: 'run-edit-mode-tests' });

    expect(readFileSync(gatePath, 'utf8')).toBe(gateBefore);
    expect(readFileSync(reportPath, 'utf8')).toBe(reportBefore);
  });
});

describe('failing-test-first', () => {
  const failedXml = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<test-run id="2" testcasecount="1" result="Failed" total="1" passed="0" failed="1">',
    '  <test-suite type="TestFixture" name="PlayerTests" result="Failed">',
    '    <test-case id="1" name="PlayerTests.JumpTest" fullname="PlayerTests.JumpTest" result="Failed">',
    '      <failure>',
    '        <message><![CDATA[System.NullReferenceException: Object reference not set]]></message>',
    '      </failure>',
    '    </test-case>',
    '  </test-suite>',
    '</test-run>',
  ].join('\n');

  const passedXml = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<test-run id="2" testcasecount="1" result="Passed" total="1" passed="1" failed="0">',
    '  <test-suite type="TestFixture" name="PlayerTests" result="Passed">',
    '    <test-case id="1" name="PlayerTests.JumpTest" fullname="PlayerTests.JumpTest" result="Passed" />',
    '  </test-suite>',
    '</test-run>',
  ].join('\n');

  test('parseTestCases reads the name, result and failure message', () => {
    const failed = parseTestCases(failedXml);
    expect(failed).toEqual([
      { name: 'PlayerTests.JumpTest', result: 'Failed', message: 'System.NullReferenceException: Object reference not set' },
    ]);
    expect(parseTestCases(passedXml)[0]).toEqual({ name: 'PlayerTests.JumpTest', result: 'Passed', message: null });
  });

  test('decideRedStep is OK only for an expected failure', () => {
    const ok = decideRedStep({
      test: 'T',
      expectedReason: 'NullReferenceException',
      observation: { result: 'Failed', message: 'System.NullReferenceException: boom' },
    });
    expect(ok.verdict).toBe('OK');
    expect(ok.reason).toBe('expected-failure');

    const passed = decideRedStep({ test: 'T', expectedReason: 'R', observation: { result: 'Passed', message: null } });
    expect(passed.verdict).toBe('NG');
    expect(passed.reason).toBe('unexpected-pass');

    const unrelated = decideRedStep({
      test: 'T',
      expectedReason: 'NullReferenceException',
      observation: { result: 'Failed', message: 'AssertionException: Expected 1 But was 2' },
    });
    expect(unrelated.verdict).toBe('NG');
    expect(unrelated.reason).toBe('unrelated-failure');
  });

  test('refuses when TDD is off', () => {
    const result = runVerify({
      ...options,
      ability: 'failing-test-first',
      test: 'PlayerTests.JumpTest',
      expectedReason: 'NullReferenceException',
      failureMessage: 'System.NullReferenceException: boom',
    });
    expect(result.status).toBe('refused');
    expect(result.errors.join(' ')).toContain('TDD is off');
    if ('redStep' in result) expect(result.redStep).toBeNull();
  });

  test('returns STATUS: OK when the test failed for the expected reason', () => {
    const result = runVerify({
      ...options,
      ability: 'failing-test-first',
      tdd: 'on',
      test: 'PlayerTests.JumpTest',
      expectedReason: 'NullReferenceException',
      failureMessage: 'System.NullReferenceException: Object reference not set',
    });
    expect(result.status).toBe('passed');
    expect(result.summary).toContain('STATUS: OK');
    if ('redStep' in result) {
      expect(result.redStep).toBe('OK');
      expect(result.reason).toBe('expected-failure');
      expect(result.tddEnabled).toBe(true);
    }
  });

  test('returns NG when the test passed unexpectedly (results file)', () => {
    const resultsPath = join(fixture, 'passed-results.xml');
    write(resultsPath, passedXml);
    const result = runVerify({
      ...options,
      ability: 'failing-test-first',
      tdd: 'on',
      test: 'PlayerTests.JumpTest',
      expectedReason: 'NullReferenceException',
      testResults: resultsPath,
    });
    expect(result.status).toBe('failed');
    expect(result.summary).toContain('STATUS: NG');
    if ('redStep' in result) {
      expect(result.redStep).toBe('NG');
      expect(result.reason).toBe('unexpected-pass');
      expect(result.observedResult).toBe('Passed');
    }
  });

  test('returns NG when it failed for an unrelated reason', () => {
    const result = runVerify({
      ...options,
      ability: 'failing-test-first',
      tdd: 'on',
      test: 'PlayerTests.JumpTest',
      expectedReason: 'NullReferenceException',
      failureMessage: 'AssertionException: Expected 1 But was 2',
    });
    expect(result.status).toBe('failed');
    if ('redStep' in result) {
      expect(result.redStep).toBe('NG');
      expect(result.reason).toBe('unrelated-failure');
    }
  });

  test('a results file confirms the expected failure without a --failure-message', () => {
    const resultsPath = join(fixture, 'failed-results.xml');
    write(resultsPath, failedXml);
    const result = runVerify({
      ...options,
      ability: 'failing-test-first',
      tdd: 'on',
      test: 'PlayerTests.JumpTest',
      expectedReason: 'NullReferenceException',
      testResults: resultsPath,
    });
    expect(result.status).toBe('passed');
    if ('redStep' in result) expect(result.redStep).toBe('OK');
  });

  test('a named test absent from the results is NG', () => {
    const resultsPath = join(fixture, 'passed-results.xml');
    const result = runVerify({
      ...options,
      ability: 'failing-test-first',
      tdd: 'on',
      test: 'PlayerTests.MissingTest',
      expectedReason: 'NullReferenceException',
      testResults: resultsPath,
    });
    expect(result.status).toBe('failed');
    if ('redStep' in result) expect(result.reason).toBe('test-not-found');
  });

  test('refuses without --expected-reason', () => {
    const result = runVerify({
      ...options,
      ability: 'failing-test-first',
      tdd: 'on',
      test: 'PlayerTests.JumpTest',
      failureMessage: 'System.NullReferenceException: boom',
    });
    expect(result.status).toBe('refused');
    expect(result.errors.join(' ')).toContain('expected-reason');
  });

  test('refuses without an observed failure', () => {
    const result = runVerify({
      ...options,
      ability: 'failing-test-first',
      tdd: 'on',
      test: 'PlayerTests.JumpTest',
      expectedReason: 'NullReferenceException',
    });
    expect(result.status).toBe('refused');
    expect(result.errors.join(' ')).toContain('observed failure');
  });

  test('reads toggles.tdd from unity-studio.json when no --tdd override', () => {
    const root = join(fixture, 'tdd-project');
    const oc = join(root, '.opencode');
    write(join(oc, 'unity-studio.json'), JSON.stringify({ schemaVersion: 1, toggles: { tdd: true, ftf: false } }));
    const result = runVerify({
      ...options,
      projectRoot: root,
      opencodeDir: oc,
      ability: 'failing-test-first',
      test: 'PlayerTests.JumpTest',
      expectedReason: 'NullReferenceException',
      failureMessage: 'System.NullReferenceException: boom',
    });
    expect(result.status).toBe('passed');
    if ('redStep' in result) expect(result.redStep).toBe('OK');
  });
});

describe('Verify command contracts', () => {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));

  test('declares exactly the five abilities', () => {
    expect(VERIFY_ABILITIES).toEqual([
      'compile-and-verify-project',
      'run-edit-mode-tests',
      'run-play-mode-tests',
      'gate-review',
      'failing-test-first',
    ]);
  });

  for (const ability of VERIFY_ABILITIES) {
    test(`${ability} has a valid Verify contract`, () => {
      const fm = parseFrontmatter(readFileSync(join(commandDir, `${ability}.md`), 'utf8'));
      expect(fm.family).toBe('verify');
      expect(fm.mode).toBe(VERIFY_MODES[ability]);
      expect(fm.id).toBe(ability);
      const result = validateContract(fm as Record<string, unknown>, schema);
      expect(result.errors).toEqual([]);
      assertSafetyGate(fm as Record<string, unknown>);
    });
  }

  test('the compile checkpoint declares writesState', () => {
    const fm = parseFrontmatter(readFileSync(join(commandDir, 'compile-and-verify-project.md'), 'utf8'));
    expect((fm.safetyGate as Record<string, unknown>).writesState).toBe(true);
  });
});

describe('unity-verify bundle', () => {
  test('lists the abilities', () => {
    const res = spawnSync(process.execPath, [bundle, '--list'], { encoding: 'utf8' });
    expect(res.status).toBe(0);
    expect(res.stdout.trim().split(/\r?\n/)).toEqual(VERIFY_ABILITIES);
  });

  test('emits JSON for an offline scan', () => {
    const res = spawnSync(
      process.execPath,
      [
        bundle,
        '--project-root',
        projectRoot,
        '--opencode-dir',
        opencodeDir,
        '--ability',
        'compile-and-verify-project',
        '--json',
      ],
      { encoding: 'utf8' }
    );
    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout);
    expect(parsed.ability).toBe('compile-and-verify-project');
    expect(parsed.family).toBe('verify');
    expect(parsed.delta).toBeDefined();
    expect(existsSync(bundle)).toBe(true);
  });

  test('refuses validate without --change-scope and records one when supplied', () => {
    const refused = spawnSync(
      process.execPath,
      [bundle, '--project-root', projectRoot, '--opencode-dir', opencodeDir, '--ability', 'compile-and-verify-project', '--json'],
      { encoding: 'utf8' }
    );
    expect(refused.status).toBe(0);
    expect(JSON.parse(refused.stdout).status).toBe('refused');

    const scoped = spawnSync(
      process.execPath,
      [
        bundle,
        '--project-root',
        projectRoot,
        '--opencode-dir',
        opencodeDir,
        '--ability',
        'compile-and-verify-project',
        '--change-scope',
        'Player.cs, Enemy.cs',
        '--json',
      ],
      { encoding: 'utf8' }
    );
    expect(scoped.status).toBe(0);
    expect(JSON.parse(scoped.stdout).changeScope).toEqual(['Player.cs', 'Enemy.cs']);
  });
});
