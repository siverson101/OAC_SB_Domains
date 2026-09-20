import { describe, expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SAFETY_GATE_KEYS, safetyGateFlag } from '../tools/shared/safety-gate';
import { runAct } from '../tools/unity/unity-act/src/abilities';
import { runCompose } from '../tools/unity/unity-compose/src/abilities';
import { runRun } from '../tools/unity/unity-run/src/abilities';
import { runSense } from '../tools/unity/unity-sense/src/abilities';
import { runVerify } from '../tools/unity/unity-verify/src/abilities';

describe('SAFETY_GATE_KEYS', () => {
  test('lists the six contract flags plus the runtime approved state', () => {
    expect(SAFETY_GATE_KEYS).toEqual([
      'mutates',
      'requiresEditor',
      'requiresApproval',
      'dryRunFirst',
      'advisory',
      'writesState',
      'approved',
    ]);
  });
});

describe('safetyGateFlag', () => {
  test('an absent flag is false, never unknown', () => {
    expect(safetyGateFlag({ mutates: true }, 'advisory')).toBe(false);
    expect(safetyGateFlag({}, 'writesState')).toBe(false);
  });

  test('a non-boolean value is false', () => {
    expect(safetyGateFlag({ mutates: 'true' }, 'mutates')).toBe(false);
    expect(safetyGateFlag({ mutates: 1 }, 'mutates')).toBe(false);
    expect(safetyGateFlag({ mutates: null }, 'mutates')).toBe(false);
  });

  test('a true flag is true', () => {
    expect(safetyGateFlag({ mutates: true }, 'mutates')).toBe(true);
  });

  test('a non-object gate is false', () => {
    expect(safetyGateFlag(undefined, 'mutates')).toBe(false);
    expect(safetyGateFlag(null, 'mutates')).toBe(false);
    expect(safetyGateFlag([], 'mutates')).toBe(false);
    expect(safetyGateFlag('mutates', 'mutates')).toBe(false);
  });
});

// The runtime `safetyGate` records emitted by the families must use the same
// canonical key set as the schema. This is the regression test that would have
// caught `requireConfirm`/`approved` leaking into the envelopes: it runs one
// ability from each family and asserts every emitted key is in SAFETY_GATE_KEYS.
describe('runtime safetyGate envelopes', () => {
  const projectRoot = join(tmpdir(), 'oac-safety-gate-missing', 'project');
  const opencodeDir = join(projectRoot, '.opencode');

  function assertCanonicalKeys(result: unknown): void {
    const gate = (result as { safetyGate?: unknown }).safetyGate;
    if (gate === undefined) return;
    expect(typeof gate).toBe('object');
    expect(Array.isArray(gate)).toBe(false);
    for (const key of Object.keys(gate as Record<string, unknown>)) {
      expect(SAFETY_GATE_KEYS as readonly string[]).toContain(key);
    }
  }

  test('each family emits only canonical safetyGate keys', async () => {
    const sense = runSense({ projectRoot, opencodeDir, ability: 'project-status', json: true, list: false });
    const act = runAct({
      projectRoot,
      opencodeDir,
      ability: 'pattern-library',
      json: true,
      list: false,
      dryRun: false,
      confirm: false,
      gate: false,
    });
    const verify = runVerify({
      projectRoot,
      opencodeDir,
      ability: 'gate-review',
      json: true,
      list: false,
      phase: 'validate',
      cliCommand: 'none',
      reviewIntensity: 'lean',
    });
    const run = await runRun({
      projectRoot,
      opencodeDir,
      ability: 'unity-change-loop',
      json: true,
      list: false,
      approveCodeExecution: false,
      live: null,
      cliCommand: 'none',
    });
    const compose = await runCompose({
      projectRoot,
      opencodeDir,
      ability: 'coordination-board',
      json: true,
      list: false,
      cliCommand: 'none',
    });

    for (const result of [sense, act, verify, run, compose]) assertCanonicalKeys(result);

    // Sense is read-only and carries no gate; the other four must emit one.
    expect((sense as { safetyGate?: unknown }).safetyGate).toBeUndefined();
    for (const result of [act, verify, run, compose]) {
      expect((result as { safetyGate?: unknown }).safetyGate).toBeDefined();
    }
  });
});
