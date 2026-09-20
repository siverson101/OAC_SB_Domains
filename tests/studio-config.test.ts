import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadPatternCatalog } from '../tools/unity/studio-config/src/catalog';
import { defaultStudioConfig, loadStudioConfig, parseStudioConfig } from '../tools/unity/studio-config/src/config';
import { resolveStudioConfig } from '../tools/unity/studio-config/src/resolver';
import type { PatternCatalog, StudioConfig } from '../tools/unity/studio-config/src/types';
import { buildRegistry } from '../tools/shared/registry/src/build';
import { renderRegistry } from '../tools/shared/registry/src/render';
import { findPatternCatalog } from '../tools/shared/context-files';

const repoRoot = resolve(import.meta.dir, '..');
const unity3dDir = join(repoRoot, 'xdomains', 'game-dev', 'unity-3d');
const catalogPath = join(repoRoot, 'xdomains', 'context', 'programming-patterns.json');
const bundle = join(repoRoot, 'xdomains', 'scripts', 'unity', 'studio-config.mjs');

function config(overrides: Partial<StudioConfig> = {}): StudioConfig {
  return { ...defaultStudioConfig(), ...overrides };
}

function withTempDir<T>(run: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'oac-studio-config-'));
  try {
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function writeConfig(dir: string, value: unknown): string {
  const path = join(dir, 'unity-studio.json');
  writeFileSync(path, JSON.stringify(value));
  return path;
}

describe('studio config schema', () => {
  test('parses a valid config into the typed shape', () => {
    const { config: parsed, problems } = parseStudioConfig({
      schemaVersion: 1,
      studioMode: 'full',
      reviewIntensity: 'solo',
      toggles: { tdd: true, ftf: false },
      patterns: ['tdd', 'factory'],
      packages: ['com.unity.inputsystem'],
    });
    expect(problems).toEqual([]);
    expect(parsed).toEqual({
      schemaVersion: 1,
      studioMode: 'full',
      reviewIntensity: 'solo',
      toggles: { tdd: true, ftf: false },
      patterns: ['tdd', 'factory'],
      packages: ['com.unity.inputsystem'],
    });
  });

  test('defaults to lean / full / toggles off when fields are absent', () => {
    const { config: parsed, problems } = parseStudioConfig({});
    expect(problems).toEqual([]);
    expect(parsed.studioMode).toBe('lean');
    expect(parsed.reviewIntensity).toBe('full');
    expect(parsed.toggles).toEqual({ tdd: false, ftf: false });
    expect(parsed.patterns).toEqual([]);
  });

  test('reports invalid enums, wrong types and unknown keys without throwing', () => {
    const { config: parsed, problems } = parseStudioConfig({
      studioMode: 'wide',
      reviewIntensity: 'max',
      toggles: { tdd: 'yes', extra: true },
      patterns: 'tdd',
      packages: [1, 'com.x'],
      bogus: 1,
    });
    const fields = problems.map((problem) => problem.field).sort();
    expect(fields).toContain('studioMode');
    expect(fields).toContain('reviewIntensity');
    expect(fields).toContain('toggles.tdd');
    expect(fields).toContain('toggles.extra');
    expect(fields).toContain('patterns');
    expect(fields).toContain('packages');
    expect(fields).toContain('bogus');
    expect(parsed.studioMode).toBe('lean');
    expect(parsed.reviewIntensity).toBe('full');
    expect(parsed.toggles).toEqual({ tdd: false, ftf: false });
    expect(parsed.patterns).toEqual([]);
    expect(parsed.packages).toEqual(['com.x']);
  });

  test('deduplicates pattern and package ids', () => {
    const { config: parsed } = parseStudioConfig({ patterns: ['a', 'a', 'b'], packages: ['p', 'p'] });
    expect(parsed.patterns).toEqual(['a', 'b']);
    expect(parsed.packages).toEqual(['p']);
  });

  test('flags an unsupported schemaVersion but still returns a config', () => {
    const { config: parsed, problems } = parseStudioConfig({ schemaVersion: 999 });
    expect(problems).toEqual([{ field: 'schemaVersion', message: 'unsupported schema version 999, expected 1' }]);
    expect(parsed.schemaVersion).toBe(1);
  });
});

describe('studio config loader', () => {
  test('a missing file is not an error', () => {
    withTempDir((dir) => {
      const load = loadStudioConfig(join(dir, 'unity-studio.json'));
      expect(load.present).toBe(false);
      expect(load.problems).toEqual([]);
      expect(load.config).toEqual(defaultStudioConfig());
    });
  });

  test('malformed JSON is reported and falls back to defaults', () => {
    withTempDir((dir) => {
      const path = join(dir, 'unity-studio.json');
      writeFileSync(path, '{ not json');
      const load = loadStudioConfig(path);
      expect(load.present).toBe(true);
      expect(load.problems).toHaveLength(1);
      expect(load.problems[0].message).toContain('invalid JSON');
      expect(load.config).toEqual(defaultStudioConfig());
    });
  });

  test('a valid file is loaded from disk', () => {
    withTempDir((dir) => {
      const path = writeConfig(dir, { studioMode: 'full', patterns: ['factory'] });
      const load = loadStudioConfig(path);
      expect(load.present).toBe(true);
      expect(load.problems).toEqual([]);
      expect(load.config.studioMode).toBe('full');
      expect(load.config.patterns).toEqual(['factory']);
    });
  });
});

describe('domain default config', () => {
  test('ships unity-studio.json that parses with no problems', () => {
    const path = join(unity3dDir, 'unity-studio.json');
    expect(existsSync(path)).toBe(true);
    const load = loadStudioConfig(path);
    expect(load.present).toBe(true);
    expect(load.problems).toEqual([]);
    expect(load.config.studioMode).toBe('lean');
    expect(load.config.reviewIntensity).toBe('full');
    expect(load.config.toggles).toEqual({ tdd: false, ftf: false });
  });
});

describe('pattern resolver against the real catalog', () => {
  const catalog = loadPatternCatalog(catalogPath) as PatternCatalog;

  test('the catalog loads with its conflict edges', () => {
    expect(catalog.patterns?.length).toBeGreaterThan(0);
    expect(catalog.categories?.length).toBeGreaterThan(0);
  });

  test('a compatible set passes with no conflicts', () => {
    const resolved = resolveStudioConfig(config({ patterns: ['dependency-injection', 'factory', 'observer'] }), catalog);
    expect(resolved.valid).toBe(true);
    expect(resolved.conflicts).toEqual([]);
    expect(resolved.problems).toEqual([]);
  });

  test('a real conflictsWith edge (observer/event-bus) is surfaced', () => {
    const resolved = resolveStudioConfig(config({ patterns: ['observer', 'event-bus'] }), catalog);
    expect(resolved.valid).toBe(false);
    const conflict = resolved.conflicts.find((entry) => entry.kind === 'conflictsWith');
    expect(conflict).toBeDefined();
    expect(conflict?.patterns).toEqual(['event-bus', 'observer']);
  });

  test('single-selection categories reject two enabled patterns', () => {
    const resolved = resolveStudioConfig(config({ patterns: ['dependency-injection', 'service-locator'] }), catalog);
    expect(resolved.valid).toBe(false);
    const single = resolved.conflicts.find((entry) => entry.kind === 'single-selection');
    expect(single?.category).toBe('dependency-resolution');
    expect(single?.patterns).toEqual(['dependency-injection', 'service-locator']);
  });

  test('mutually-exclusive categories reject a combination', () => {
    const resolved = resolveStudioConfig(config({ patterns: ['ecs', 'mvc'] }), catalog);
    expect(resolved.valid).toBe(false);
    const exclusive = resolved.conflicts.find((entry) => entry.kind === 'mutually-exclusive');
    expect(exclusive?.category).toBe('architecture');
    expect(exclusive?.patterns).toEqual(['ecs', 'mvc']);
  });

  test('conflicting patterns are never silently dropped', () => {
    const resolved = resolveStudioConfig(config({ patterns: ['tdd', 'bdd'] }), catalog);
    expect(resolved.enabledPatterns).toEqual(['tdd', 'bdd']);
    expect(resolved.conflicts.length).toBeGreaterThan(0);
  });

  test('unknown pattern ids are reported as problems, not conflicts', () => {
    const resolved = resolveStudioConfig(config({ patterns: ['factory', 'does-not-exist'] }), catalog);
    expect(resolved.valid).toBe(false);
    expect(resolved.problems.some((problem) => problem.message.includes('does-not-exist'))).toBe(true);
    expect(resolved.conflicts).toEqual([]);
  });

  test('groups enabled patterns by category', () => {
    const resolved = resolveStudioConfig(config({ patterns: ['dependency-injection', 'factory'] }), catalog);
    expect(resolved.byCategory['dependency-resolution']).toEqual(['dependency-injection']);
    expect(resolved.byCategory['object-creation']).toEqual(['factory']);
  });
});

describe('pattern resolver with a synthetic catalog', () => {
  const synthetic: PatternCatalog = {
    categories: [
      { id: 'single-cat', selection: 'single', patterns: ['a', 'b'] },
      { id: 'me-cat', selection: 'multiple', mutuallyExclusive: true, patterns: ['c', 'd'] },
    ],
    patterns: [
      { id: 'a', category: 'single-cat', conflictsWith: ['b'] },
      { id: 'b', category: 'single-cat', conflictsWith: ['a'] },
      { id: 'c', category: 'me-cat' },
      { id: 'd', category: 'me-cat' },
    ],
  };

  test('single selection fires for a single-selection category', () => {
    const resolved = resolveStudioConfig(config({ patterns: ['a', 'b'] }), synthetic);
    const kinds = resolved.conflicts.map((entry) => entry.kind);
    expect(kinds).toContain('single-selection');
    expect(kinds).not.toContain('mutually-exclusive');
  });

  test('mutual exclusion fires for a multiple-selection category', () => {
    const resolved = resolveStudioConfig(config({ patterns: ['c', 'd'] }), synthetic);
    const kinds = resolved.conflicts.map((entry) => entry.kind);
    expect(kinds).toContain('mutually-exclusive');
    expect(kinds).not.toContain('single-selection');
  });

  test('symmetric conflictsWith edges are reported once', () => {
    const resolved = resolveStudioConfig(config({ patterns: ['a', 'b'] }), synthetic);
    const edgeConflicts = resolved.conflicts.filter((entry) => entry.kind === 'conflictsWith');
    expect(edgeConflicts).toHaveLength(1);
  });

  test('a pattern that declares its own category augments the category membership list', () => {
    const augmented: PatternCatalog = {
      categories: [{ id: 'cat', selection: 'single', patterns: ['a', 'b'] }],
      patterns: [
        { id: 'a', category: 'cat' },
        { id: 'b', category: 'cat' },
        { id: 'c', category: 'cat' },
      ],
    };
    const resolved = resolveStudioConfig(config({ patterns: ['a', 'b', 'c'] }), augmented);
    expect(resolved.byCategory['cat']).toEqual(['a', 'b', 'c']);
    const single = resolved.conflicts.find((entry) => entry.kind === 'single-selection');
    expect(single?.patterns).toEqual(['a', 'b', 'c']);
  });
});

describe('registry studio config integration', () => {
  test('surfaces the domain default config when no .opencode dir is given', () => {
    const registry = buildRegistry(unity3dDir, '2026-09-20T00:00:00.000Z');
    expect(registry.studioConfig.present).toBe(true);
    expect(registry.studioConfig.path).toBe(join(unity3dDir, 'unity-studio.json'));
    expect(registry.studioConfig.studioMode).toBe('lean');
    expect(registry.studioConfig.reviewIntensity).toBe('full');
    expect(registry.studioConfig.toggles).toEqual({ tdd: false, ftf: false });
    expect(registry.studioConfig.patterns).toEqual([]);
    expect(registry.studioConfig.valid).toBe(true);
    // The catalog is found via the `domainDir` candidate, so no catalog problem
    // is reported (`patterns: []` means there are no conflicts either way).
    expect(registry.studioConfig.problems).toEqual([]);
    expect(renderRegistry(registry)).toContain('## Studio Config');
  });

  test('the domainDir candidate resolves the repo-layout catalog', () => {
    expect(findPatternCatalog({ domainDir: unity3dDir })).toBe(catalogPath);
  });

  test('surfaces enabled patterns, toggles and mode from .opencode/unity-studio.json', () => {
    withTempDir((dir) => {
      writeConfig(dir, {
        studioMode: 'full',
        reviewIntensity: 'lean',
        toggles: { tdd: true, ftf: true },
        patterns: ['dependency-injection', 'factory'],
        packages: ['com.unity.inputsystem'],
      });
      const registry = buildRegistry(unity3dDir, '2026-09-20T00:00:00.000Z', dir);
      expect(registry.studioConfig.present).toBe(true);
      expect(registry.studioConfig.studioMode).toBe('full');
      expect(registry.studioConfig.reviewIntensity).toBe('lean');
      expect(registry.studioConfig.toggles).toEqual({ tdd: true, ftf: true });
      expect(registry.studioConfig.patterns).toEqual(['dependency-injection', 'factory']);
      expect(registry.studioConfig.packages).toEqual(['com.unity.inputsystem']);
      expect(registry.studioConfig.valid).toBe(true);
      expect(registry.counts.studioPatterns).toBe(2);

      const md = renderRegistry(registry);
      expect(md).toContain('`dependency-injection`');
      expect(md).toContain('tdd=true');
    });
  });

  test('surfaces conflicts rather than picking a winner', () => {
    withTempDir((dir) => {
      writeConfig(dir, { patterns: ['observer', 'event-bus'] });
      const registry = buildRegistry(unity3dDir, '2026-09-20T00:00:00.000Z', dir);
      expect(registry.studioConfig.present).toBe(true);
      expect(registry.studioConfig.patterns).toEqual(['observer', 'event-bus']);
      expect(registry.studioConfig.valid).toBe(false);
      expect(registry.studioConfig.conflicts.some((entry) => entry.kind === 'conflictsWith')).toBe(true);
      const md = renderRegistry(registry);
      expect(md).toContain('### Pattern conflicts');
    });
  });

  test('an unsupported schemaVersion makes the resolved config invalid', () => {
    withTempDir((dir) => {
      writeConfig(dir, { schemaVersion: 999 });
      const registry = buildRegistry(unity3dDir, '2026-09-20T00:00:00.000Z', dir);
      expect(registry.studioConfig.valid).toBe(false);
      expect(registry.studioConfig.problems.some((problem) => problem.field === 'schemaVersion')).toBe(true);
    });
  });
});

describe('studio-config CLI bundle', () => {
  test('reports conflicts for a config file and exits 0', () => {
    withTempDir((dir) => {
      writeConfig(dir, { patterns: ['tdd', 'bdd'] });
      const res = spawnSync(
        process.execPath,
        [bundle, '--opencode-dir', dir, '--catalog', catalogPath, '--json'],
        { encoding: 'utf8' }
      );
      expect(res.status).toBe(0);
      const parsed = JSON.parse(res.stdout);
      expect(parsed.present).toBe(true);
      expect(parsed.resolution.valid).toBe(false);
      expect(parsed.resolution.conflicts.length).toBeGreaterThan(0);
    });
  });

  test('falls back to defaults when no config is present', () => {
    withTempDir((dir) => {
      const res = spawnSync(
        process.execPath,
        [bundle, '--opencode-dir', dir, '--catalog', catalogPath, '--json'],
        { encoding: 'utf8' }
      );
      expect(res.status).toBe(0);
      const parsed = JSON.parse(res.stdout);
      expect(parsed.present).toBe(false);
      expect(parsed.resolution.valid).toBe(true);
      expect(parsed.resolution.config.studioMode).toBe('lean');
    });
  });

  test('discovers the catalog through the repo layout when --catalog is omitted', () => {
    const res = spawnSync(
      process.execPath,
      [bundle, '--opencode-dir', join(repoRoot, '.opencode'), '--json'],
      { encoding: 'utf8' }
    );
    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout);
    expect(parsed.catalogPath.replace(/\\/g, '/')).toContain('xdomains/context/programming-patterns.json');
    expect(parsed.resolution.problems.some((problem: { field: string }) => problem.field === 'catalog')).toBe(false);
  });

  test('--list prints nothing when the family declares no abilities', () => {
    const res = spawnSync(process.execPath, [bundle, '--list'], { encoding: 'utf8' });
    expect(res.status).toBe(0);
    expect(res.stdout).toBe('');
  });
});
