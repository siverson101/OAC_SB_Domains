import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  CHANGE_LOOP_STAGES,
  citeEvidence,
  evaluateChangeLoop,
  type ChangeLoopEvidence,
} from '../tools/unity/unity-run/src/change-loop';
import { runRuntimeAbility } from '../tools/unity/unity-run/src/runtime';
import { runRun } from '../tools/unity/unity-run/src/abilities';
import {
  RUN_ABILITIES,
  RUN_MODES,
  RUNTIME_ABILITIES,
  type RunOptions,
  type RuntimeChannel,
} from '../tools/unity/unity-run/src/types';
import type { TestCounts } from '../tools/unity/gather-unity-context/src/gate';
import { parseFrontmatter } from '../tools/shared/registry/src/frontmatter';
import { validateContract } from '../tools/shared/registry/src/contract';

const repoRoot = resolve(import.meta.dir, '..');
const commandDir = join(repoRoot, 'xdomains', 'game-dev', 'unity-3d', 'command');
const schemaPath = join(repoRoot, 'xdomains', 'context', 'capability-contract.schema.json');
const bundle = join(repoRoot, 'xdomains', 'scripts', 'unity', 'unity-run.mjs');

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

const GREEN: ChangeLoopEvidence = {
  changeScope: 'fix Player jump height',
  compileState: { status: 'observed_locally', stale: false, noOpRecompile: null, assemblyCount: 1 },
  logDigest: { status: 'observed_locally', errorCount: 0 },
  testResults: {
    editMode: counts({ total: 3, passed: 3 }),
    playMode: counts({ total: 1, passed: 1 }),
  },
  screenshot: { path: 'project-data/run/screenshot.json', captured: true },
};

let fixture: string;
let base: RunOptions;

beforeAll(() => {
  fixture = mkdtempSync(join(tmpdir(), 'oac-unity-run-'));
  base = {
    projectRoot: join(fixture, 'project'),
    opencodeDir: join(fixture, 'project', '.opencode'),
    ability: 'runtime-debugging',
    json: true,
    list: false,
    approveCodeExecution: false,
    live: null,
    cliCommand: 'definitely-not-a-real-cli-xyz',
  };
});

afterAll(() => {
  try {
    rmSync(fixture, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

describe('change loop stages', () => {
  test('codifies the seven stages in order', () => {
    expect(CHANGE_LOOP_STAGES.map((stage) => stage.name)).toEqual([
      'resolve',
      'inspect',
      'change',
      'compile',
      'logs',
      'tests',
      'observe',
    ]);
    expect(CHANGE_LOOP_STAGES.find((stage) => stage.name === 'tests')?.gate).toBe('tests');
  });
});

describe('change loop evidence and refusal logic', () => {
  test('declares done only when compile, logs and tests are green', () => {
    const result = evaluateChangeLoop(GREEN, 'done');
    expect(result.done).toBe(true);
    expect(result.status).toBe('done');
    expect(result.refusals).toEqual([]);
    expect(result.gates.find((gate) => gate.gate === 'tests')?.status).toBe('passed');
  });

  test('refuses "done" without green tests', () => {
    const result = evaluateChangeLoop(
      { ...GREEN, testResults: { editMode: counts({ total: 3, passed: 1, failed: 2 }) } },
      'done'
    );
    expect(result.done).toBe(false);
    expect(result.status).toBe('refused');
    expect(result.refusals.join(' ')).toContain('tests');
    expect(result.refusals.join(' ')).toContain('not green');
  });

  test('does not declare done when tests were never run', () => {
    const result = evaluateChangeLoop({ ...GREEN, testResults: null }, 'done');
    expect(result.done).toBe(false);
    expect(result.status).toBe('refused');
    expect(result.refusals.join(' ')).toContain('tests');
  });

  test('does not declare done when the logs report errors', () => {
    const result = evaluateChangeLoop({ ...GREEN, logDigest: { status: 'observed_locally', errorCount: 2 } }, 'done');
    expect(result.done).toBe(false);
    expect(result.refusals.join(' ')).toContain('log');
  });

  test('does not declare done when the compiler no-op’d', () => {
    const result = evaluateChangeLoop(
      { ...GREEN, compileState: { status: 'observed_locally', stale: false, noOpRecompile: true, assemblyCount: 1 } },
      'done'
    );
    expect(result.done).toBe(false);
    expect(result.refusals.join(' ')).toContain('compile');
  });

  test('an unclaimed incomplete loop is in progress, not refused', () => {
    const result = evaluateChangeLoop({ ...GREEN, testResults: null });
    expect(result.done).toBe(false);
    expect(result.status).toBe('in_progress');
    expect(result.refusals).toEqual([]);
  });

  test('cites every named piece of evidence', () => {
    const citations = citeEvidence(GREEN);
    expect(citations.map((citation) => citation.name)).toEqual([
      'change-scope',
      'compile-state',
      'logs',
      'tests',
      'screenshot',
    ]);
    expect(citations.every((citation) => citation.present)).toBe(true);

    const empty = citeEvidence({});
    expect(empty.every((citation) => !citation.present)).toBe(true);
  });
});

describe('runtime abilities fail soft without a live channel', () => {
  for (const ability of RUNTIME_ABILITIES) {
    test(`${ability} reports unavailable and never throws`, () => {
      const result = runRuntimeAbility({ ...base, ability });
      expect(result.family).toBe('run');
      expect(result.status).toBe('unavailable');
      expect(result.route).toBe('offline');
      expect(result.data).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.safetyGate.requiresEditor).toBe(true);
    });
  }

  test('an available channel without an invoke transport stays unavailable', () => {
    const live: RuntimeChannel = { transport: 'cli', available: () => true };
    const result = runRuntimeAbility({ ...base, live });
    expect(result.status).toBe('unavailable');
    expect(result.route).toBe('live');
    expect(result.transport).toBe('cli');
  });

  test('a throwing channel is treated as absent (fail-soft)', () => {
    const live: RuntimeChannel = {
      transport: 'cli',
      available: () => {
        throw new Error('no channel');
      },
    };
    const result = runRuntimeAbility({ ...base, live });
    expect(result.status).toBe('unavailable');
    expect(result.route).toBe('offline');
  });

  test('a live channel with a transport observes the result', () => {
    const live: RuntimeChannel = {
      transport: 'cli',
      available: () => true,
      invoke: () => ({ ok: true, data: { logs: [] }, errors: [] }),
    };
    const result = runRuntimeAbility({ ...base, live, operation: 'get_logs' });
    expect(result.status).toBe('observed_locally');
    expect(result.route).toBe('live');
    expect(result.data).toEqual({ logs: [] });
  });

  test('an unknown operation falls back to the default with an error', () => {
    const result = runRuntimeAbility({ ...base, operation: 'frobnicate' });
    expect(result.operation).toBe('get_logs');
    expect(result.errors.join(' ')).toContain('unknown --operation');
  });
});

describe('runtime code execution approval gate', () => {
  const live: RuntimeChannel = {
    transport: 'cli',
    available: () => true,
    invoke: () => ({ ok: true, data: { result: 2 }, errors: [] }),
  };

  test('refuses execute-code without explicit approval, even with a channel', () => {
    const result = runRuntimeAbility({
      ...base,
      live,
      operation: 'execute-code',
      code: 'return 1 + 1;',
      approveCodeExecution: false,
    });
    expect(result.status).toBe('refused');
    expect(result.approval?.required).toBe(true);
    expect(result.approval?.allowed).toBe(false);
    expect(result.errors.join(' ')).toContain('approval');
  });

  test('is unavailable (not executed) with approval but no channel', () => {
    const result = runRuntimeAbility({
      ...base,
      live: null,
      operation: 'execute-code',
      code: 'return 1 + 1;',
      approveCodeExecution: true,
    });
    expect(result.status).toBe('unavailable');
    expect(result.approval?.allowed).toBe(true);
  });

  test('runs execute-code with approval and a live channel', () => {
    const result = runRuntimeAbility({
      ...base,
      live,
      operation: 'execute-code',
      code: 'return 1 + 1;',
      approveCodeExecution: true,
    });
    expect(result.status).toBe('observed_locally');
    expect(result.route).toBe('live');
    expect(result.safetyGate.requiresApproval).toBe(true);
    expect(result.safetyGate.approved).toBe(true);
    expect(result.command).toContain('eval');
  });

  test('refuses execute-code without code', () => {
    const result = runRuntimeAbility({
      ...base,
      live,
      operation: 'execute-code',
      approveCodeExecution: true,
    });
    expect(result.status).toBe('refused');
    expect(result.errors.join(' ')).toContain('--code');
  });
});

describe('run dispatcher', () => {
  test('routes the change loop and runtime abilities', () => {
    const loop = runRun({ ...base, ability: 'unity-change-loop' });
    expect(loop.ability).toBe('unity-change-loop');
    expect(loop.family).toBe('run');

    const runtime = runRun({ ...base, ability: 'uitk-interaction' });
    expect(runtime.ability).toBe('uitk-interaction');
    expect(runtime.status).toBe('unavailable');
  });
});

describe('Run command contracts', () => {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));

  test('declares exactly the five abilities', () => {
    expect(RUN_ABILITIES).toEqual([
      'unity-change-loop',
      'runtime-debugging',
      'runtime-ui-validation',
      'performance-diagnostics',
      'uitk-interaction',
    ]);
  });

  for (const ability of RUN_ABILITIES) {
    test(`${ability} has a valid Run contract`, () => {
      const fm = parseFrontmatter(readFileSync(join(commandDir, `${ability}.md`), 'utf8'));
      expect(fm.family).toBe('run');
      expect(fm.mode).toBe(RUN_MODES[ability]);
      expect(fm.id).toBe(ability);
      const result = validateContract(fm as Record<string, unknown>, schema);
      expect(result.errors).toEqual([]);
      assertSafetyGate(fm as Record<string, unknown>);
    });
  }

  test('runtime code execution declares an approval safety gate', () => {
    const fm = parseFrontmatter(readFileSync(join(commandDir, 'runtime-debugging.md'), 'utf8'));
    const gate = fm.safetyGate as Record<string, unknown>;
    expect(gate.requiresEditor).toBe(true);
    expect(gate.requiresApproval).toBe(true);
  });
});

describe('unity-run bundle', () => {
  test('lists the five abilities', () => {
    const res = spawnSync(process.execPath, [bundle, '--list'], { encoding: 'utf8' });
    expect(res.status).toBe(0);
    expect(res.stdout.trim().split(/\r?\n/)).toEqual(RUN_ABILITIES);
    expect(existsSync(bundle)).toBe(true);
  });

  test('emits JSON for the change loop', () => {
    mkdirSync(base.projectRoot, { recursive: true });
    const res = spawnSync(
      process.execPath,
      [
        bundle,
        '--project-root',
        base.projectRoot,
        '--opencode-dir',
        base.opencodeDir,
        '--ability',
        'unity-change-loop',
        '--json',
      ],
      { encoding: 'utf8' }
    );
    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout);
    expect(parsed.ability).toBe('unity-change-loop');
    expect(parsed.family).toBe('run');
    expect(parsed.stages.length).toBe(7);
  });
});
