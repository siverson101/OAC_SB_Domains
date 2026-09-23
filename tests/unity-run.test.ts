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
import {
  ABILITY_OPERATIONS,
  createCliChannel,
  resolveRuntimeChannel,
  runRuntimeAbility,
} from '../tools/unity/unity-run/src/runtime';
import { runRun } from '../tools/unity/unity-run/src/abilities';
import {
  RUN_ABILITIES,
  RUN_MODES,
  RUN_SAFETY_GATES,
  RUNTIME_ABILITIES,
  type RunOptions,
  type RuntimeChannel,
} from '../tools/unity/unity-run/src/types';
import type { TestCounts } from '../tools/unity/gather-unity-context/src/gate';
import { frontmatterStringArray, parseFrontmatter } from '../tools/shared/registry/src/frontmatter';
import { validateContract } from '../tools/shared/registry/src/contract';
import { SAFETY_GATE_KEYS } from '../tools/shared/safety-gate';

const repoRoot = resolve(import.meta.dir, '..');
const commandDir = join(repoRoot, 'xdomains', 'game-dev', 'unity-3d', 'command');
const schemaPath = join(repoRoot, 'xdomains', 'context', 'capability-contract.schema.json');
const bundle = join(repoRoot, 'xdomains', 'scripts', 'unity', 'unity-run.mjs');

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
    test(`${ability} reports unavailable and never throws`, async () => {
      const result = await runRuntimeAbility({ ...base, ability });
      expect(result.family).toBe('run');
      expect(result.status).toBe('unavailable');
      expect(result.route).toBe('offline');
      expect(result.data).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.safetyGate.requiresEditor).toBe(true);
      expect(result.command).toBeUndefined();
    });
  }

  test('a runtime ability reports the live mode', async () => {
    const result = await runRuntimeAbility({ ...base, ability: 'runtime-debugging' });
    expect(result.mode).toBe(RUN_MODES['runtime-debugging']);
    expect(result.mode).toBe('live');
  });

  test('an available channel without an invoke transport stays unavailable', async () => {
    const live: RuntimeChannel = { transport: 'cli', available: () => true };
    const result = await runRuntimeAbility({ ...base, live });
    expect(result.status).toBe('unavailable');
    expect(result.route).toBe('live');
    expect(result.transport).toBe('cli');
  });

  test('a throwing channel is treated as absent (fail-soft)', async () => {
    const live: RuntimeChannel = {
      transport: 'cli',
      available: () => {
        throw new Error('no channel');
      },
    };
    const result = await runRuntimeAbility({ ...base, live });
    expect(result.status).toBe('unavailable');
    expect(result.route).toBe('offline');
  });

  test('a live channel with a transport observes the result', async () => {
    const live: RuntimeChannel = {
      transport: 'cli',
      available: () => true,
      invoke: () => ({ ok: true, data: { logs: [] }, errors: [] }),
    };
    const result = await runRuntimeAbility({ ...base, live, operation: 'get_logs' });
    expect(result.status).toBe('observed_locally');
    expect(result.route).toBe('live');
    expect(result.data).toEqual({ logs: [] });
  });

  test('an async transport is awaited', async () => {
    const live: RuntimeChannel = {
      transport: 'cli',
      available: () => true,
      invoke: async () => ({ ok: true, data: { logs: ['async'] }, errors: [] }),
    };
    const result = await runRuntimeAbility({ ...base, live, operation: 'get_logs' });
    expect(result.status).toBe('observed_locally');
    expect(result.data).toEqual({ logs: ['async'] });
  });

  test('an unknown operation falls back to the default with an error', async () => {
    const result = await runRuntimeAbility({ ...base, operation: 'frobnicate' });
    expect(result.operation).toBe('get_logs');
    expect(result.errors.join(' ')).toContain('unknown --operation');
  });
});

describe('runtime CLI transport', () => {
  test('resolves no channel when the CLI is missing (fail-soft)', () => {
    expect(resolveRuntimeChannel(base)).toBeNull();
  });

  test('an injected channel wins over probing', () => {
    const live = createCliChannel('unity');
    expect(resolveRuntimeChannel({ ...base, live })).toBe(live);
    expect(resolveRuntimeChannel({ ...base, live: null })).toBeNull();
  });

  test('available reflects CLI presence by default, not a hard-coded true', () => {
    expect(createCliChannel('definitely-not-a-real-cli-xyz').available()).toBe(false);
    expect(createCliChannel('definitely-not-a-real-cli-xyz', undefined, { available: () => true }).available()).toBe(true);
  });

  test('selects the cli transport and parses a unity command round-trip', async () => {
    const calls: string[][] = [];
    const live = createCliChannel('unity', (command, args) => {
      calls.push([command, ...args]);
      return { ok: true, stdout: JSON.stringify({ success: true, data: { logs: [{ message: 'boom' }] } }), stderr: '', status: 0 };
    }, { available: () => true });
    const result = await runRuntimeAbility({ ...base, live, ability: 'runtime-debugging', operation: 'get_logs' });
    expect(result.status).toBe('observed_locally');
    expect(result.transport).toBe('cli');
    expect(result.data).toEqual({ logs: [{ message: 'boom' }] });
    expect(calls[0][0]).toBe('unity');
    expect(calls[0]).toContain('command');
    expect(calls[0]).toContain('get_logs');
    expect(calls[0]).toContain('--json');
  });

  test('routes execute-code through unity eval, not unity command', async () => {
    const calls: string[][] = [];
    const live = createCliChannel('unity', (_command, args) => {
      calls.push(args);
      return { ok: true, stdout: JSON.stringify({ success: true, data: { result: 2 } }), stderr: '', status: 0 };
    }, { available: () => true });
    const result = await runRuntimeAbility({
      ...base,
      live,
      operation: 'execute-code',
      code: 'return 1 + 1;',
      approveCodeExecution: true,
    });
    expect(result.status).toBe('observed_locally');
    expect(calls[0]).toContain('eval');
    expect(calls[0]).not.toContain('command');
  });

  test('malformed CLI output fails soft to failed (not unavailable)', async () => {
    const live = createCliChannel('unity', () => ({ ok: true, stdout: 'not json at all', stderr: '', status: 0 }), {
      available: () => true,
    });
    const result = await runRuntimeAbility({ ...base, live, operation: 'get_logs' });
    expect(result.status).toBe('failed');
    expect(result.route).toBe('live');
    expect(result.errors.join(' ')).toContain('malformed');
  });

  test('a non-zero CLI exit fails soft to failed and preserves the partial payload', async () => {
    const live = createCliChannel(
      'unity',
      () => ({
        ok: false,
        stdout: JSON.stringify({ success: false, data: { logs: [{ message: 'partial' }] }, errors: [{ message: 'no live player' }] }),
        stderr: '',
        status: 1,
      }),
      { available: () => true }
    );
    const result = await runRuntimeAbility({ ...base, live, operation: 'get_logs' });
    expect(result.status).toBe('failed');
    expect(result.errors.join(' ')).toContain('no live player');
    expect(result.data).toEqual({ logs: [{ message: 'partial' }] });
  });

  test('a throwing CLI runner fails soft to failed (not unavailable)', async () => {
    const live = createCliChannel(
      'unity',
      () => {
        throw new Error('spawn failed');
      },
      { available: () => true }
    );
    const result = await runRuntimeAbility({ ...base, live, operation: 'get_logs' });
    expect(result.status).toBe('failed');
    expect(result.errors.join(' ')).toContain('spawn failed');
  });
});

describe('runtime safetyGate matches the declared contract', () => {
  const live: RuntimeChannel = {
    transport: 'cli',
    available: () => true,
    invoke: () => ({ ok: true, data: { logs: [] }, errors: [] }),
  };

  test('RUN_SAFETY_GATES mirrors the declared frontmatter for each Run ability', () => {
    for (const ability of RUN_ABILITIES) {
      const fm = parseFrontmatter(readFileSync(join(commandDir, `${ability}.md`), 'utf8'));
      const declared = fm.safetyGate as Record<string, unknown>;
      const runtime = RUN_SAFETY_GATES[ability];
      for (const key of ['requiresEditor', 'requiresApproval'] as const) {
        if (typeof declared[key] === 'boolean') expect(runtime[key], `${ability}.${key}`).toBe(declared[key]);
      }
    }
  });

  test('every emitted runtime gate is within the declared ability gate', async () => {
    for (const ability of RUNTIME_ABILITIES) {
      const declared = RUN_SAFETY_GATES[ability];
      for (const operation of ABILITY_OPERATIONS[ability]) {
        const result = await runRuntimeAbility({ ...base, ability, operation, live });
        for (const key of Object.keys(result.safetyGate)) {
          expect(SAFETY_GATE_KEYS as readonly string[]).toContain(key);
        }
        if (result.safetyGate.requiresEditor) expect(declared.requiresEditor, `${ability}/${operation} requiresEditor`).toBe(true);
        if (result.safetyGate.requiresApproval) expect(declared.requiresApproval, `${ability}/${operation} requiresApproval`).toBe(true);
      }
    }
  });
});

describe('Run ability ownership and composed command gates', () => {
  test('unity-change-loop is a Run ability, not a Compose command', () => {
    const fm = parseFrontmatter(readFileSync(join(commandDir, 'unity-change-loop.md'), 'utf8'));
    expect(fm.family).toBe('run');
    expect(RUN_ABILITIES).toContain('unity-change-loop');
  });

  test('a command may declare a stricter gate than the abilities it composes', () => {
    const fm = parseFrontmatter(readFileSync(join(commandDir, 'unity-implement.md'), 'utf8'));
    expect(frontmatterStringArray(fm, 'uses') ?? []).toContain('unity-change-loop');
    const commandGate = fm.safetyGate as Record<string, unknown>;
    const abilityGate = RUN_SAFETY_GATES['unity-change-loop'];
    // Superset rule: every flag the composed ability requires, the composing
    // command must also require. The reverse is allowed — a command may be
    // stricter than the abilities it composes, never weaker.
    for (const key of ['requiresEditor', 'requiresApproval'] as const) {
      if (abilityGate[key]) expect(commandGate[key], `unity-implement.${key}`).toBe(true);
    }
    // The deliberate mismatch: the read-only ability needs neither, while the
    // implementing command edits assets and drives the Editor.
    expect(abilityGate).toEqual({ requiresEditor: false, requiresApproval: false });
    expect(commandGate.requiresEditor).toBe(true);
    expect(commandGate.requiresApproval).toBe(true);
  });
});

describe('runtime code execution approval gate', () => {
  const live: RuntimeChannel = {
    transport: 'cli',
    available: () => true,
    invoke: () => ({ ok: true, data: { result: 2 }, errors: [] }),
  };

  test('refuses execute-code without explicit approval, even with a channel', async () => {
    const result = await runRuntimeAbility({
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
    expect(result.command).toBeUndefined();
  });

  test('is unavailable (not executed) with approval but no channel', async () => {
    const result = await runRuntimeAbility({
      ...base,
      live: null,
      operation: 'execute-code',
      code: 'return 1 + 1;',
      approveCodeExecution: true,
    });
    expect(result.status).toBe('unavailable');
    expect(result.approval?.allowed).toBe(true);
    expect(result.command).toBeUndefined();
  });

  test('runs execute-code with approval and a live channel', async () => {
    const result = await runRuntimeAbility({
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

  test('refuses execute-code without code', async () => {
    const result = await runRuntimeAbility({
      ...base,
      live,
      operation: 'execute-code',
      approveCodeExecution: true,
    });
    expect(result.status).toBe('refused');
    expect(result.errors.join(' ')).toContain('--code');
    expect(result.command).toBeUndefined();
  });
});

describe('run dispatcher', () => {
  test('routes the change loop and runtime abilities', async () => {
    const loop = await runRun({ ...base, ability: 'unity-change-loop' });
    expect(loop.ability).toBe('unity-change-loop');
    expect(loop.family).toBe('run');
    expect(loop.mode).toBe('offline');

    const runtime = await runRun({ ...base, ability: 'ui-interaction' });
    expect(runtime.ability).toBe('ui-interaction');
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
      'ui-interaction',
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
