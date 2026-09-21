import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ENVELOPE_KEYS } from '../tools/shared/result-envelope';
import { parseFrontmatter } from '../tools/shared/registry/src/frontmatter';
import { runVerify } from '../tools/unity/unity-verify/src/abilities';
import { VERIFY_ABILITIES, type VerifyAbility, type VerifyOptions } from '../tools/unity/unity-verify/src/types';
import { runCompose } from '../tools/unity/unity-compose/src/abilities';
import { COMPOSE_ABILITIES, type ComposeAbility, type ComposeOptions } from '../tools/unity/unity-compose/src/types';

const repoRoot = resolve(import.meta.dir, '..');
const commandDir = join(repoRoot, 'xdomains', 'game-dev', 'unity-3d', 'command');
const schemaPath = join(repoRoot, 'xdomains', 'context', 'capability-contract.schema.json');
const primitivesDir = join(repoRoot, 'xdomains', 'game-dev', 'unity-3d', 'primitives');

function declaredOutputs(ability: string): Set<string> {
  const fm = parseFrontmatter(readFileSync(join(commandDir, `${ability}.md`), 'utf8'));
  const outputs = fm.outputs;
  return new Set(
    outputs && typeof outputs === 'object' && !Array.isArray(outputs) ? Object.keys(outputs) : []
  );
}

// A runtime envelope may emit the shared core plus any field declared in the
// command's frontmatter `outputs`. Anything else is contract drift: the runtime
// and the declaration must agree.
function assertDeclaredOutputs(ability: string, result: Record<string, unknown>): void {
  const allowed = new Set<string>([...ENVELOPE_KEYS, ...declaredOutputs(ability)]);
  for (const key of Object.keys(result)) {
    expect(allowed.has(key)).toBe(true);
  }
}

let fixture: string;
let verifyBase: VerifyOptions;
let composeBase: ComposeOptions;

beforeAll(() => {
  fixture = mkdtempSync(join(tmpdir(), 'oac-output-contract-'));
  const projectRoot = join(fixture, 'project');
  const opencodeDir = join(projectRoot, '.opencode');
  mkdirSync(opencodeDir, { recursive: true });

  // A TDD-on config so the TDD-gated abilities can reach their success shape.
  writeFileSync(
    join(opencodeDir, 'unity-studio.json'),
    JSON.stringify({ schemaVersion: 1, studioMode: 'lean', toggles: { tdd: true, ftf: true } })
  );
  // A failing test carrying the expected reason (the red step).
  writeFileSync(
    join(projectRoot, 'TestResults.xml'),
    [
      '<test-run start-time="2026-01-01 00:00:00Z">',
      '  <test-suite type="TestFixture">',
      '    <test-case name="RedTest" result="Failed">',
      '      <failure><message>expected boom happened</message></failure>',
      '    </test-case>',
      '  </test-suite>',
      '</test-run>',
    ].join('\n')
  );
  // A suite with one true duplicate (removal) and one parameterizable pair (merge).
  writeFileSync(
    join(projectRoot, 'tests.json'),
    JSON.stringify([
      { name: 'DupOne', condition: 'x > 1', assertion: 'Assert.AreEqual(1, x)' },
      { name: 'DupTwo', condition: 'x > 1', assertion: 'Assert.AreEqual(1, x)' },
      { name: 'ParamA', condition: 'y > 1', assertion: 'Assert.AreEqual(2, y)' },
      { name: 'ParamB', condition: 'y > 2', assertion: 'Assert.AreEqual(2, y)' },
    ])
  );

  verifyBase = {
    projectRoot,
    opencodeDir,
    ability: 'compile-and-verify-project',
    json: true,
    list: false,
    phase: 'validate',
    cliCommand: 'definitely-not-a-real-cli-xyz',
    reviewIntensity: 'full',
  };
  composeBase = {
    projectRoot,
    opencodeDir,
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

// Ability-appropriate options that drive each ability to a NON-refused shape, so
// the success/observed envelope is contract-checked too (the base pass only ever
// exercises the refuse/unavailable shape). Abilities that need a live Unity CLI
// still reach `unavailable`, which is a distinct non-refused shape.
const SUCCESS_VERIFY: Record<VerifyAbility, Partial<VerifyOptions>> = {
  'compile-and-verify-project': { changeScope: ['Assets'], phase: 'validate' },
  'run-edit-mode-tests': {},
  'run-play-mode-tests': {},
  'gate-review': {},
  'failing-test-first': { tdd: 'on', test: 'RedTest', expectedReason: 'expected boom', testResults: 'TestResults.xml' },
  'test-deduplication': { feature: 'demo', testsJson: 'tests.json' },
};

const SUCCESS_COMPOSE: Record<ComposeAbility, Partial<ComposeOptions>> = {
  'coordination-board': { verb: 'status' },
  'primitive-composition': { primitivesDir },
  'contract-aware-design': { capabilitiesDir: commandDir, schema: schemaPath },
  'ci-status-baseline': { source: 'output-contract-test' },
  'plan-feature': { feature: 'demo', testCases: 'a case', testability: 'PASS' },
  'test-plan': { feature: 'demo', planAbilities: ['compile-and-verify-project'], commandsDir: commandDir },
};

describe('Verify runtime output contract', () => {
  for (const ability of VERIFY_ABILITIES) {
    test(`${ability} emits only declared output keys`, () => {
      const result = runVerify({ ...verifyBase, ability });
      assertDeclaredOutputs(ability, result as unknown as Record<string, unknown>);
    });
  }
});

describe('Compose runtime output contract', () => {
  for (const ability of COMPOSE_ABILITIES) {
    test(`${ability} emits only declared output keys`, async () => {
      const result = await runCompose({ ...composeBase, ability });
      assertDeclaredOutputs(ability, result as unknown as Record<string, unknown>);
    });
  }
});

describe('Verify runtime output contract (non-refused shape)', () => {
  for (const ability of VERIFY_ABILITIES) {
    test(`${ability} success path emits only declared output keys`, () => {
      const result = runVerify({ ...verifyBase, ability, ...SUCCESS_VERIFY[ability] });
      const record = result as unknown as Record<string, unknown>;
      expect(record.status).not.toBe('refused');
      assertDeclaredOutputs(ability, record);
    });
  }
});

describe('Compose runtime output contract (non-refused shape)', () => {
  for (const ability of COMPOSE_ABILITIES) {
    test(`${ability} success path emits only declared output keys`, async () => {
      const result = await runCompose({ ...composeBase, ability, ...SUCCESS_COMPOSE[ability] });
      const record = result as unknown as Record<string, unknown>;
      expect(record.status).not.toBe('refused');
      assertDeclaredOutputs(ability, record);
    });
  }
});
