import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildRegistry } from '../tools/shared/registry/src/build';
import { renderRegistry } from '../tools/shared/registry/src/render';

const repoRoot = resolve(import.meta.dir, '..');
const unity3dDir = join(repoRoot, 'xdomains', 'game-dev', 'unity-3d');
const bundle = join(repoRoot, 'xdomains', 'scripts', 'shared', 'build-registry.mjs');

describe('registry build', () => {
  const registry = buildRegistry(unity3dDir, '2026-09-19T00:00:00.000Z');

  test('counts the declared assets', () => {
    expect(registry.domain).toBe('game-dev');
    expect(registry.subdomain).toBe('unity-3d');
    expect(registry.counts.agents).toBe(1);
    expect(registry.counts.subagents).toBe(7);
    expect(registry.counts.abilities).toBe(16);
    expect(registry.counts.workflows).toBe(3);
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
