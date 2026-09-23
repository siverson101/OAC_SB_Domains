// Doc-drift guard (Phase 7 Step 7.3): every category's declared count must equal
// the files on disk. Mirrors the count-parity precedent in knowledge/snippets/
// templates tests, but across every declared asset kind in one place.
import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { allStudioAgents, buildRegistry } from '../tools/shared/registry/src/build';

const repoRoot = resolve(import.meta.dir, '..');
const unity3dDir = join(repoRoot, 'xdomains', 'game-dev', 'unity-3d');
const contextDir = join(unity3dDir, 'context', 'unity-3d');

interface Manifest {
  agents?: string[];
  subagents?: string[];
  studioModes?: Record<string, { agents?: string[]; subagents?: string[]; optional?: (string | { path?: string })[] }>;
  templates?: { installAs?: string; template?: string; manifest?: string }[];
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
    // Multi-axis templates (ADR-0020) are source files declared via
    // `manifest.templates`, not roster agents; their resolved variants live
    // beside them. Exclude both from the roster-vs-disk comparison.
    const templateBases = (manifest.templates ?? []).map((entry) => {
      const meta = JSON.parse(readFileSync(join(unity3dDir, entry.manifest ?? ''), 'utf8')) as { base: string };
      return { dir: (entry.template ?? '').replace(/\/[^/]+$/, ''), base: meta.base };
    });
    const isTemplateSource = (rel: string): boolean =>
      templateBases.some(({ dir, base }) => {
        if (!rel.startsWith(`${dir}/`)) return false;
        const file = rel.split('/').pop() ?? '';
        return file === `${base}.md` || file.startsWith(`${base}.`);
      });

    const templatedInstalls = new Set((manifest.templates ?? []).map((entry) => entry.installAs));
    const disk = walkFiles(agentDir, unity3dDir)
      .filter((rel) => rel.endsWith('.md') && !isTemplateSource(rel))
      .sort();
    // Reuse the registry's own roster union so the drift check cannot diverge
    // from what the engine actually installs. A templated agent has no plain
    // source file (its variant is resolved at install), so it is excluded here
    // and covered by the template/manifest existence checks below.
    const declared = [...new Set(allStudioAgents(manifest))]
      .filter((rel) => !templatedInstalls.has(rel))
      .sort();
    expect(declared).toEqual(disk);

    // Every declared templated agent has its template + manifest on disk.
    for (const entry of manifest.templates ?? []) {
      expect(existsSync(join(unity3dDir, entry.template ?? ''))).toBe(true);
      expect(existsSync(join(unity3dDir, entry.manifest ?? ''))).toBe(true);
    }
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
