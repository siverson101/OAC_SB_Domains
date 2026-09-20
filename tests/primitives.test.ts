import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  ALLOWED_LICENSES,
  classifyLicense,
  decideImport,
  normalizeLicense,
} from '../tools/unity/primitives/src/license-gate';
import { parsePrimitiveYaml, validateContract } from '../tools/unity/primitives/src/contract';
import { copyleftIds, parseProvenanceTable } from '../tools/unity/primitives/src/provenance';

const repoRoot = resolve(import.meta.dir, '..');
const unity3dDir = join(repoRoot, 'xdomains', 'game-dev', 'unity-3d');
const primitivesDir = join(unity3dDir, 'primitives');
const ledgerPath = join(unity3dDir, 'primitive-not-imported.md');

const EXPECTED_IMPORTED = [
  'arch.movement.2d',
  'csharp.collections.multidictionary',
  'csharp.gameplay.match3',
  'csharp.io.aseprite_parser',
  'csharp.math.dywa_pitch_tracker',
  'csharp.threading.disruptor',
  'csharp.utils.crc32',
  'unity.data.csv_parser',
  'unity.data.fastlz',
  'unity.entitas.coreloop',
  'unity.system.main_thread_dispatcher',
  'unity.system.object_pool',
].sort();

const GATED_COPYLEFT = [
  'unity.input.mouserotate',
  'unity.rendering.npr.starrail',
  'unity.rendering.toon.primotoon',
  'unity.simulation.aerodynamics_solver',
  'unity.system.kengine_logger',
];

const importedIds = readdirSync(primitivesDir)
  .filter((name) => statSync(join(primitivesDir, name)).isDirectory())
  .sort();

// The external `unity-skills` source registry is a sibling checkout, so it is
// absent in a bare clone. When present, the ledger is checked against every
// source primitive that was not imported.
const sourcePrimitivesDir =
  [
    process.env.OAC_UNITY_SKILLS_PRIMITIVES,
    join(repoRoot, '..', 'unity-skills', 'primitives'),
    join(repoRoot, 'unity-skills', 'primitives'),
  ]
    .filter((candidate): candidate is string => Boolean(candidate))
    .find((candidate) => existsSync(candidate)) ?? null;

describe('license gate', () => {
  test('allowlisted licenses are importable', () => {
    for (const license of ALLOWED_LICENSES) {
      const decision = decideImport({ id: 'example.primitive', license });
      expect(decision.verdict).toBe('allowed');
      expect(decision.importable).toBe(true);
    }
  });

  test('GPL and LGPL are gated out', () => {
    for (const license of ['GPL-3.0', 'LGPL-3.0', 'GPL-3.0-only', 'LGPL-3.0-or-later', 'AGPL-3.0']) {
      const decision = decideImport({ id: 'example.primitive', license });
      expect(decision.verdict).toBe('copyleft');
      expect(decision.importable).toBe(false);
      expect(decision.reason).toContain('copyleft');
    }
  });

  test('a missing or unrecognised license is skipped, not assumed permissive', () => {
    const missing = decideImport({ id: 'example.primitive' });
    expect(missing.verdict).toBe('unknown');
    expect(missing.importable).toBe(false);
    expect(missing.reason).toContain('no license');

    const unrecognised = decideImport({ id: 'example.primitive', license: 'CC-BY-NC-ND-4.0' });
    expect(unrecognised.verdict).toBe('unknown');
    expect(unrecognised.importable).toBe(false);
  });

  test('the stricter of the yaml and provenance licenses wins', () => {
    expect(decideImport({ id: 'x', license: 'MIT', provenanceLicense: 'GPL-3.0' }).importable).toBe(false);
    expect(decideImport({ id: 'x', license: 'GPL-3.0', provenanceLicense: 'MIT' }).importable).toBe(false);
    expect(decideImport({ id: 'x', license: 'MIT', provenanceLicense: 'MIT' }).importable).toBe(true);
  });

  test('normalisation strips the SPDX -only / -or-later suffix', () => {
    expect(normalizeLicense('GPL-3.0-only')).toBe('GPL-3.0');
    expect(normalizeLicense('Apache-2.0')).toBe('Apache-2.0');
    expect(classifyLicense('GPL-3.0-or-later')).toBe('copyleft');
  });
});

describe('provenance parser', () => {
  const fixture = [
    '| Primitive id | source_repo | License |',
    '|---|---|---|',
    '| unity.foo.bar | https://github.com/example/foo | MIT |',
    '| unity.baz.qux | https://github.com/example/baz | GPL-3.0 |',
    '| unity.broken | https://github.com/example/broken | Repo has no license |',
  ].join('\n');

  test('parses only the clean attributed rows', () => {
    const entries = parseProvenanceTable(fixture);
    expect(entries).toEqual([
      { id: 'unity.foo.bar', sourceRepo: 'https://github.com/example/foo', license: 'MIT' },
      { id: 'unity.baz.qux', sourceRepo: 'https://github.com/example/baz', license: 'GPL-3.0' },
    ]);
  });

  test('reports the copyleft ids', () => {
    expect(copyleftIds(fixture)).toEqual(['unity.baz.qux']);
  });
});

describe('primitive contract parser', () => {
  const fixture = [
    'id: unity.example.thing',
    'name: Example Thing',
    'category: example',
    'status: extracted',
    'summary: A wrapped',
    '  summary value.',
    'requires:',
    '  components:',
    '  - Rigidbody',
    'setup_steps:',
    '- Do the thing.',
    '- Do the other thing.',
    'code_files:',
    '- Scripts/Thing.cs',
    'source_repo: https://github.com/example/thing',
    'license: MIT',
  ].join('\n');

  test('extracts the identity fields and list fields', () => {
    const contract = parsePrimitiveYaml(fixture);
    expect(contract.id).toBe('unity.example.thing');
    expect(contract.summary).toBe('A wrapped summary value.');
    expect(contract.setupSteps).toEqual(['Do the thing.', 'Do the other thing.']);
    expect(contract.codeFiles).toEqual(['Scripts/Thing.cs']);
    expect(contract.sourceRepo).toBe('https://github.com/example/thing');
    expect(contract.license).toBe('MIT');
  });

  test('folds multi-line scalar sequence items instead of truncating them', () => {
    const contract = parsePrimitiveYaml(
      ['id: unity.example.thing', 'setup_steps:', '- Do the thing', '  and continue it.'].join('\n')
    );
    expect(contract.setupSteps).toEqual(['Do the thing and continue it.']);
  });

  test('validates required fields and the extracted-source rules', () => {
    expect(validateContract(parsePrimitiveYaml(fixture), 'unity.example.thing')).toEqual([]);

    const missing = fixture.replace('setup_steps:\n- Do the thing.\n- Do the other thing.\n', '');
    const issues = validateContract(parsePrimitiveYaml(missing), 'unity.example.thing');
    expect(issues.some((issue) => issue.field === 'setup_steps')).toBe(true);

    const mismatched = validateContract(parsePrimitiveYaml(fixture), 'unity.example.other');
    expect(mismatched.some((issue) => issue.field === 'id')).toBe(true);
  });
});

describe('imported primitives', () => {
  test('the on-disk set is exactly the reviewed sample', () => {
    expect(importedIds).toEqual(EXPECTED_IMPORTED);
  });

  for (const id of EXPECTED_IMPORTED) {
    const dir = join(primitivesDir, id);

    test(`${id} has a valid contract and license-clear code`, () => {
      const yamlPath = join(dir, 'primitive.yaml');
      expect(existsSync(yamlPath)).toBe(true);
      const contract = parsePrimitiveYaml(readFileSync(yamlPath, 'utf8'));

      expect(validateContract(contract, id)).toEqual([]);
      expect(contract.status).toBe('extracted');
      expect(classifyLicense(contract.license)).toBe('allowed');

      for (const codeFile of contract.codeFiles) {
        expect(existsSync(join(dir, codeFile))).toBe(true);
      }
    });
  }
});

describe('not-imported ledger', () => {
  const ledger = existsSync(ledgerPath) ? readFileSync(ledgerPath, 'utf8') : '';

  test('exists and explains the gate', () => {
    expect(ledger.length).toBeGreaterThan(500);
    expect(ledger.toLowerCase()).toContain('license-gate');
  });

  test('records every copyleft id', () => {
    for (const id of GATED_COPYLEFT) expect(ledger).toContain(`\`${id}\``);
  });

  test('no imported primitive is copyleft or listed as gated', () => {
    for (const id of importedIds) {
      expect(GATED_COPYLEFT).not.toContain(id);
    }
  });

  test('summarises the unattributed and no-usable-signal clusters', () => {
    expect(ledger).toContain('no usable signal');
    expect(ledger).toContain('license unclear');
    expect(ledger).toContain('authored');
  });

  if (sourcePrimitivesDir) {
    test('enumerates every source primitive that was not imported', () => {
      const sourceIds = readdirSync(sourcePrimitivesDir).filter((name) =>
        statSync(join(sourcePrimitivesDir, name)).isDirectory()
      );
      const imported = new Set(importedIds);
      const skipped = sourceIds.filter((id) => !imported.has(id));
      expect(skipped.length).toBeGreaterThan(0);
      const missing = skipped.filter((id) => !ledger.includes(`\`${id}\``));
      expect(missing).toEqual([]);
    });
  } else {
    test.skip('enumerates every source primitive that was not imported (source tree not found)', () => {});
  }
});
