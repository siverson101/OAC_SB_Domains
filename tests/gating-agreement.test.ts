// Agreement tests for the unavoidable duplication between the plain-JS apply
// engine (`xdomains/merge-domains.js`) and the TypeScript registry/studio-config
// side. The gating semantics must be identical on both sides; these tests are
// the single enforcement point (see docs/review-lessons.md #1).
import { describe, expect, test } from 'bun:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readFrontmatter, frontmatterString } from '../tools/shared/registry/src/frontmatter';
import { optionalPaths, selectActiveRoster, type StudioGates } from '../tools/unity/studio-config/src/roster';
import { STUDIO_MODES } from '../tools/unity/studio-config/src/types';

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

function canonicalRoster(mode: 'lean' | 'full', gates: StudioGates): { agents: string[]; subagents: string[] } {
  const source = manifest.studioModes?.[mode] ?? {};
  return selectActiveRoster(
    {
      agents: source.agents ?? [],
      subagents: source.subagents ?? [],
      optional: optionalPaths(source.optional),
    },
    gates,
    enabledByFor
  );
}

const CONFIGS: { name: string; gates: StudioGates }[] = [
  { name: 'no gates', gates: { tdd: false, 'native-subproject': false } },
  { name: 'tdd on', gates: { tdd: true, 'native-subproject': false } },
  { name: 'native on', gates: { tdd: false, 'native-subproject': true } },
  { name: 'both on', gates: { tdd: true, 'native-subproject': true } },
];

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
