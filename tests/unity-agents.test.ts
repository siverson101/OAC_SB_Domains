import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildRegistry, buildTemplateOverlay, readAgentSource, type Registry } from '../tools/shared/registry/src/build';
import { frontmatterString, frontmatterStringArray, parseFrontmatter } from '../tools/shared/registry/src/frontmatter';
import { claimResource, emptyBoard } from '../tools/unity/unity-compose/src/coordination-board';

const repoRoot = resolve(import.meta.dir, '..');
const unity3dDir = join(repoRoot, 'xdomains', 'game-dev', 'unity-3d');

const manifest = JSON.parse(readFileSync(join(unity3dDir, 'sb-domain.json'), 'utf8')) as {
  studioModes: {
    lean: {
      agents: string[];
      subagents: string[];
      optional: (string | { path?: string })[];
    };
  };
  abilities: string[];
};

const lean = manifest.studioModes.lean;
const optionalAgents = lean.optional.map((entry) => (typeof entry === 'string' ? entry : entry.path)).filter((p): p is string => Boolean(p));
const leanAgents = [...lean.agents, ...lean.subagents, ...optionalAgents];
const knownAbilities = new Set(manifest.abilities);
const validTiers = new Set(['router', 'lead', 'specialist']);
const gatedEnabledBy: Record<string, string> = {
  'tdd-specialist': 'tdd',
  'native-plugin': 'native-subproject',
};

const writingAgents = [...lean.subagents, ...optionalAgents];
const T0 = '2026-01-01T00:00:00.000Z';
const CLAIM_RULE = /<rule id="claim_before_write">[\s\S]*?<\/rule>/;

function agentId(rel: string): string {
  return rel.slice(rel.lastIndexOf('/') + 1).replace(/\.md$/, '');
}

const templateOverlay = buildTemplateOverlay(unity3dDir, manifest as never);

function readAgent(rel: string): { content: string; fm: ReturnType<typeof parseFrontmatter> } {
  const content = readAgentSource(unity3dDir, rel, templateOverlay).content;
  return { content, fm: parseFrontmatter(content) };
}

describe('Lean agent hierarchy', () => {
  test('ships the orchestrator, 7 specialists, and 2 gated extras', () => {
    expect(lean.agents).toHaveLength(1);
    expect(lean.subagents).toHaveLength(7);
    expect(optionalAgents).toHaveLength(2);
    expect(optionalAgents).toContain('agent/subagents/unity/tdd-specialist.md');
    expect(optionalAgents).toContain('agent/subagents/unity/native-plugin.md');
    expect(Object.values(gatedEnabledBy).sort()).toEqual(['native-subproject', 'tdd']);
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
  // Both gates held so the gated extras are in the active roster; the default
  // (gated-off) roster is covered by tests/registry.test.ts.
  let gatedDir: string;
  let registry: Registry;
  beforeAll(() => {
    gatedDir = mkdtempSync(join(tmpdir(), 'oac-unity-agents-'));
    writeFileSync(
      join(gatedDir, 'unity-studio.json'),
      JSON.stringify({ schemaVersion: 1, studioMode: 'lean', toggles: { tdd: true, ftf: false } })
    );
    mkdirSync(join(gatedDir, 'project-data'), { recursive: true });
    writeFileSync(
      join(gatedDir, 'project-data', 'native-project-state.json'),
      JSON.stringify({ schemaVersion: 1, state: { solutionExists: true } })
    );
    registry = buildRegistry(unity3dDir, '2026-09-20T00:00:00.000Z', gatedDir);
  });
  afterAll(() => rmSync(gatedDir, { recursive: true, force: true }));

  const hasEdge = (from: string, to: string): boolean =>
    registry.edges.some((edge) => edge.type === 'agent-ability' && edge.from === from && edge.to === to);

  test('records no unknown-ability warnings for Lean agents', () => {
    expect(registry.warnings.filter((warning) => warning.includes('unknown ability'))).toEqual([]);
  });

  test('records a representative agent-ability edge per agent', () => {
    expect(hasEdge('unity-3d-orchestrator', 'coordination-board')).toBe(true);
    expect(hasEdge('implementer', 'script-scaffolding')).toBe(true);
    expect(hasEdge('scene', 'scene-editing')).toBe(true);
    expect(hasEdge('ui', 'ui-interaction')).toBe(true);
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

describe('coordination board wiring', () => {
  test('every writing Lean agent allowlists coordination-board', () => {
    for (const rel of writingAgents) {
      const abilities = frontmatterStringArray(readAgent(rel).fm, 'abilities') ?? [];
      expect(abilities, `${rel} allowlist`).toContain('coordination-board');
    }
  });

  test('every writing Lean agent states the claim-before-write rule', () => {
    for (const rel of writingAgents) {
      const { content } = readAgent(rel);
      const rule = content.match(CLAIM_RULE)?.[0] ?? '';
      expect(rule, `${rel} claim_before_write rule`).not.toBe('');
      expect(rule, `${rel} references the ability`).toContain('coordination-board');
      expect(rule, `${rel} leases the claim`).toMatch(/lease/i);
      expect(rule, `${rel} releases the claim`).toMatch(/release/i);
      expect(rule, `${rel} fails fast naming the holder`).toMatch(/fails fast naming the holder/);
    }
  });

  test('the orchestrator documents the one-holder Editor hold serialising compile/test/capture', () => {
    const { content } = readAgent('agent/unity-3d-orchestrator.md');
    const rule = content.match(/<rule id="editor_hold_serialises"[\s\S]*?<\/rule>/)?.[0] ?? '';
    expect(rule).not.toBe('');
    expect(rule).toMatch(/one-holder Editor hold/i);
    expect(rule).toContain('coordination-board');
    expect(rule).toContain('compile/test/capture');
  });

  test('a claim conflict between two writing agents fails fast naming the holder', () => {
    const first = claimResource(emptyBoard(T0), { resource: 'Assets/Shared.cs', holder: 'implementer' }, T0);
    expect(first.ok).toBe(true);

    const second = claimResource(first.board, { resource: 'Assets/Shared.cs', holder: 'scene' }, T0);
    expect(second.ok).toBe(false);
    expect(second.status).toBe('conflict');
    expect(second.errors.join(' ')).toContain('implementer');
    expect(second.board.claims).toHaveLength(1);
  });
});
