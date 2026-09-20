import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runVerify } from '../tools/unity/unity-verify/src/abilities';
import { captureSnapshot, readCheckpoint } from '../tools/unity/unity-verify/src/checkpoint';
import { collectIssues, compilePending, computeDelta, notComputedDelta } from '../tools/unity/unity-verify/src/delta';
import {
  foldGates,
  gateEntriesFromState,
  gatesForIntensity,
  parseGateOverrides,
} from '../tools/unity/unity-verify/src/gates';
import { makeSnapshot } from '../tools/unity/unity-verify/src/shared';
import { VERIFY_ABILITIES, VERIFY_MODES, type VerifyOptions } from '../tools/unity/unity-verify/src/types';
import type { TestCounts } from '../tools/unity/gather-unity-context/src/gate';
import { parseFrontmatter } from '../tools/shared/registry/src/frontmatter';
import { validateContract } from '../tools/shared/registry/src/contract';

const repoRoot = resolve(import.meta.dir, '..');
const commandDir = join(repoRoot, 'xdomains', 'game-dev', 'unity-3d', 'command');
const schemaPath = join(repoRoot, 'xdomains', 'context', 'capability-contract.schema.json');
const bundle = join(repoRoot, 'xdomains', 'scripts', 'unity', 'unity-verify.mjs');

const SAFETY_GATE_KEYS = ['mutates', 'requiresEditor', 'requiresApproval', 'dryRunFirst', 'advisory'];

function assertSafetyGate(fm: Record<string, unknown>): void {
  const gate = fm.safetyGate;
  if (gate === undefined) return;
  expect(typeof gate).toBe('object');
  expect(Array.isArray(gate)).toBe(false);
  for (const [key, value] of Object.entries(gate as Record<string, unknown>)) {
    expect(SAFETY_GATE_KEYS).toContain(key);
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

  test('parses gate overrides and ignores invalid entries', () => {
    const overrides = parseGateOverrides('[{"gate":"build","status":"failed"},{"gate":"nope","status":"failed"}]');
    expect(overrides).toEqual([{ gate: 'build', status: 'failed', detail: undefined }]);
    expect(parseGateOverrides('not json')).toEqual([]);
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

describe('Verify command contracts', () => {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));

  test('declares exactly the four abilities', () => {
    expect(VERIFY_ABILITIES).toEqual([
      'compile-and-verify-project',
      'run-edit-mode-tests',
      'run-play-mode-tests',
      'gate-review',
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
});

describe('unity-verify bundle', () => {
  test('lists the four abilities', () => {
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
});
