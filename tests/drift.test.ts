// Doc-drift guard (Phase 7 Step 7.3): every category's declared count must equal
// the files on disk. Mirrors the count-parity precedent in knowledge/snippets/
// templates tests, but across every declared asset kind in one place.
import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { buildRegistry } from '../tools/shared/registry/src/build';

const repoRoot = resolve(import.meta.dir, '..');
const unity3dDir = join(repoRoot, 'xdomains', 'game-dev', 'unity-3d');
const contextDir = join(unity3dDir, 'context', 'unity-3d');

interface Manifest {
  agents?: string[];
  subagents?: string[];
  studioModes?: Record<string, { agents?: string[]; subagents?: string[]; optional?: (string | { path?: string })[] }>;
  commands?: string[];
  abilities?: string[];
  recipes?: string[];
}

const manifest = JSON.parse(readFileSync(join(unity3dDir, 'sb-domain.json'), 'utf8')) as Manifest;

function toPosix(path: string): string {
  return path.split(sep).join('/');
}

function walkFiles(dir: string, base: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkFiles(full, base, out);
    else out.push(toPosix(relative(base, full)));
  }
  return out;
}

function declaredAgentPaths(source: Manifest): string[] {
  const out = new Set<string>();
  if (source.studioModes) {
    for (const mode of Object.values(source.studioModes)) {
      for (const rel of mode.agents ?? []) out.add(rel);
      for (const rel of mode.subagents ?? []) out.add(rel);
      for (const entry of mode.optional ?? []) {
        const rel = typeof entry === 'string' ? entry : entry.path;
        if (rel) out.add(rel);
      }
    }
  } else {
    for (const rel of [...(source.agents ?? []), ...(source.subagents ?? [])]) out.add(rel);
  }
  return [...out].sort();
}

const registry = buildRegistry(unity3dDir, '2026-09-22T00:00:00.000Z');

describe('declared counts match the files on disk', () => {
  test('knowledge', () => {
    const knowledgeDir = join(contextDir, 'knowledge');
    const counts = (JSON.parse(readFileSync(join(knowledgeDir, 'manifest.json'), 'utf8')) as { counts: { total: number } })
      .counts;
    const disk = walkFiles(knowledgeDir, knowledgeDir).filter((rel) => rel.endsWith('.md'));
    expect(disk.length).toBe(counts.total);
  });

  test('primitives', () => {
    const primitivesDir = join(unity3dDir, 'primitives');
    const disk = readdirSync(primitivesDir).filter((name) => statSync(join(primitivesDir, name)).isDirectory());
    const ledger = readFileSync(join(unity3dDir, 'primitive-not-imported.md'), 'utf8');
    const declared = Number(/\*\*Imported:\s*(\d+)\./.exec(ledger)?.[1] ?? -1);
    expect(declared).toBe(disk.length);
  });

  test('snippets', () => {
    const snippetsDir = join(contextDir, 'snippets');
    const counts = (JSON.parse(readFileSync(join(snippetsDir, 'manifest.json'), 'utf8')) as { counts: { total: number } })
      .counts;
    const disk = readdirSync(snippetsDir).filter((name) => name.endsWith('.cs'));
    expect(disk.length).toBe(counts.total);
    expect(registry.counts.snippets).toBe(counts.total);
  });

  test('templates', () => {
    const templatesDir = join(contextDir, 'templates');
    const counts = (
      JSON.parse(readFileSync(join(templatesDir, 'manifest.json'), 'utf8')) as { counts: { templates: number } }
    ).counts;
    const disk = readdirSync(templatesDir).filter((name) => statSync(join(templatesDir, name)).isDirectory());
    expect(disk.length).toBe(counts.templates);
    expect(registry.counts.templates).toBe(counts.templates);
  });

  test('commands', () => {
    const commandsDir = join(unity3dDir, 'command');
    const declared = new Set(manifest.commands ?? []);
    for (const ability of manifest.abilities ?? []) {
      const rel = `command/${ability}.md`;
      if (existsSync(join(unity3dDir, rel))) declared.add(rel);
    }
    const disk = readdirSync(commandsDir)
      .filter((name) => name.endsWith('.md'))
      .map((name) => `command/${name}`)
      .sort();
    expect([...declared].sort()).toEqual(disk);
    for (const rel of declared) expect(existsSync(join(unity3dDir, rel))).toBe(true);
  });

  test('abilities', () => {
    const declared = manifest.abilities ?? [];
    expect(registry.counts.abilities).toBe(declared.length);
    expect(registry.abilities.map((entry) => entry.id)).toEqual(declared);
    for (const entry of registry.abilities) {
      if (entry.realisedAs) expect(existsSync(join(unity3dDir, entry.realisedAs))).toBe(true);
    }
  });

  test('agents and subagents', () => {
    const agentDir = join(unity3dDir, 'agent');
    const disk = walkFiles(agentDir, unity3dDir).filter((rel) => rel.endsWith('.md')).sort();
    expect(declaredAgentPaths(manifest)).toEqual(disk);
  });

  test('recipes', () => {
    const recipesDir = join(unity3dDir, 'recipes');
    const declared = [...(manifest.recipes ?? [])].sort();
    const disk = readdirSync(recipesDir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => `recipes/${name}`)
      .sort();
    expect(declared).toEqual(disk);
    expect(registry.counts.recipes).toBe(declared.length);
  });
});
