import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  acquireEditorHold,
  boardStatus,
  claimResource,
  emptyBoard,
  readBoard,
  releaseEditorHold,
  releaseResource,
  renderBoardMarkdown,
  runCoordinationBoard,
  writeBoard,
  type CoordinationBoard,
} from '../tools/unity/unity-compose/src/coordination-board';
import {
  analyzeComposition,
  discoverPrimitives,
  runPrimitiveComposition,
} from '../tools/unity/unity-compose/src/primitive-composition';
import { runContractAwareDesign } from '../tools/unity/unity-compose/src/contract-aware-design';
import { runCiStatusBaseline } from '../tools/unity/unity-compose/src/ci-status-baseline';
import { runCompose } from '../tools/unity/unity-compose/src/abilities';
import { parseYaml } from '../tools/unity/unity-compose/src/yaml';
import { COMPOSE_ABILITIES, COMPOSE_MODES, type ComposeOptions } from '../tools/unity/unity-compose/src/types';
import { parseFrontmatter } from '../tools/shared/registry/src/frontmatter';
import { validateContract } from '../tools/shared/registry/src/contract';

const repoRoot = resolve(import.meta.dir, '..');
const commandDir = join(repoRoot, 'xdomains', 'game-dev', 'unity-3d', 'command');
const schemaPath = join(repoRoot, 'xdomains', 'context', 'capability-contract.schema.json');
const bundle = join(repoRoot, 'xdomains', 'scripts', 'unity', 'unity-compose.mjs');

const T0 = '2026-01-01T00:00:00.000Z';
const T0B = '2026-01-01T00:00:30.000Z';
const T2 = '2026-01-01T00:20:00.000Z';

let fixture: string;
let base: ComposeOptions;

beforeAll(() => {
  fixture = mkdtempSync(join(tmpdir(), 'oac-unity-compose-'));
  base = {
    projectRoot: join(fixture, 'project'),
    opencodeDir: join(fixture, 'project', '.opencode'),
    ability: 'coordination-board',
    json: true,
    list: false,
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

describe('coordination board claims', () => {
  test('a conflicting claim fails fast naming the holder', () => {
    let board: CoordinationBoard = emptyBoard(T0);
    const first = claimResource(board, { resource: 'Assets/Player.cs', holder: 'implementer' }, T0);
    expect(first.ok).toBe(true);
    board = first.board;

    const second = claimResource(board, { resource: 'Assets/Player.cs', holder: 'qa' }, T0);
    expect(second.ok).toBe(false);
    expect(second.status).toBe('conflict');
    expect(second.errors.join(' ')).toContain('implementer');
    expect(second.board.claims).toHaveLength(1);
    expect(second.board.claims[0].holder).toBe('implementer');
  });

  test('the same holder renews its own claim', () => {
    const first = claimResource(emptyBoard(T0), { resource: 'Assets/Player.cs', holder: 'implementer', leaseSeconds: 60 }, T0);
    const renewed = claimResource(first.board, { resource: 'Assets/Player.cs', holder: 'implementer', leaseSeconds: 600 }, T0B);
    expect(renewed.ok).toBe(true);
    expect(renewed.summary).toContain('renewed');
    expect(renewed.board.claims).toHaveLength(1);
    expect(renewed.expiresAt).toBe('2026-01-01T00:10:30.000Z');
  });

  test('leases auto-expire, freeing the resource for another holder', () => {
    const first = claimResource(emptyBoard(T0), { resource: 'Assets/Player.cs', holder: 'implementer', leaseSeconds: 60 }, T0);
    expect(first.ok).toBe(true);

    const status = boardStatus(first.board, T2);
    expect(status.board.claims).toHaveLength(0);

    const second = claimResource(first.board, { resource: 'Assets/Player.cs', holder: 'qa', leaseSeconds: 60 }, T2);
    expect(second.ok).toBe(true);
    expect(second.board.claims[0].holder).toBe('qa');
  });

  test('a claim with waitSeconds queues until the short lease expires', () => {
    const oc = join(fixture, 'board-wait', '.opencode');
    const options = { ...base, ability: 'coordination-board' as const, opencodeDir: oc };

    const first = runCoordinationBoard({
      ...options,
      verb: 'claim',
      resource: 'Assets/Queue.cs',
      holder: 'implementer',
      leaseSeconds: 1,
    });
    expect(first.status).toBe('ok');

    const started = Date.now();
    const second = runCoordinationBoard({
      ...options,
      verb: 'claim',
      resource: 'Assets/Queue.cs',
      holder: 'qa',
      waitSeconds: 5,
    });
    const elapsed = Date.now() - started;

    expect(second.status).toBe('ok');
    expect(second.holder).toBe('qa');
    expect(second.board.claims).toHaveLength(1);
    expect(second.board.claims[0].holder).toBe('qa');
    expect(elapsed).toBeGreaterThanOrEqual(800);
    expect(elapsed).toBeLessThan(4000);
  });

  test('releasing another holder’s claim is a conflict', () => {
    const claimed = claimResource(emptyBoard(T0), { resource: 'Assets/Player.cs', holder: 'implementer' }, T0);
    const released = releaseResource(claimed.board, { resource: 'Assets/Player.cs', holder: 'qa' }, T0);
    expect(released.ok).toBe(false);
    expect(released.errors.join(' ')).toContain('implementer');

    const own = releaseResource(claimed.board, { resource: 'Assets/Player.cs', holder: 'implementer' }, T0);
    expect(own.ok).toBe(true);
    expect(own.board.claims).toHaveLength(0);
  });
});

describe('editor hold serialises one holder at a time', () => {
  test('a second holder cannot hold while the first holds', () => {
    const first = acquireEditorHold(emptyBoard(T0), { holder: 'qa', leaseSeconds: 300 }, T0);
    expect(first.ok).toBe(true);

    const second = acquireEditorHold(first.board, { holder: 'scene' }, T0);
    expect(second.ok).toBe(false);
    expect(second.status).toBe('conflict');
    expect(second.errors.join(' ')).toContain('qa');
    expect(second.board.editorHold?.holder).toBe('qa');
  });

  test('the hold can be released and re-acquired', () => {
    const held = acquireEditorHold(emptyBoard(T0), { holder: 'qa', leaseSeconds: 300 }, T0);
    const released = releaseEditorHold(held.board, { holder: 'qa' }, T0);
    expect(released.ok).toBe(true);
    expect(released.board.editorHold).toBeNull();

    const next = acquireEditorHold(released.board, { holder: 'scene' }, T0);
    expect(next.ok).toBe(true);
    expect(next.board.editorHold?.holder).toBe('scene');
  });

  test('an expired hold is pruned', () => {
    const held = acquireEditorHold(emptyBoard(T0), { holder: 'qa', leaseSeconds: 60 }, T0);
    const status = boardStatus(held.board, T2);
    expect(status.board.editorHold).toBeNull();
  });
});

describe('coordination board persistence', () => {
  test('writes board.json + board.md and reads them back', () => {
    const dir = join(fixture, 'board-persist');
    const claimed = claimResource(emptyBoard(T0), { resource: 'Assets/Scene.unity', holder: 'scene' }, T0);
    const held = acquireEditorHold(claimed.board, { holder: 'scene' }, T0);
    writeBoard(dir, held.board);

    expect(existsSync(join(dir, 'board.json'))).toBe(true);
    expect(existsSync(join(dir, 'board.md'))).toBe(true);

    const reloaded = readBoard(dir);
    expect(reloaded.claims).toHaveLength(1);
    expect(reloaded.claims[0].holder).toBe('scene');
    expect(reloaded.editorHold?.holder).toBe('scene');

    const markdown = readFileSync(join(dir, 'board.md'), 'utf8');
    expect(markdown).toContain('Assets/Scene.unity');
    expect(markdown).toContain('Editor hold');
  });

  test('an unreadable board reads as empty (fail-soft)', () => {
    const board = readBoard(join(fixture, 'does-not-exist'));
    expect(board.claims).toEqual([]);
    expect(board.editorHold).toBeNull();
  });

  test('renders a markdown projection', () => {
    const claimed = claimResource(emptyBoard(T0), { resource: 'Assets/A.cs', holder: 'impl', note: 'edit' }, T0);
    const markdown = renderBoardMarkdown(claimed.board);
    expect(markdown).toContain('| Assets/A.cs | impl |');
  });
});

describe('primitive-composition', () => {
  test('parses the primitive.yaml subset', () => {
    const parsed = parseYaml(
      [
        'id: jump',
        'summary: "Adds a jump"',
        'requires:',
        '  primitives:',
        '    - rigidbody',
        'wireThroughEvents: [on_jump]',
        'compatiblePrimitives: [ground-check]',
        'conflictsWith: [double-jump]',
      ].join('\n')
    );
    expect(parsed).toEqual({
      id: 'jump',
      summary: 'Adds a jump',
      requires: { primitives: ['rigidbody'] },
      wireThroughEvents: ['on_jump'],
      compatiblePrimitives: ['ground-check'],
      conflictsWith: ['double-jump'],
    });
  });

  test('builds the composition graph, conflicts and unresolved references', () => {
    const dir = join(fixture, 'primitives');
    mkdirSync(join(dir, 'jump'), { recursive: true });
    mkdirSync(join(dir, 'rigidbody'), { recursive: true });
    writeFileSync(
      join(dir, 'jump', 'primitive.yaml'),
      ['id: jump', 'requires:', '  primitives:', '    - rigidbody', '    - missing-one', 'conflictsWith: [double-jump]', 'wireThroughEvents: [on_jump]'].join('\n')
    );
    writeFileSync(join(dir, 'rigidbody', 'primitive.yaml'), 'id: rigidbody\nsummary: Physics body\n');

    const records = discoverPrimitives(dir);
    expect(records.map((record) => record.id)).toEqual(['jump', 'rigidbody']);

    const report = analyzeComposition(records);
    expect(report.edges.some((edge) => edge.kind === 'requires' && edge.from === 'jump' && edge.to === 'rigidbody')).toBe(true);
    expect(report.edges.some((edge) => edge.kind === 'event' && edge.to === 'on_jump')).toBe(true);
    expect(report.conflicts).toEqual([{ a: 'jump', b: 'double-jump', reason: 'declared conflictsWith' }]);
    expect(report.unresolved.join(' ')).toContain('missing-one');
    expect(report.cycles).toEqual([]);
  });

  test('detects dependency cycles', () => {
    const dir = join(fixture, 'primitives-cycle');
    mkdirSync(join(dir, 'a'), { recursive: true });
    mkdirSync(join(dir, 'b'), { recursive: true });
    writeFileSync(join(dir, 'a', 'primitive.yaml'), 'id: a\nrequires:\n  primitives:\n    - b\n');
    writeFileSync(join(dir, 'b', 'primitive.yaml'), 'id: b\nrequires:\n  primitives:\n    - a\n');
    const report = analyzeComposition(discoverPrimitives(dir));
    expect(report.cycles.length).toBeGreaterThan(0);
  });

  test('a missing primitives directory is unavailable, not thrown', () => {
    const result = runPrimitiveComposition({ ...base, ability: 'primitive-composition', primitivesDir: join(fixture, 'nope') });
    expect(result.status).toBe('unavailable');
    expect(result.report.primitives).toEqual([]);
    expect(result.family).toBe('compose');
  });

  test('runs against a real primitives directory', () => {
    const result = runPrimitiveComposition({ ...base, ability: 'primitive-composition', primitivesDir: join(fixture, 'primitives') });
    expect(result.status).toBe('observed_locally');
    expect(result.report.primitives).toHaveLength(2);
  });
});

describe('contract-aware-design', () => {
  test('flags valid and invalid capability contracts', () => {
    const dir = join(fixture, 'capabilities');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'good.md'),
      ['---', 'id: good', 'summary: A good capability', 'family: compose', 'mode: offline', '---', '', '# good'].join('\n')
    );
    writeFileSync(
      join(dir, 'bad.md'),
      ['---', 'summary: Missing an id', 'family: sensing', '---', '', '# bad'].join('\n')
    );

    const result = runContractAwareDesign({ ...base, ability: 'contract-aware-design', capabilitiesDir: dir, schema: schemaPath });
    expect(result.checked).toBe(2);
    expect(result.valid).toBe(1);
    expect(result.invalid).toBe(1);
    expect(result.status).toBe('observed_locally');
    const bad = result.results.find((check) => check.id === 'bad');
    expect(bad?.errors.join(' ')).toContain('missing required field: id');
    expect(bad?.errors.join(' ')).toContain('invalid family');
  });

  test('a missing schema is unavailable', () => {
    const result = runContractAwareDesign({ ...base, ability: 'contract-aware-design', schema: join(fixture, 'no-schema.json') });
    expect(result.status).toBe('unavailable');
  });
});

describe('ci-status-baseline', () => {
  function seedProjectData(oc: string, errorCount: number, failed: number): void {
    const dataDir = join(oc, 'project-data');
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, 'compile-state.json'), JSON.stringify({ status: 'observed_locally', assemblyCount: 1 }));
    writeFileSync(join(dataDir, 'log-digest.json'), JSON.stringify({ status: 'observed_locally', errorCount }));
    writeFileSync(
      join(dataDir, 'unity-verification-report.json'),
      JSON.stringify({ status: 'observed_locally', summary: { editMode: { total: 2, passed: 2 - failed, failed } } })
    );
  }

  test('records a green baseline and reads it back', () => {
    const oc = join(fixture, 'ci-green', '.opencode');
    seedProjectData(oc, 0, 0);
    const options = { ...base, ability: 'ci-status-baseline' as const, opencodeDir: oc };

    const recorded = runCiStatusBaseline({ ...options, verb: 'record' });
    expect(recorded.status).toBe('recorded');
    expect(recorded.baseline?.status).toBe('green');
    expect(existsSync(recorded.baselinePath)).toBe(true);

    const read = runCiStatusBaseline({ ...options, verb: 'read' });
    expect(read.status).toBe('ok');
    expect(read.baseline?.status).toBe('green');
  });

  test('a red baseline comes from errors or failing tests', () => {
    const oc = join(fixture, 'ci-red', '.opencode');
    seedProjectData(oc, 2, 1);
    const recorded = runCiStatusBaseline({ ...base, ability: 'ci-status-baseline', opencodeDir: oc, verb: 'record' });
    expect(recorded.baseline?.status).toBe('red');
  });

  test('reading a missing baseline is not_found, not thrown', () => {
    const read = runCiStatusBaseline({ ...base, ability: 'ci-status-baseline', opencodeDir: join(fixture, 'ci-empty', '.opencode') });
    expect(read.status).toBe('not_found');
    expect(read.baseline).toBeNull();
  });
});

describe('compose dispatcher', () => {
  test('routes each ability to its handler', () => {
    const board = runCompose({ ...base, ability: 'coordination-board', verb: 'status' });
    expect(board.ability).toBe('coordination-board');

    const composition = runCompose({ ...base, ability: 'primitive-composition', primitivesDir: join(fixture, 'primitives') });
    expect(composition.ability).toBe('primitive-composition');

    const contracts = runCompose({ ...base, ability: 'contract-aware-design', capabilitiesDir: join(fixture, 'capabilities'), schema: schemaPath });
    expect(contracts.ability).toBe('contract-aware-design');

    const ci = runCompose({ ...base, ability: 'ci-status-baseline' });
    expect(ci.ability).toBe('ci-status-baseline');
  });
});

describe('Compose command contracts', () => {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));

  test('declares exactly the four abilities', () => {
    expect(COMPOSE_ABILITIES).toEqual([
      'coordination-board',
      'primitive-composition',
      'contract-aware-design',
      'ci-status-baseline',
    ]);
  });

  for (const ability of COMPOSE_ABILITIES) {
    test(`${ability} has a valid Compose contract`, () => {
      const fm = parseFrontmatter(readFileSync(join(commandDir, `${ability}.md`), 'utf8'));
      expect(fm.family).toBe('compose');
      expect(fm.mode).toBe(COMPOSE_MODES[ability]);
      expect(fm.id).toBe(ability);
      const result = validateContract(fm as Record<string, unknown>, schema);
      expect(result.errors).toEqual([]);
    });
  }

  test('the coordination board is declared advisory', () => {
    const fm = parseFrontmatter(readFileSync(join(commandDir, 'coordination-board.md'), 'utf8'));
    const gate = fm.safetyGate as Record<string, unknown>;
    expect(gate.advisory).toBe('true');
  });
});

describe('unity-compose bundle', () => {
  test('lists the four abilities', () => {
    const res = spawnSync(process.execPath, [bundle, '--list'], { encoding: 'utf8' });
    expect(res.status).toBe(0);
    expect(res.stdout.trim().split(/\r?\n/)).toEqual(COMPOSE_ABILITIES);
    expect(existsSync(bundle)).toBe(true);
  });

  test('claims a resource and reports a fail-fast conflict over the CLI', () => {
    const oc = join(fixture, 'bundle-board', '.opencode');
    const run = (args: string[]): { status: number | null; stdout: string } =>
      spawnSync(process.execPath, [bundle, '--project-root', base.projectRoot, '--opencode-dir', oc, ...args], { encoding: 'utf8' });

    const first = run(['--ability', 'coordination-board', '--verb', 'claim', '--resource', 'Assets/X.cs', '--holder', 'implementer', '--json']);
    expect(first.status).toBe(0);
    expect(JSON.parse(first.stdout).status).toBe('ok');

    const second = run(['--ability', 'coordination-board', '--verb', 'claim', '--resource', 'Assets/X.cs', '--holder', 'qa', '--json']);
    expect(second.status).toBe(0);
    const parsed = JSON.parse(second.stdout);
    expect(parsed.status).toBe('conflict');
    expect(parsed.errors.join(' ')).toContain('implementer');
  });
});
