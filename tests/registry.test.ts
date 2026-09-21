import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { buildRegistry } from '../tools/shared/registry/src/build';
import { frontmatterStringArray, parseFrontmatter } from '../tools/shared/registry/src/frontmatter';
import { renderRegistry } from '../tools/shared/registry/src/render';

const repoRoot = resolve(import.meta.dir, '..');
const unity3dDir = join(repoRoot, 'xdomains', 'game-dev', 'unity-3d');
const bundle = join(repoRoot, 'xdomains', 'scripts', 'shared', 'build-registry.mjs');

describe('registry build', () => {
  const registry = buildRegistry(unity3dDir, '2026-09-19T00:00:00.000Z');

  test('counts the declared assets for the default Lean config', () => {
    expect(registry.domain).toBe('game-dev');
    expect(registry.subdomain).toBe('unity-3d');
    expect(registry.counts.agents).toBe(1);
    expect(registry.counts.subagents).toBe(7);
    expect(registry.counts.abilities).toBe(34);
    expect(registry.counts.workflows).toBe(3);
  });

  test('includes a gated specialist only when its gate holds', () => {
    const tddDir = mkdtempSync(join(tmpdir(), 'oac-registry-tdd-'));
    const nativeDir = mkdtempSync(join(tmpdir(), 'oac-registry-native-'));
    try {
      writeFileSync(
        join(tddDir, 'unity-studio.json'),
        JSON.stringify({ schemaVersion: 1, studioMode: 'lean', toggles: { tdd: true, ftf: false } })
      );
      const tdd = buildRegistry(unity3dDir, '2026-09-20T00:00:00.000Z', tddDir);
      expect(tdd.counts.agents).toBe(1);
      expect(tdd.counts.subagents).toBe(8);
      expect(tdd.subagents.some((entry) => entry.id === 'tdd-specialist')).toBe(true);
      expect(tdd.subagents.some((entry) => entry.id === 'native-plugin')).toBe(false);

      mkdirSync(join(nativeDir, 'project-data'), { recursive: true });
      writeFileSync(
        join(nativeDir, 'unity-studio.json'),
        JSON.stringify({ schemaVersion: 1, studioMode: 'lean' })
      );
      writeFileSync(
        join(nativeDir, 'project-data', 'native-project-state.json'),
        JSON.stringify({ schemaVersion: 1, state: { status: 'declared', solutionExists: true } })
      );
      const native = buildRegistry(unity3dDir, '2026-09-20T00:00:00.000Z', nativeDir);
      expect(native.counts.subagents).toBe(8);
      expect(native.subagents.some((entry) => entry.id === 'native-plugin')).toBe(true);
      expect(native.subagents.some((entry) => entry.id === 'tdd-specialist')).toBe(false);
    } finally {
      rmSync(tddDir, { recursive: true, force: true });
      rmSync(nativeDir, { recursive: true, force: true });
    }
  });

  test('enumerates the full-studio hierarchy when the config selects it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'oac-registry-full-'));
    try {
      writeFileSync(join(dir, 'unity-studio.json'), JSON.stringify({ schemaVersion: 1, studioMode: 'full' }));
      const full = buildRegistry(unity3dDir, '2026-09-20T00:00:00.000Z', dir);

      expect(full.studioConfig.studioMode).toBe('full');
      expect(full.counts.agents).toBe(1);
      expect(full.counts.subagents).toBe(17);
      expect(full.agents.map((entry) => entry.path)).toEqual(['agent/full-studio/full-studio-orchestrator.md']);
      expect(full.subagents.every((entry) => entry.path.startsWith('agent/full-studio/'))).toBe(true);
      expect(full.agents.some((entry) => entry.path.startsWith('agent/subagents/'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('includes the version-gated knowledge files in context', () => {
    const knowledge = registry.context.filter((entry) => entry.path.includes('/knowledge/'));
    expect(knowledge.length).toBe(21);
    expect(knowledge.some((entry) => entry.path.endsWith('/knowledge/version-dispatch.md'))).toBe(true);
    expect(knowledge.some((entry) => entry.path.endsWith('/knowledge/engine/foundations.md'))).toBe(true);
    expect(knowledge.some((entry) => entry.path.endsWith('/knowledge/middleware/unitask.md'))).toBe(true);
    expect(registry.counts.context).toBe(registry.context.length);
  });

  test('resolves abilities to their command implementations', () => {
    const gather = registry.abilities.find((a) => a.id === 'gather-unity-context');
    expect(gather?.realisedAs).toBe('command/gather-unity-context.md');
  });

  test('maps consumers to projected context', () => {
    const implementer = registry.subagents.find((s) => s.id === 'implementer');
    expect(implementer?.consumes).toContain('preferences.md');
    expect(implementer?.consumes).toContain('structure.md');
    const gate = registry.projections.outputs.find((o) => o.file === 'gate.md');
    expect(gate?.consumedBy.length).toBeGreaterThan(0);
  });

  test('renders a registry document', () => {
    const md = renderRegistry(registry);
    expect(md).toContain('# Unity 3D Registry');
    expect(md).toContain('## Abilities');
    expect(md).toContain('## Projected Context');
  });

  test('tags every capability with its layer', () => {
    expect(registry.commands.length).toBeGreaterThan(0);
    for (const command of registry.commands) expect(command.layer).toBe('command');
    expect(registry.abilities.length).toBeGreaterThan(0);
    for (const ability of registry.abilities) expect(ability.layer).toBe('ability');
    expect(registry.tools.length).toBeGreaterThan(0);
    for (const tool of registry.tools) expect(tool.layer).toBe('tool');
  });

  test('records agent↔ability edges from allowlists', () => {
    expect(registry.edges).toContainEqual({ type: 'agent-ability', from: 'unity-3d-orchestrator', to: 'gather-unity-context' });
    expect(registry.edges).toContainEqual({ type: 'agent-ability', from: 'unity-3d-orchestrator', to: 'unity-read-project' });
    expect(registry.edges).toContainEqual({ type: 'agent-ability', from: 'implementer', to: 'unity-read-project' });
    expect(registry.edges).toContainEqual({ type: 'agent-ability', from: 'qa', to: 'unity-run-tests' });
    expect(registry.edges).toContainEqual({ type: 'agent-ability', from: 'qa', to: 'unity-build' });
  });

  test('records workflow edges from frontmatter declarations', () => {
    expect(registry.edges).toContainEqual({ type: 'workflow-ability', from: 'feature-delivery', to: 'gather-unity-context' });
    expect(registry.edges).toContainEqual({ type: 'workflow-ability', from: 'feature-delivery', to: 'unity-run-tests' });
    expect(registry.edges).toContainEqual({ type: 'workflow-agent', from: 'feature-delivery', to: 'implementer' });
    expect(registry.edges).toContainEqual({ type: 'workflow-agent', from: 'feature-delivery', to: 'qa' });
    expect(registry.edges).toContainEqual({ type: 'workflow-agent', from: 'feature-delivery', to: 'scene' });
  });

  test('counts edges and renders an Edges section', () => {
    expect(registry.counts.edges).toBe(registry.edges.length);
    const md = renderRegistry(registry);
    expect(md).toContain('## Edges');
    expect(md).toContain('### agent-ability');
    expect(md).toContain('### workflow-ability');
    expect(md).toContain('### workflow-agent');
    expect(md).toContain('`unity-3d-orchestrator` → `gather-unity-context`');
  });
});

describe('registry edge hygiene', () => {
  test('filters malformed abilities, dedupes edges, and warns on dangling ids', () => {
    const dir = mkdtempSync(join(tmpdir(), 'oac-registry-edges-'));
    try {
      mkdirSync(join(dir, 'agent'), { recursive: true });
      writeFileSync(
        join(dir, 'sb-domain.json'),
        JSON.stringify({
          name: 'test-domain',
          domain: 'test',
          subdomain: 'test',
          agents: ['agent/tester.md'],
          abilities: ['unity-read-project'],
        })
      );
      writeFileSync(
        join(dir, 'agent', 'tester.md'),
        ['---', 'name: tester', 'abilities: [unity-read-project, unity-read-project, 3, nope]', '---', ''].join('\n')
      );

      const registry = buildRegistry(dir, '2026-09-19T00:00:00.000Z');
      expect(registry.edges.filter((edge) => edge.type === 'agent-ability' && edge.from === 'tester')).toEqual([
        { type: 'agent-ability', from: 'tester', to: 'unity-read-project' },
      ]);
      expect(registry.warnings.some((warning) => warning.includes('nope'))).toBe(true);
      expect(registry.warnings.some((warning) => warning.includes('unknown ability'))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('command usedBy is for capability consumers', () => {
  interface StudioModeRoster {
    agents?: string[];
    subagents?: string[];
    optional?: (string | { path?: string })[];
  }

  // `usedBy` is still a supported capability-contract field (capability ids
  // that consume this command); only agent-id values were removed from the
  // shipped commands, so this guards against an agent id creeping back in.
  test('command usedBy values are capability ids, not agent ids', () => {
    const manifest = JSON.parse(readFileSync(join(unity3dDir, 'sb-domain.json'), 'utf8')) as {
      studioModes?: Record<string, StudioModeRoster>;
      commands?: string[];
    };
    const agentIds = new Set<string>();
    for (const mode of Object.values(manifest.studioModes ?? {})) {
      const optional = (mode.optional ?? []).map((entry) => (typeof entry === 'string' ? entry : entry.path));
      const rels = [...(mode.agents ?? []), ...(mode.subagents ?? []), ...optional];
      for (const rel of rels) if (rel) agentIds.add(basename(rel, '.md'));
    }
    expect(agentIds.size).toBeGreaterThan(0);

    for (const rel of manifest.commands ?? []) {
      const fm = parseFrontmatter(readFileSync(join(unity3dDir, rel), 'utf8'));
      for (const usedBy of frontmatterStringArray(fm, 'usedBy') ?? []) {
        expect(usedBy.startsWith('subagents/'), `${rel} usedBy '${usedBy}' is an agent path`).toBe(false);
        expect(agentIds.has(usedBy), `${rel} usedBy '${usedBy}' is an agent id`).toBe(false);
      }
    }
  });
});

describe('registry bundle', () => {
  test('writes registry.json and registry.md', () => {
    const out = mkdtempSync(join(tmpdir(), 'oac-registry-test-'));
    try {
      const res = spawnSync(
        process.execPath,
        [bundle, '--domain-dir', unity3dDir, '--opencode-dir', out],
        { encoding: 'utf8' }
      );
      expect(res.status).toBe(0);
      expect(existsSync(join(out, 'registry.json'))).toBe(true);
      expect(existsSync(join(out, 'context', 'unity-3d', 'registry.md'))).toBe(true);
      const json = JSON.parse(readFileSync(join(out, 'registry.json'), 'utf8'));
      expect(json.subdomain).toBe('unity-3d');
      const md = readFileSync(join(out, 'context', 'unity-3d', 'registry.md'), 'utf8');
      expect(md).toContain('## Edges');
      expect(md).toContain('Layer');
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
