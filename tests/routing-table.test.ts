import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildRegistry, type Registry } from '../tools/shared/registry/src/build';
import { renderRegistry } from '../tools/shared/registry/src/render';
import type { ModelTier } from '../tools/unity/studio-config/src/types';

const repoRoot = resolve(import.meta.dir, '..');
const unity3dDir = join(repoRoot, 'xdomains', 'game-dev', 'unity-3d');

const MODEL_TIERS: Record<ModelTier, string> = {
  router: 'model-router',
  lead: 'model-lead',
  specialist: 'model-specialist',
};

interface RoutingRow {
  tier: ModelTier;
  abilities: string[];
}

type RoutingTable = Record<string, RoutingRow>;

// Committed expectations: the role -> tier/abilities routing table each mode
// installs. Drift in an agent's allowlist or tier fails here rather than
// silently changing what the orchestrator routes to.
const LEAN_ROUTING: RoutingTable = {
  'unity-3d-orchestrator': {
    tier: 'router',
    abilities: ['coordination-board', 'gate-review', 'gather-unity-context', 'project-status', 'unity-read-project'],
  },
  implementer: {
    tier: 'specialist',
    abilities: [
      'code-navigation',
      'compile-and-verify-project',
      'coordination-board',
      'input-automation',
      'pattern-library',
      'script-scaffolding',
      'unity-read-project',
    ],
  },
  scene: {
    tier: 'specialist',
    abilities: ['coordination-board', 'prefab-automation', 'primitive-composition', 'scene-editing', 'unity-read-project'],
  },
  uitk: {
    tier: 'specialist',
    abilities: ['coordination-board', 'runtime-ui-validation', 'script-scaffolding', 'uitk-interaction', 'unity-read-project'],
  },
  animator: {
    tier: 'specialist',
    abilities: ['asset-intelligence', 'code-navigation', 'coordination-board', 'script-scaffolding', 'unity-read-project'],
  },
  shadervfx: {
    tier: 'specialist',
    abilities: ['asset-intelligence', 'coordination-board', 'performance-diagnostics', 'shader-helper', 'unity-read-project'],
  },
  artasset: {
    tier: 'specialist',
    abilities: [
      'asset-intelligence',
      'coordination-board',
      'offline-project-inspection',
      'performance-diagnostics',
      'unity-read-project',
    ],
  },
  qa: {
    tier: 'specialist',
    abilities: [
      'ci-status-baseline',
      'compile-and-verify-project',
      'coordination-board',
      'gate-review',
      'run-edit-mode-tests',
      'run-play-mode-tests',
      'unity-build',
      'unity-run-tests',
    ],
  },
};

// The gated Lean extras, active only when their gate holds.
const LEAN_GATED_ROUTING: RoutingTable = {
  'tdd-specialist': {
    tier: 'specialist',
    abilities: [
      'compile-and-verify-project',
      'coordination-board',
      'run-edit-mode-tests',
      'script-scaffolding',
      'unity-change-loop',
      'unity-run-tests',
    ],
  },
  'native-plugin': {
    tier: 'specialist',
    abilities: [
      'code-navigation',
      'compile-and-verify-project',
      'coordination-board',
      'platform-info',
      'script-scaffolding',
      'unity-build',
      'unity-read-project',
    ],
  },
};

const FULL_ROUTING: RoutingTable = {
  'full-studio-orchestrator': {
    tier: 'router',
    abilities: ['coordination-board', 'gate-review', 'gather-unity-context', 'project-status', 'unity-read-project'],
  },
  'creative-director': {
    tier: 'lead',
    abilities: ['contract-aware-design', 'gate-review', 'gather-unity-context', 'project-status', 'unity-read-project'],
  },
  'technical-director': {
    tier: 'lead',
    abilities: [
      'ci-status-baseline',
      'code-navigation',
      'compile-and-verify-project',
      'gate-review',
      'gather-unity-context',
      'project-status',
      'unity-read-project',
    ],
  },
  producer: {
    tier: 'lead',
    abilities: ['ci-status-baseline', 'coordination-board', 'gate-review', 'gather-unity-context', 'project-status'],
  },
  'art-director': {
    tier: 'lead',
    abilities: ['asset-intelligence', 'contract-aware-design', 'gate-review', 'project-status', 'unity-read-project'],
  },
  'game-designer': {
    tier: 'lead',
    abilities: ['code-navigation', 'contract-aware-design', 'primitive-composition', 'project-status', 'unity-read-project'],
  },
  'lead-programmer': {
    tier: 'lead',
    abilities: [
      'code-navigation',
      'compile-and-verify-project',
      'contract-aware-design',
      'coordination-board',
      'pattern-library',
      'script-scaffolding',
      'unity-read-project',
    ],
  },
  'qa-lead': {
    tier: 'lead',
    abilities: [
      'compile-and-verify-project',
      'gate-review',
      'project-status',
      'run-edit-mode-tests',
      'run-play-mode-tests',
      'unity-run-tests',
    ],
  },
  'art-lead': {
    tier: 'lead',
    abilities: ['asset-intelligence', 'project-status', 'scene-editing', 'shader-helper', 'unity-read-project'],
  },
  'gameplay-programmer': {
    tier: 'specialist',
    abilities: [
      'code-navigation',
      'compile-and-verify-project',
      'input-automation',
      'pattern-library',
      'run-edit-mode-tests',
      'script-scaffolding',
    ],
  },
  'ui-programmer': {
    tier: 'specialist',
    abilities: ['code-navigation', 'compile-and-verify-project', 'runtime-ui-validation', 'script-scaffolding', 'uitk-interaction'],
  },
  'performance-analyst': {
    tier: 'specialist',
    abilities: ['code-navigation', 'performance-diagnostics', 'project-status', 'runtime-debugging', 'unity-build'],
  },
  'shader-specialist': {
    tier: 'specialist',
    abilities: ['asset-intelligence', 'code-navigation', 'compile-and-verify-project', 'performance-diagnostics', 'shader-helper'],
  },
  'audio-specialist': {
    tier: 'specialist',
    abilities: ['asset-intelligence', 'code-navigation', 'compile-and-verify-project', 'script-scaffolding', 'unity-read-project'],
  },
  'level-designer': {
    tier: 'specialist',
    abilities: ['asset-intelligence', 'prefab-automation', 'primitive-composition', 'project-status', 'scene-editing'],
  },
  'technical-artist': {
    tier: 'specialist',
    abilities: ['asset-intelligence', 'performance-diagnostics', 'prefab-automation', 'scene-editing', 'shader-helper'],
  },
  'native-plugin': {
    tier: 'specialist',
    abilities: [
      'code-navigation',
      'compile-and-verify-project',
      'platform-info',
      'script-scaffolding',
      'unity-build',
      'unity-read-project',
    ],
  },
  'tdd-specialist': {
    tier: 'specialist',
    abilities: [
      'compile-and-verify-project',
      'run-edit-mode-tests',
      'run-play-mode-tests',
      'script-scaffolding',
      'unity-change-loop',
      'unity-run-tests',
    ],
  },
};

function withMode<T>(studioMode: 'lean' | 'full', config: unknown, run: (opencodeDir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), `oac-routing-${studioMode}-`));
  try {
    writeFileSync(join(dir, 'unity-studio.json'), JSON.stringify(config));
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function withGatedLean<T>(toggles: Record<string, boolean>, native: boolean, run: (opencodeDir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'oac-routing-gated-'));
  try {
    writeFileSync(join(dir, 'unity-studio.json'), JSON.stringify({ schemaVersion: 1, studioMode: 'lean', toggles }));
    if (native) {
      mkdirSync(join(dir, 'project-data'), { recursive: true });
      writeFileSync(
        join(dir, 'project-data', 'native-project-state.json'),
        JSON.stringify({ schemaVersion: 1, state: { solutionExists: true } })
      );
    }
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Derived from the registry's own agent-ability edges, so the table is the
// registry's view rather than a second parse of the frontmatter.
function routingTable(registry: Registry): RoutingTable {
  const rows: RoutingTable = {};
  for (const entry of [...registry.agents, ...registry.subagents]) {
    const abilities = registry.edges
      .filter((edge) => edge.type === 'agent-ability' && edge.from === entry.id)
      .map((edge) => edge.to)
      .sort();
    rows[entry.id] = { tier: entry.tier as ModelTier, abilities };
  }
  return rows;
}

function entriesFor(registry: Registry): { id: string; tier?: ModelTier; model?: string }[] {
  return [...registry.agents, ...registry.subagents].map((entry) => ({ id: entry.id, tier: entry.tier, model: entry.model }));
}

describe('routing table snapshot', () => {
  test('Lean routing table matches the committed expectations', () => {
    withMode('lean', { schemaVersion: 1, studioMode: 'lean' }, (dir) => {
      const registry = buildRegistry(unity3dDir, '2026-09-20T00:00:00.000Z', dir);
      expect(routingTable(registry)).toEqual(LEAN_ROUTING);
    });
  });

  test('Full Studio routing table matches the committed expectations', () => {
    withMode('full', { schemaVersion: 1, studioMode: 'full' }, (dir) => {
      const registry = buildRegistry(unity3dDir, '2026-09-20T00:00:00.000Z', dir);
      expect(routingTable(registry)).toEqual(FULL_ROUTING);
    });
  });

  test('the default Lean config excludes both gated specialists', () => {
    withMode('lean', { schemaVersion: 1, studioMode: 'lean' }, (dir) => {
      const registry = buildRegistry(unity3dDir, '2026-09-20T00:00:00.000Z', dir);
      const table = routingTable(registry);
      expect(table['tdd-specialist']).toBeUndefined();
      expect(table['native-plugin']).toBeUndefined();
      expect(registry.counts.subagents).toBe(7);
    });
  });

  test('includes the TDD specialist when the toggle is on', () => {
    withGatedLean({ tdd: true, ftf: false }, false, (dir) => {
      const registry = buildRegistry(unity3dDir, '2026-09-20T00:00:00.000Z', dir);
      const table = routingTable(registry);
      expect(table['tdd-specialist']).toEqual(LEAN_GATED_ROUTING['tdd-specialist']);
      expect(table['native-plugin']).toBeUndefined();
      expect(registry.counts.subagents).toBe(8);
    });
  });

  test('includes the native-plugin specialist when native detection is present', () => {
    withGatedLean({ tdd: false, ftf: false }, true, (dir) => {
      const registry = buildRegistry(unity3dDir, '2026-09-20T00:00:00.000Z', dir);
      const table = routingTable(registry);
      expect(table['native-plugin']).toEqual(LEAN_GATED_ROUTING['native-plugin']);
      expect(table['tdd-specialist']).toBeUndefined();
      expect(registry.counts.subagents).toBe(8);
    });
  });

  test('resolves every agent tier through the modelTiers map', () => {
    withMode('lean', { schemaVersion: 1, studioMode: 'lean', modelTiers: MODEL_TIERS }, (dir) => {
      const registry = buildRegistry(unity3dDir, '2026-09-20T00:00:00.000Z', dir);
      for (const entry of entriesFor(registry)) {
        expect(entry.tier, `${entry.id} tier`).toBeDefined();
        expect(entry.model, `${entry.id} model`).toBe(MODEL_TIERS[entry.tier as ModelTier]);
      }
      expect(registry.studioConfig.modelTiers).toEqual(MODEL_TIERS);
    });
  });

  test('leaves the model unresolved when no map is present', () => {
    withMode('full', { schemaVersion: 1, studioMode: 'full' }, (dir) => {
      const registry = buildRegistry(unity3dDir, '2026-09-20T00:00:00.000Z', dir);
      for (const entry of entriesFor(registry)) {
        expect(entry.tier, `${entry.id} tier`).toBeDefined();
        expect(entry.model, `${entry.id} model`).toBeUndefined();
      }
    });
  });

  test('an invalid modelTiers map is fail-soft and reported', () => {
    withMode('lean', { schemaVersion: 1, studioMode: 'lean', modelTiers: { router: 3, wizard: 'x' } }, (dir) => {
      const registry = buildRegistry(unity3dDir, '2026-09-20T00:00:00.000Z', dir);
      expect(registry.studioConfig.valid).toBe(false);
      expect(registry.studioConfig.problems.map((problem) => problem.field).sort()).toEqual([
        'modelTiers.router',
        'modelTiers.wizard',
      ]);
      expect(registry.studioConfig.modelTiers).toEqual({});
      expect(entriesFor(registry).every((entry) => entry.model === undefined)).toBe(true);
    });
  });

  test('renders Tier and Model columns for agents and subagents', () => {
    withMode('lean', { schemaVersion: 1, studioMode: 'lean', modelTiers: MODEL_TIERS }, (dir) => {
      const registry = buildRegistry(unity3dDir, '2026-09-20T00:00:00.000Z', dir);
      const md = renderRegistry(registry);
      expect(md).toContain('| Tier |');
      expect(md).toContain('| Model |');
      expect(md).toContain('model-router');
      expect(md).toContain('model-specialist');
    });
  });
});
