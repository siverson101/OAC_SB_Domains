import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ACT_ABILITIES, ACT_MODES, type ActOptions } from '../tools/unity/unity-act/src/types';
import { decideEscalation } from '../tools/unity/unity-act/src/escalation';
import { planActGate } from '../tools/unity/unity-act/src/gate';
import { patternLibrary } from '../tools/unity/unity-act/src/patterns';
import { prefabAutomation } from '../tools/unity/unity-act/src/prefab';
import { sceneEditing } from '../tools/unity/unity-act/src/scene';
import { inputAutomation, scriptScaffolding, shaderHelper } from '../tools/unity/unity-act/src/templates';
import { parseFrontmatter } from '../tools/shared/registry/src/frontmatter';
import { validateContract } from '../tools/shared/registry/src/contract';

const repoRoot = resolve(import.meta.dir, '..');
const commandDir = join(repoRoot, 'xdomains', 'game-dev', 'unity-3d', 'command');
const schemaPath = join(repoRoot, 'xdomains', 'context', 'capability-contract.schema.json');
const bundle = join(repoRoot, 'xdomains', 'scripts', 'unity', 'unity-act.mjs');

const SAFETY_GATE_KEYS = ['mutates', 'requiresEditor', 'requiresApproval', 'dryRunFirst', 'advisory', 'writesState'];

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

const STRUCTURAL_OPS = [
  { op: 'ensure_child', path: 'Player/HP' },
  { op: 'ensure_component', target: { path: 'Player/HP' }, typeName: 'Animator' },
  { op: 'set_property', target: { path: 'Player/HP', componentName: 'Animator' }, propertyName: 'm_Enabled', value: true },
];

const SINGLE_OPS = [{ op: 'set_property', target: { path: 'Player' }, propertyName: 'm_Name', value: 'Hero' }];

function write(path: string, body: string): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, body);
}

let fixture: string;
let projectRoot: string;
let opencodeDir: string;
let prefabPath: string;
let prefabContent: string;
let base: ActOptions;

beforeAll(() => {
  fixture = mkdtempSync(join(tmpdir(), 'oac-unity-act-'));
  projectRoot = join(fixture, 'project');
  opencodeDir = join(projectRoot, '.opencode');
  prefabPath = join(projectRoot, 'Assets', 'Prefabs', 'Player.prefab');
  prefabContent = '%YAML 1.1\n%TAG !u! tag:unity3d.com,2011:\n--- !u!1 &100\nGameObject:\n  m_Name: Player\n';
  write(prefabPath, prefabContent);

  base = {
    projectRoot,
    opencodeDir,
    ability: 'prefab-automation',
    json: true,
    list: false,
    dryRun: true,
    confirm: false,
    gate: false,
  };
});

afterAll(() => {
  try {
    rmSync(fixture, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

describe('prefab-automation dry run', () => {
  test('proposes ops and mutates nothing', () => {
    const result = prefabAutomation({
      ...base,
      prefab: 'Assets/Prefabs/Player.prefab',
      opsJson: JSON.stringify(STRUCTURAL_OPS),
    });

    expect(result.family).toBe('act');
    expect(result.runMode).toBe('dry-run');
    expect(result.status).toBe('proposed');
    expect(result.mutated).toBe(false);
    expect(result.opCount).toBe(3);
    expect(result.ops.map((op) => op.op)).toEqual(['ensure_child', 'ensure_component', 'set_property']);
    expect(result.changeKind).toBe('structural');
    expect(result.escalation.rung).toBe('prefab-patch');
    expect(result.escalation.requiresDryRun).toBe(true);
    expect(result.command).toContain('--dryRun true');
    expect(result.command).toContain('prefab patch');

    expect(readFileSync(prefabPath, 'utf8')).toBe(prefabContent);
    expect(existsSync(join(opencodeDir, 'project-data', 'act', 'prefab-dryrun.json'))).toBe(true);
  });

  test('escalates an unsupported op to the YAML fallback', () => {
    const result = prefabAutomation({
      ...base,
      prefab: 'Assets/Prefabs/Player.prefab',
      opsJson: JSON.stringify([{ op: 'frobnicate', path: 'Player' }]),
    });

    expect(result.status).toBe('unknown');
    expect(result.mutated).toBe(false);
    expect(result.unsupported).toEqual(['frobnicate']);
    expect(result.escalation.rung).toBe('unity-yaml-editing');
    expect(readFileSync(prefabPath, 'utf8')).toBe(prefabContent);
  });
});

describe('prefab-automation confirm gate', () => {
  test('refuses a non-dry run without confirm', () => {
    const result = prefabAutomation({
      ...base,
      dryRun: false,
      confirm: false,
      prefab: 'Assets/Prefabs/Player.prefab',
      opsJson: JSON.stringify(SINGLE_OPS),
    });

    expect(result.status).toBe('refused');
    expect(result.mutated).toBe(false);
    expect(result.errors.join(' ')).toContain('confirm');
    expect(readFileSync(prefabPath, 'utf8')).toBe(prefabContent);
  });

  test('refuses a confirmed write before a dry run', () => {
    const ops = [{ op: 'set_property', target: { path: 'Player' }, propertyName: 'm_TagString', value: 'Player' }];
    const result = prefabAutomation({
      ...base,
      dryRun: false,
      confirm: true,
      prefab: 'Assets/Prefabs/Player.prefab',
      opsJson: JSON.stringify(ops),
    });

    expect(result.status).toBe('refused');
    expect(result.mutated).toBe(false);
    expect(result.errors.join(' ')).toContain('dry');
  });

  test('is ready to apply after a recorded dry run and confirm', () => {
    const opsJson = JSON.stringify(STRUCTURAL_OPS);
    const dry = prefabAutomation({ ...base, prefab: 'Assets/Prefabs/Player.prefab', opsJson });
    expect(dry.status).toBe('proposed');

    const apply = prefabAutomation({
      ...base,
      dryRun: false,
      confirm: true,
      prefab: 'Assets/Prefabs/Player.prefab',
      opsJson,
    });
    expect(apply.status).toBe('ready');
    expect(apply.mutated).toBe(false);
    expect(apply.command).toContain('--dryRun false');
    expect(readFileSync(prefabPath, 'utf8')).toBe(prefabContent);
  });

  test('applies the same ops after a dry run in a different key order', () => {
    const dryOps = JSON.stringify([
      { op: 'set_property', target: { path: 'Player' }, propertyName: 'm_Enabled', value: true },
    ]);
    const reorderedOps = JSON.stringify([
      { value: true, propertyName: 'm_Enabled', target: { path: 'Player' }, op: 'set_property' },
    ]);

    const dry = prefabAutomation({ ...base, prefab: 'Assets/Prefabs/Player.prefab', opsJson: dryOps });
    expect(dry.status).toBe('proposed');

    const apply = prefabAutomation({
      ...base,
      dryRun: false,
      confirm: true,
      prefab: 'Assets/Prefabs/Player.prefab',
      opsJson: reorderedOps,
    });
    expect(apply.status).toBe('ready');
    expect(apply.patchId).toBe(dry.patchId);
    expect(readFileSync(prefabPath, 'utf8')).toBe(prefabContent);
  });

  test('refuses an apply whose payload differs from the recorded dry run', () => {
    const dryOps = JSON.stringify([
      { op: 'set_property', target: { path: 'Player' }, propertyName: 'm_Name', value: 'Hero' },
    ]);
    const applyOps = JSON.stringify([
      { op: 'set_property', target: { path: 'Player' }, propertyName: 'm_Name', value: 'Villain' },
    ]);

    const dry = prefabAutomation({ ...base, prefab: 'Assets/Prefabs/Player.prefab', opsJson: dryOps });
    expect(dry.status).toBe('proposed');

    const apply = prefabAutomation({
      ...base,
      dryRun: false,
      confirm: true,
      prefab: 'Assets/Prefabs/Player.prefab',
      opsJson: applyOps,
    });
    expect(apply.status).toBe('refused');
    expect(apply.mutated).toBe(false);
    expect(apply.errors.join(' ')).toContain('changed since the dry-run');
    expect(readFileSync(prefabPath, 'utf8')).toBe(prefabContent);
  });
});

describe('scene-editing escalation ladder', () => {
  test('single-property starts at the inspector rung', () => {
    const decision = decideEscalation({ changeKind: 'single-property' });
    expect(decision.rung).toBe('inspector');
    expect(decision.requiresDryRun).toBe(false);
    expect(decision.fallback).toBe('prefab-patch');
  });

  test('structural changes require a prefab-patch dry run', () => {
    const decision = decideEscalation({ changeKind: 'structural' });
    expect(decision.rung).toBe('prefab-patch');
    expect(decision.requiresDryRun).toBe(true);
    expect(decision.fallback).toBe('unity-yaml-editing');
  });

  test('unsupported changes fall through to YAML', () => {
    const decision = decideEscalation({ changeKind: 'multi-property', hasUnsupportedOps: true });
    expect(decision.rung).toBe('unity-yaml-editing');
    expect(decision.changeKind).toBe('unsupported');
  });

  test('the ability returns a decision without mutating', () => {
    const result = sceneEditing({ ...base, ability: 'scene-editing', changeKind: 'multi-property' });
    expect(result.family).toBe('act');
    expect(result.mutated).toBe(false);
    expect(result.escalation?.rung).toBe('prefab-patch');
  });

  test('an unknown change-kind is reported as unknown, not observed', () => {
    const result = sceneEditing({ ...base, ability: 'scene-editing', changeKind: 'frobnicate' });
    expect(result.status).toBe('unknown');
    expect(result.errors.join(' ')).toContain('unknown --change-kind');
  });

  test('an invalid change-kind yields no escalation decision', () => {
    const result = sceneEditing({ ...base, ability: 'scene-editing', changeKind: 'frobnicate' });
    expect(result.escalation).toBeNull();
    expect(result.requestedChangeKind).toBe('frobnicate');
  });
});

describe('pattern-library', () => {
  test('reads the shipped catalog', () => {
    const result = patternLibrary({ ...base, ability: 'pattern-library' });
    expect(result.family).toBe('act');
    expect(result.status).toBe('observed_locally');
    expect(result.table.source).toBe('bundle');
    expect(result.table.patternCount).toBe(34);
    expect(result.table.categoryCount).toBe(9);
  });

  test('selects a pattern with its conflicts', () => {
    const result = patternLibrary({ ...base, ability: 'pattern-library', pattern: 'tdd' });
    expect(result.selected?.id).toBe('tdd');
    expect(result.selected?.conflictsWith).toContain('bdd');
  });

  test('surfaces a conflict across an enabled set', () => {
    const result = patternLibrary({ ...base, ability: 'pattern-library', enabled: ['tdd', 'bdd'] });
    expect(result.conflicts.length).toBe(1);
    expect(result.conflicts[0].pattern).toBe('bdd');
    expect(result.conflicts[0].conflictsWith).toBe('tdd');
  });
});

describe('fresh templates', () => {
  test('script-scaffolding emits a fresh MonoBehaviour', () => {
    const result = scriptScaffolding({
      ...base,
      ability: 'script-scaffolding',
      template: 'monobehaviour',
      name: 'PlayerController',
      namespace: 'Game.Player',
    });
    expect(result.status).toBe('proposed');
    expect(result.written).toBe(false);
    expect(result.language).toBe('csharp');
    expect(result.fileName).toBe('PlayerController.cs');
    expect(result.content).toContain('namespace Game.Player');
    expect(result.content).toContain('class PlayerController : MonoBehaviour');
  });

  test('shader-helper emits a fresh URP shader', () => {
    const result = shaderHelper({ ...base, ability: 'shader-helper', template: 'urp-unlit', name: 'OacGlow' });
    expect(result.language).toBe('shaderlab');
    expect(result.content).toContain('Shader "OAC/URP/OacGlow"');
  });

  test('input-automation emits valid .inputactions JSON', () => {
    const result = inputAutomation({ ...base, ability: 'input-automation', template: 'input-actions', name: 'GameControls' });
    expect(result.fileName).toBe('GameControls.inputactions');
    const parsed = JSON.parse(result.content ?? '{}');
    expect(parsed.maps[0].name).toBe('Player');
  });

  test('writing a template needs confirm and a non-dry run', () => {
    const out = join(fixture, 'out');
    const dry = scriptScaffolding({ ...base, ability: 'script-scaffolding', name: 'Dry', out });
    expect(dry.status).toBe('proposed');
    expect(dry.written).toBe(false);
    expect(existsSync(join(out, 'Dry.cs'))).toBe(false);

    const refused = scriptScaffolding({ ...base, ability: 'script-scaffolding', name: 'Refused', out, dryRun: false });
    expect(refused.status).toBe('refused');
    expect(refused.written).toBe(false);

    const written = scriptScaffolding({
      ...base,
      ability: 'script-scaffolding',
      name: 'Written',
      out,
      dryRun: false,
      confirm: true,
    });
    expect(written.status).toBe('written');
    expect(written.written).toBe(true);
    expect(written.mutated).toBe(true);
    expect(existsSync(join(out, 'Written.cs'))).toBe(true);
  });
});

describe('act gate plan', () => {
  test('is not run unless opted in', () => {
    expect(planActGate(false, null).status).toBe('not_run');
  });

  test('is fail-soft without the Unity CLI', () => {
    const plan = planActGate(true, false);
    expect(plan.status).toBe('unavailable');
    expect(plan.errors.length).toBeGreaterThan(0);
  });

  test('plans the checkpoint/mutate/validate/delta gates with a CLI', () => {
    const plan = planActGate(true, true);
    expect(plan.status).toBe('planned');
    expect(plan.gates).toContain('compile');
    expect(plan.delta.join(' ')).toContain('newIssues');
  });
});

describe('Act command contracts', () => {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));

  test('declares exactly the six abilities', () => {
    expect(ACT_ABILITIES).toEqual([
      'scene-editing',
      'prefab-automation',
      'script-scaffolding',
      'shader-helper',
      'pattern-library',
      'input-automation',
    ]);
  });

  for (const ability of ACT_ABILITIES) {
    test(`${ability} has a valid Act contract`, () => {
      const fm = parseFrontmatter(readFileSync(join(commandDir, `${ability}.md`), 'utf8'));
      expect(fm.family).toBe('act');
      expect(fm.mode).toBe(ACT_MODES[ability]);
      expect(fm.id).toBe(ability);
      const result = validateContract(fm as Record<string, unknown>, schema);
      expect(result.errors).toEqual([]);
      assertSafetyGate(fm as Record<string, unknown>);
    });
  }

  test('prefab-automation declares writesState for its dry-run receipt', () => {
    const fm = parseFrontmatter(readFileSync(join(commandDir, 'prefab-automation.md'), 'utf8'));
    expect((fm.safetyGate as Record<string, unknown>).writesState).toBe(true);
  });
});

describe('unity-act bundle', () => {
  test('lists the six abilities', () => {
    const res = spawnSync(process.execPath, [bundle, '--list'], { encoding: 'utf8' });
    expect(res.status).toBe(0);
    expect(res.stdout.trim().split(/\r?\n/)).toEqual(ACT_ABILITIES);
  });

  test('emits JSON for an offline read', () => {
    const res = spawnSync(
      process.execPath,
      [bundle, '--project-root', projectRoot, '--opencode-dir', opencodeDir, '--ability', 'pattern-library', '--json'],
      { encoding: 'utf8' }
    );
    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout);
    expect(parsed.ability).toBe('pattern-library');
    expect(parsed.family).toBe('act');
    expect(parsed.table.source).toBe('bundle');
  });
});
