import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildRegistry } from '../tools/shared/registry/src/build';
import { frontmatterString, frontmatterStringArray, parseFrontmatter } from '../tools/shared/registry/src/frontmatter';

const repoRoot = resolve(import.meta.dir, '..');
const unity3dDir = join(repoRoot, 'xdomains', 'game-dev', 'unity-3d');

const manifest = JSON.parse(readFileSync(join(unity3dDir, 'sb-domain.json'), 'utf8')) as {
  agents: string[];
  subagents: string[];
  abilities: string[];
};

const leanAgents = [...manifest.agents, ...manifest.subagents];
const knownAbilities = new Set(manifest.abilities);
const validTiers = new Set(['router', 'lead', 'specialist']);
const gatedEnabledBy: Record<string, string> = {
  'tdd-specialist': 'tdd',
  'native-plugin': 'native-subproject',
};

function agentId(rel: string): string {
  return rel.slice(rel.lastIndexOf('/') + 1).replace(/\.md$/, '');
}

function readAgent(rel: string): { content: string; fm: ReturnType<typeof parseFrontmatter> } {
  const content = readFileSync(join(unity3dDir, rel), 'utf8');
  return { content, fm: parseFrontmatter(content) };
}

describe('Lean agent hierarchy', () => {
  test('ships the orchestrator, 7 specialists, and 2 gated extras', () => {
    expect(manifest.agents).toHaveLength(1);
    expect(manifest.subagents).toHaveLength(9);
    expect(manifest.subagents).toContain('agent/subagents/unity/tdd-specialist.md');
    expect(manifest.subagents).toContain('agent/subagents/unity/native-plugin.md');
  });

  test('every Lean agent declares a valid abstract tier', () => {
    for (const rel of leanAgents) {
      const tier = frontmatterString(readAgent(rel).fm, 'tier');
      expect(validTiers.has(tier ?? ''), `${rel} tier=${tier}`).toBe(true);
    }
    expect(frontmatterString(readAgent('agent/unity-3d-orchestrator.md').fm, 'tier')).toBe('router');
  });

  test('every Lean agent has a non-empty allowlist of known abilities', () => {
    for (const rel of leanAgents) {
      const abilities = frontmatterStringArray(readAgent(rel).fm, 'abilities') ?? [];
      expect(abilities.length, `${rel} allowlist`).toBeGreaterThan(0);
      for (const ability of abilities) {
        expect(knownAbilities.has(ability), `${rel} -> ${ability}`).toBe(true);
      }
    }
  });

  test('every Lean agent has a Delegation Map naming all four roles', () => {
    for (const rel of leanAgents) {
      const { content } = readAgent(rel);
      expect(content, `${rel} heading`).toMatch(/Delegation Map/);
      for (const field of ['Reports to', 'Implements from', 'Escalation targets', 'Siblings']) {
        expect(content.toLowerCase(), `${rel} ${field}`).toContain(field.toLowerCase());
      }
    }
  });

  test('only the gated extras declare enabledBy, with the right value', () => {
    for (const rel of leanAgents) {
      const expected = gatedEnabledBy[agentId(rel)];
      expect(frontmatterString(readAgent(rel).fm, 'enabledBy'), `${rel} enabledBy`).toBe(expected);
    }
  });
});

describe('Lean agent registry edges', () => {
  const registry = buildRegistry(unity3dDir, '2026-09-20T00:00:00.000Z');
  const hasEdge = (from: string, to: string): boolean =>
    registry.edges.some((edge) => edge.type === 'agent-ability' && edge.from === from && edge.to === to);

  test('records no unknown-ability warnings for Lean agents', () => {
    expect(registry.warnings.filter((warning) => warning.includes('unknown ability'))).toEqual([]);
  });

  test('records a representative agent-ability edge per agent', () => {
    expect(hasEdge('unity-3d-orchestrator', 'coordination-board')).toBe(true);
    expect(hasEdge('implementer', 'script-scaffolding')).toBe(true);
    expect(hasEdge('scene', 'scene-editing')).toBe(true);
    expect(hasEdge('uitk', 'uitk-interaction')).toBe(true);
    expect(hasEdge('animator', 'asset-intelligence')).toBe(true);
    expect(hasEdge('shadervfx', 'shader-helper')).toBe(true);
    expect(hasEdge('artasset', 'asset-intelligence')).toBe(true);
    expect(hasEdge('qa', 'run-edit-mode-tests')).toBe(true);
    expect(hasEdge('tdd-specialist', 'run-edit-mode-tests')).toBe(true);
    expect(hasEdge('native-plugin', 'script-scaffolding')).toBe(true);
  });

  test('records an agent-ability edge for every declared Lean ability', () => {
    for (const rel of leanAgents) {
      const id = agentId(rel);
      const abilities = frontmatterStringArray(readAgent(rel).fm, 'abilities') ?? [];
      for (const ability of abilities) expect(hasEdge(id, ability), `${id} -> ${ability}`).toBe(true);
    }
  });
});
