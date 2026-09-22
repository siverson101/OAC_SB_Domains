// FR8 generated-doc guard: the agent-system blueprint and the version-matrix
// doc are rendered from the registry / matrix and committed under `.opencode/`.
// This asserts their shape and that the committed copies are exactly what the
// renderers produce (drift), so `bun run build` cannot silently stale them.
import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { VersionMatrix } from '../tools/shared/unity-version';
import { buildRegistry } from '../tools/shared/registry/src/build';
import { renderAgentSystemBlueprint, renderVersionMatrixDoc } from '../tools/shared/registry/src/render';

const repoRoot = resolve(import.meta.dir, '..');
const unity3dDir = join(repoRoot, 'xdomains', 'game-dev', 'unity-3d');
const bundle = join(repoRoot, 'xdomains', 'scripts', 'shared', 'build-registry.mjs');
const matrixPath = join(repoRoot, 'xdomains', 'context', 'unity', 'version-matrix.json');
const blueprintPath = join(repoRoot, '.opencode', 'context', 'unity-3d', 'agent-system-blueprint.md');
const versionMatrixDocPath = join(repoRoot, '.opencode', 'context', 'unity-3d', 'version-matrix.md');

const registry = buildRegistry(unity3dDir, '2026-09-22T00:00:00.000Z');
const matrix = JSON.parse(readFileSync(matrixPath, 'utf8')) as VersionMatrix;
const blueprint = renderAgentSystemBlueprint(registry);
const versionMatrixDoc = renderVersionMatrixDoc(matrix, 'unity-3d');

describe('agent-system blueprint', () => {
  test('enumerates both hierarchies, not just the active one', () => {
    expect(registry.agentSystem.hierarchies.map((hierarchy) => hierarchy.mode)).toEqual(['lean', 'full']);
    const lean = registry.agentSystem.hierarchies.find((hierarchy) => hierarchy.mode === 'lean');
    const full = registry.agentSystem.hierarchies.find((hierarchy) => hierarchy.mode === 'full');
    expect(lean?.agents.map((agent) => agent.id)).toEqual(['unity-3d-orchestrator']);
    expect(lean?.subagents.length).toBe(9);
    expect(full?.agents.map((agent) => agent.id)).toEqual(['full-studio-orchestrator']);
    expect(full?.subagents.length).toBe(17);
  });

  test('carries per-agent ability allowlists, tiers and model resolution', () => {
    const lean = registry.agentSystem.hierarchies.find((hierarchy) => hierarchy.mode === 'lean');
    const orchestrator = lean?.agents[0];
    expect(orchestrator?.tier).toBe('router');
    expect(orchestrator?.abilities).toContain('gather-unity-context');
    const qa = lean?.subagents.find((agent) => agent.id === 'qa');
    expect(qa?.tier).toBe('specialist');
    expect(qa?.abilities).toContain('unity-run-tests');
  });

  test('marks gate-only subagents with their enabling toggle', () => {
    const lean = registry.agentSystem.hierarchies.find((hierarchy) => hierarchy.mode === 'lean');
    const tdd = lean?.subagents.find((agent) => agent.id === 'tdd-specialist');
    expect(tdd?.optional).toBe(true);
    expect(tdd?.gate).toBe('tdd');
  });

  test('parses the delegation map from each agent', () => {
    const lean = registry.agentSystem.hierarchies.find((hierarchy) => hierarchy.mode === 'lean');
    const qa = lean?.subagents.find((agent) => agent.id === 'qa');
    expect(qa?.delegation.reportsTo).toContain('Unity3DOrchestrator');
    expect(qa?.delegation.siblings).toContain('UnityImplementer');
  });

  test('populates an abstract tier for every agent in both hierarchies', () => {
    for (const hierarchy of registry.agentSystem.hierarchies) {
      for (const agent of [...hierarchy.agents, ...hierarchy.subagents]) {
        expect(agent.tier, `${hierarchy.mode}/${agent.id} tier`).toBeDefined();
        expect(['router', 'lead', 'specialist'], `${hierarchy.mode}/${agent.id}`).toContain(agent.tier as string);
      }
    }
    for (const tier of ['router', 'lead', 'specialist']) expect(blueprint).toContain(`| ${tier} |`);
  });

  test('resolves model ids when a modelTiers map is configured', () => {
    const dir = mkdtempSync(join(tmpdir(), 'oac-blueprint-tiers-'));
    try {
      writeFileSync(
        join(dir, 'unity-studio.json'),
        JSON.stringify({
          schemaVersion: 1,
          studioMode: 'lean',
          modelTiers: { router: 'model-router', lead: 'model-lead', specialist: 'model-specialist' },
        })
      );
      const withModels = buildRegistry(unity3dDir, '2026-09-22T00:00:00.000Z', dir);
      const rendered = renderAgentSystemBlueprint(withModels);
      expect(rendered).toContain('model-router');
      expect(rendered).toContain('model-specialist');
      expect(rendered).not.toContain('(unset)');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('renders hierarchies, allowlists, delegation maps and tiers', () => {
    expect(blueprint).toContain('# Unity 3D Agent System Blueprint');
    expect(blueprint).toContain('## Model Tiers');
    expect(blueprint).toContain('| router |');
    expect(blueprint).toContain('## Lean Hierarchy');
    expect(blueprint).toContain('## Full Studio Hierarchy');
    expect(blueprint).toContain('### Delegation Maps');
    expect(blueprint).toContain('gather-unity-context');
    expect(blueprint).toContain('Reports to:');
    expect(blueprint).not.toMatch(/Generated: \d{4}-/);
  });

  test('the committed blueprint matches a fresh render (drift)', () => {
    expect(existsSync(blueprintPath)).toBe(true);
    expect(readFileSync(blueprintPath, 'utf8')).toBe(blueprint);
  });
});

describe('version-matrix doc', () => {
  test('renders dispatch keys, feature flags and every version', () => {
    expect(versionMatrixDoc).toContain('# Unity Version Matrix');
    expect(versionMatrixDoc).toContain('## Dispatch keys');
    expect(versionMatrixDoc).toContain('## Feature flags');
    expect(versionMatrixDoc).toContain('| `6000.0` | `6.0` |');
    expect(versionMatrixDoc).toContain('| `6000.3` | `6.3` |');
    expect(versionMatrixDoc).toContain('| `6000.5` | `6.5` |');
    for (const version of matrix.versions) expect(versionMatrixDoc).toContain(`\`${version}\``);
    expect(versionMatrixDoc).toContain('urp-default-pipeline');
    expect(versionMatrixDoc).toContain('built-in-render-pipeline');
    expect(versionMatrixDoc).not.toMatch(/Generated: \d{4}-/);
  });

  test('the committed version-matrix doc matches a fresh render (drift)', () => {
    expect(existsSync(versionMatrixDocPath)).toBe(true);
    expect(readFileSync(versionMatrixDocPath, 'utf8')).toBe(versionMatrixDoc);
  });
});

describe('registry bundle emits the docs', () => {
  test('writes the blueprint and version-matrix docs next to registry.md', () => {
    const out = mkdtempSync(join(tmpdir(), 'oac-registry-docs-'));
    try {
      const res = spawnSync(
        process.execPath,
        [bundle, '--domain-dir', unity3dDir, '--opencode-dir', out, '--docs-only'],
        { encoding: 'utf8' }
      );
      expect(res.status).toBe(0);
      const blueprintOut = join(out, 'context', 'unity-3d', 'agent-system-blueprint.md');
      const matrixOut = join(out, 'context', 'unity-3d', 'version-matrix.md');
      expect(existsSync(blueprintOut)).toBe(true);
      expect(existsSync(matrixOut)).toBe(true);
      expect(existsSync(join(out, 'registry.json'))).toBe(false);
      expect(readFileSync(blueprintOut, 'utf8')).toBe(blueprint);
      expect(readFileSync(matrixOut, 'utf8')).toBe(versionMatrixDoc);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  test('--studio-config pins the domain config so a decoy install cannot change the docs', () => {
    const out = mkdtempSync(join(tmpdir(), 'oac-registry-decoy-'));
    try {
      writeFileSync(
        join(out, 'unity-studio.json'),
        JSON.stringify({
          schemaVersion: 1,
          studioMode: 'full',
          modelTiers: { router: 'decoy-router', lead: 'decoy-lead', specialist: 'decoy-specialist' },
        })
      );
      const res = spawnSync(
        process.execPath,
        [
          bundle,
          '--domain-dir', unity3dDir,
          '--opencode-dir', out,
          '--studio-config', join(unity3dDir, 'unity-studio.json'),
          '--docs-only',
        ],
        { encoding: 'utf8' }
      );
      expect(res.status).toBe(0);
      const blueprintOut = join(out, 'context', 'unity-3d', 'agent-system-blueprint.md');
      expect(readFileSync(blueprintOut, 'utf8')).toBe(blueprint);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
