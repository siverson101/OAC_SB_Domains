// Agreement tests for the unavoidable duplication between the plain-JS apply
// engine (`xdomains/merge-domains.js`) and the TypeScript registry/studio-config
// side. The gating semantics must be identical on both sides; these tests are
// the single enforcement point (see docs/review-lessons.md #1).
import { describe, expect, test } from 'bun:test';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { nativeSubprojectPresent } from '../tools/shared/registry/src/build';
import { readFrontmatter, frontmatterString } from '../tools/shared/registry/src/frontmatter';
import {
  isGateEnabled,
  optionalPaths,
  selectActiveRoster,
  type StudioGates,
} from '../tools/unity/studio-config/src/roster';
import { STUDIO_MODES, type StudioMode } from '../tools/unity/studio-config/src/types';

const require = createRequire(import.meta.url);
const merge = require('../xdomains/merge-domains.js');

const repoRoot = resolve(import.meta.dir, '..');
const unity3dDir = join(repoRoot, 'xdomains', 'game-dev', 'unity-3d');

interface ModeRoster {
  agents?: string[];
  subagents?: string[];
  optional?: (string | { path?: string })[];
}

const manifest = JSON.parse(readFileSync(join(unity3dDir, 'sb-domain.json'), 'utf8')) as {
  studioModes?: Record<string, ModeRoster>;
};

function enabledByFor(rel: string): string | undefined {
  return frontmatterString(readFrontmatter(join(unity3dDir, rel)), 'enabledBy');
}

function canonicalFrom(
  source: ModeRoster,
  gates: StudioGates,
  enabledBy: (rel: string) => string | undefined
): { agents: string[]; subagents: string[] } {
  return selectActiveRoster(
    {
      agents: source.agents ?? [],
      subagents: source.subagents ?? [],
      optional: optionalPaths(source.optional),
    },
    gates,
    enabledBy
  );
}

function canonicalRoster(mode: StudioMode, gates: StudioGates): { agents: string[]; subagents: string[] } {
  return canonicalFrom(manifest.studioModes?.[mode] ?? {}, gates, enabledByFor);
}

const CONFIGS: { name: string; gates: StudioGates }[] = [
  { name: 'no gates', gates: { tdd: false, 'native-subproject': false } },
  { name: 'tdd on', gates: { tdd: true, 'native-subproject': false } },
  { name: 'native on', gates: { tdd: false, 'native-subproject': true } },
  { name: 'both on', gates: { tdd: true, 'native-subproject': true } },
];

// A synthetic manifest where BOTH modes carry an `optional` list (the shipped
// manifest only gates Lean). It exercises the string form, the legacy `{path}`
// object form, and an optional with no `enabledBy` (always active).
const SYNTHETIC_MODES: Record<StudioMode, ModeRoster> = {
  lean: {
    agents: ['agent/lean-orchestrator.md'],
    subagents: ['agent/subagents/lean-base.md'],
    optional: ['agent/subagents/lean-tdd.md', { path: 'agent/subagents/lean-native.md' }, 'agent/subagents/lean-always.md'],
  },
  full: {
    agents: ['agent/full-orchestrator.md'],
    subagents: ['agent/full-studio/full-base.md'],
    optional: ['agent/full-studio/full-tdd.md', { path: 'agent/full-studio/full-native.md' }, 'agent/full-studio/full-always.md'],
  },
};

const SYNTHETIC_ENABLED_BY: Record<string, string> = {
  'agent/subagents/lean-tdd.md': 'tdd',
  'agent/subagents/lean-native.md': 'native-subproject',
  'agent/full-studio/full-tdd.md': 'tdd',
  'agent/full-studio/full-native.md': 'native-subproject',
};

function syntheticEnabledByFor(rel: string): string | undefined {
  return SYNTHETIC_ENABLED_BY[rel];
}

describe('studio mode vocabulary agreement', () => {
  test('the apply engine and studio-config declare the same STUDIO_MODES', () => {
    expect([...merge.STUDIO_MODES]).toEqual([...STUDIO_MODES]);
  });
});

describe('gating agreement (merge engine vs canonical resolver)', () => {
  for (const mode of STUDIO_MODES) {
    for (const { name, gates } of CONFIGS) {
      test(`${mode} — ${name}`, () => {
        const merged = merge.selectHierarchy(manifest, mode, gates, { domainDir: unity3dDir });
        const canonical = canonicalRoster(mode, gates);
        expect(merged).toEqual(canonical);
      });
    }
  }

  test('the gated Lean extras follow their frontmatter enabledBy', () => {
    const base = canonicalRoster('lean', { tdd: false, 'native-subproject': false });
    const tdd = canonicalRoster('lean', { tdd: true, 'native-subproject': false });
    const native = canonicalRoster('lean', { tdd: false, 'native-subproject': true });

    expect(base.subagents).toHaveLength(7);
    expect(tdd.subagents).toContain('agent/subagents/unity/tdd-specialist.md');
    expect(native.subagents).toContain('agent/subagents/unity/native-plugin.md');
    expect(tdd.subagents).not.toContain('agent/subagents/unity/native-plugin.md');
    expect(native.subagents).not.toContain('agent/subagents/unity/tdd-specialist.md');
  });
});

describe('gating agreement on a synthetic manifest (both modes carry optional entries)', () => {
  for (const mode of STUDIO_MODES) {
    for (const { name, gates } of CONFIGS) {
      test(`${mode} — ${name}`, () => {
        const source = SYNTHETIC_MODES[mode];
        const merged = merge.selectHierarchy({ studioModes: SYNTHETIC_MODES }, mode, gates, {
          readEnabledBy: syntheticEnabledByFor,
        });
        const canonical = canonicalFrom(source, gates, syntheticEnabledByFor);
        expect(merged).toEqual(canonical);
      });
    }
  }

  test('the always-active optional is included regardless of gates', () => {
    for (const { gates } of CONFIGS) {
      const merged = merge.selectHierarchy({ studioModes: SYNTHETIC_MODES }, 'full', gates, {
        readEnabledBy: syntheticEnabledByFor,
      });
      expect(merged.subagents).toContain('agent/full-studio/full-always.md');
    }
  });

  test('an optional path already listed in subagents is not duplicated', () => {
    const modes = { lean: { agents: [], subagents: ['agent/x.md'], optional: ['agent/x.md'] } };
    const gates: StudioGates = { tdd: false, 'native-subproject': false };
    const merged = merge.selectHierarchy({ studioModes: modes }, 'lean', gates, { readEnabledBy: () => undefined });
    const canonical = selectActiveRoster(
      { agents: [], subagents: ['agent/x.md'], optional: ['agent/x.md'] },
      gates,
      () => undefined
    );
    expect(merged.subagents).toEqual(['agent/x.md']);
    expect(canonical.subagents).toEqual(['agent/x.md']);
  });
});

describe('optionalPaths parity', () => {
  test('string form', () => {
    const input = ['a.md', 'b.md'];
    expect(merge.optionalPaths(input)).toEqual(optionalPaths(input));
  });

  test('legacy { path } object form, including empty entries', () => {
    const input = ['a.md', { path: 'b.md' }, {}, { path: '' }];
    expect(merge.optionalPaths(input)).toEqual(optionalPaths(input));
  });

  test('undefined', () => {
    expect(merge.optionalPaths(undefined)).toEqual(optionalPaths(undefined));
  });
});

describe('isGateEnabled parity', () => {
  const gates: StudioGates = { tdd: true, 'native-subproject': false };
  const CASES: { label: string; enabledBy: string | undefined; expected: boolean }[] = [
    { label: 'undefined → always active', enabledBy: undefined, expected: true },
    { label: 'known gate on', enabledBy: 'tdd', expected: true },
    { label: 'known gate off', enabledBy: 'native-subproject', expected: false },
    { label: 'unknown gate → false', enabledBy: 'unknown', expected: false },
  ];

  for (const { label, enabledBy, expected } of CASES) {
    test(label, () => {
      expect(merge.isGateEnabled(enabledBy, gates)).toBe(expected);
      expect(isGateEnabled(enabledBy, gates)).toBe(expected);
    });
  }
});

describe('native sub-project detection agreement', () => {
  const CASES: { name: string; state: unknown | null; expected: boolean }[] = [
    {
      name: 'present (solutionExists true)',
      state: { schemaVersion: 1, state: { status: 'declared', solutionExists: true } },
      expected: true,
    },
    {
      name: 'declared but solution file missing',
      state: { schemaVersion: 1, state: { status: 'declared', solution: 'Native/build.sln', solutionExists: false } },
      expected: false,
    },
    { name: 'absent artifact', state: null, expected: false },
  ];

  for (const { name, state, expected } of CASES) {
    test(name, () => {
      const dir = mkdtempSync(join(tmpdir(), 'oac-native-agree-'));
      try {
        if (state !== null) {
          mkdirSync(join(dir, 'project-data'), { recursive: true });
          writeFileSync(join(dir, 'project-data', 'native-project-state.json'), JSON.stringify(state));
        }
        const canonical = nativeSubprojectPresent(dir);
        const engine = merge.detectNativeSubproject(dir);
        expect(canonical).toBe(expected);
        expect(engine).toBe(expected);
        expect(engine).toBe(canonical);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }

  test('both tolerate an absent opencode dir', () => {
    expect(nativeSubprojectPresent(undefined)).toBe(false);
    expect(merge.detectNativeSubproject(undefined)).toBe(false);
  });
});
