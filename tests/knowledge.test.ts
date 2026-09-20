import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const repoRoot = resolve(import.meta.dir, '..');
const knowledgeDir = join(repoRoot, 'xdomains', 'game-dev', 'unity-3d', 'context', 'unity-3d', 'knowledge');
const manifestPath = join(knowledgeDir, 'manifest.json');

interface KnowledgeFile {
  path: string;
  kind: string;
  unityVersions: string[];
  priority: string;
}

interface KnowledgeManifest {
  schemaVersion: number;
  updated: string;
  unityVersions: string[];
  primaryVersion: string;
  verifyNote: string;
  counts: Record<string, number>;
  files: KnowledgeFile[];
  dispatch: { rule: string; base: string[]; overlays: Record<string, string> };
  tables: { path: string; kind: string; unityVersions: string[] }[];
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as KnowledgeManifest;

const HEADER =
  /^<!-- Context: (.+?) \| Priority: (critical|high|medium|low) \| Version: (\d+\.\d+) \| Updated: (\d{4}-\d{2}-\d{2}) \| Unity: (.+?) -->$/;
const PRIORITIES = ['critical', 'high', 'medium', 'low'];

function toPosix(path: string): string {
  return path.split(sep).join('/');
}

function walkMarkdown(dir: string, base: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkMarkdown(full, base, out);
    else if (entry.endsWith('.md')) out.push(toPosix(relative(base, full)));
  }
  return out.sort();
}

function readKnowledge(relPath: string): string {
  return readFileSync(join(knowledgeDir, relPath), 'utf8');
}

function parseHeader(content: string): { id: string; priority: string; version: string; updated: string; unity: string[] } | null {
  const firstLine = content.split(/\r?\n/, 1)[0];
  const match = HEADER.exec(firstLine);
  if (!match) return null;
  return {
    id: match[1],
    priority: match[2],
    version: match[3],
    updated: match[4],
    unity: match[5].split(',').map((value) => value.trim()),
  };
}

const diskFiles = walkMarkdown(knowledgeDir, knowledgeDir);
const declaredPaths = manifest.files.map((file) => file.path);

describe('knowledge manifest schema', () => {
  test('declares the supported versions and a verify note', () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.unityVersions).toEqual(['6.0', '6.3', '6.5', 'LTS+']);
    expect(manifest.unityVersions).toContain(manifest.primaryVersion);
    expect(manifest.verifyNote.toLowerCase()).toContain('verify');
  });

  test('every declared file has a valid kind, versions and priority', () => {
    const kinds = new Set(['engine', 'middleware', 'versions', 'dispatch']);
    for (const file of manifest.files) {
      expect(kinds.has(file.kind)).toBe(true);
      expect(file.unityVersions.length).toBeGreaterThan(0);
      for (const version of file.unityVersions) expect(manifest.unityVersions).toContain(version);
      expect(PRIORITIES).toContain(file.priority);
      expect(file.path.endsWith('.md')).toBe(true);
    }
  });
});

describe('knowledge count parity', () => {
  test('declared counts match files on disk', () => {
    const counts = { engine: 0, middleware: 0, versions: 0, dispatch: 0 };
    for (const file of manifest.files) counts[file.kind as keyof typeof counts]++;
    expect(counts.engine).toBe(manifest.counts.engine);
    expect(counts.middleware).toBe(manifest.counts.middleware);
    expect(counts.versions).toBe(manifest.counts.versions);
    expect(counts.dispatch).toBe(manifest.counts.dispatch);
    expect(manifest.files.length).toBe(manifest.counts.total);
  });

  test('the declared file list is exactly the files on disk', () => {
    expect(declaredPaths.slice().sort()).toEqual(diskFiles);
  });

  test('disk group counts match the manifest', () => {
    const group = (prefix: string): number => diskFiles.filter((file) => file.startsWith(prefix)).length;
    expect(group('engine/')).toBe(manifest.counts.engine);
    expect(group('middleware/')).toBe(manifest.counts.middleware);
    expect(group('versions/')).toBe(manifest.counts.versions);
    expect(diskFiles.filter((file) => !file.includes('/')).length).toBe(manifest.counts.dispatch);
  });
});

describe('knowledge frontmatter and schema', () => {
  for (const file of declaredPaths) {
    test(`${file} has a well-formed header`, () => {
      const content = readKnowledge(file);
      const header = parseHeader(content);
      const declared = manifest.files.find((entry) => entry.path === file);
      expect(declared).toBeDefined();
      expect(header).not.toBeNull();
      if (!header || !declared) return;
      expect(header.id.endsWith(file.replace(/\.md$/, ''))).toBe(true);
      expect(header.priority).toBe(declared.priority);
      expect(header.version).toBe('1.0');
      expect(header.unity.slice().sort()).toEqual(declared.unityVersions.slice().sort());
      expect(content.length).toBeGreaterThan(200);
    });

    test(`${file} carries the verify-against-primary-sources rule`, () => {
      expect(readKnowledge(file).toLowerCase()).toContain('verify against primary sources');
    });
  }
});

describe('version dispatch', () => {
  const overlays = manifest.dispatch.overlays;
  const base = manifest.dispatch.base;

  test('covers every declared version with one overlay each', () => {
    expect(Object.keys(overlays).slice().sort()).toEqual(manifest.unityVersions.slice().sort());
    for (const version of manifest.unityVersions) {
      const overlay = overlays[version];
      expect(declaredPaths).toContain(overlay);
      const entry = manifest.files.find((file) => file.path === overlay);
      expect(entry?.kind).toBe('versions');
      expect(entry?.unityVersions).toEqual([version]);
    }
  });

  test('base set is exactly the non-version knowledge files', () => {
    const expectedBase = manifest.files
      .filter((file) => file.kind !== 'versions')
      .map((file) => file.path)
      .sort();
    expect(base.slice().sort()).toEqual(expectedBase);
  });

  test('every knowledge file is reachable for at least one version', () => {
    const reachable = new Set<string>([...base, ...Object.values(overlays)]);
    for (const file of declaredPaths) expect(reachable.has(file)).toBe(true);
  });
});

describe('version-gated lookup tables', () => {
  test('declares the five required tables', () => {
    const kinds = manifest.tables.map((table) => table.kind);
    expect(kinds).toContain('api-quickref');
    expect(kinds).toContain('deprecation-map');
    expect(kinds).toContain('platform-defines');
    expect(kinds).toContain('shader-properties');
    expect(kinds).toContain('lifecycle-order');
    expect(manifest.tables.length).toBe(5);
  });

  for (const table of manifest.tables) {
    test(`${table.kind} table exists and is version-gated`, () => {
      const full = join(repoRoot, table.path);
      expect(existsSync(full)).toBe(true);
      const data = JSON.parse(readFileSync(full, 'utf8')) as { schemaVersion?: number; unityVersions?: string[] };
      expect(typeof data.schemaVersion).toBe('number');
      expect(Array.isArray(data.unityVersions)).toBe(true);
      for (const version of table.unityVersions) expect(data.unityVersions).toContain(version);
    });
  }

  test('shader-properties.json has typed entries', () => {
    const data = JSON.parse(readFileSync(join(repoRoot, 'xdomains/context/unity/shader-properties.json'), 'utf8')) as {
      entries: { property: string; type: string; surface: string }[];
    };
    expect(data.entries.length).toBeGreaterThan(10);
    for (const entry of data.entries) {
      expect(entry.property.startsWith('_')).toBe(true);
      expect(entry.type.length).toBeGreaterThan(0);
      expect(entry.surface.length).toBeGreaterThan(0);
    }
  });

  test('lifecycle-order.json lists ordered callbacks', () => {
    const data = JSON.parse(readFileSync(join(repoRoot, 'xdomains/context/unity/lifecycle-order.json'), 'utf8')) as {
      phases: { id: string }[];
      entries: { order: number; method: string; phase: string; runsPerFrame: boolean }[];
    };
    expect(data.entries.length).toBeGreaterThan(20);
    const phaseIds = new Set(data.phases.map((phase) => phase.id));
    const orders = data.entries.map((entry) => entry.order);
    expect(orders).toEqual(orders.slice().sort((a, b) => a - b));
    for (const entry of data.entries) {
      expect(phaseIds.has(entry.phase)).toBe(true);
      expect(typeof entry.runsPerFrame).toBe('boolean');
    }
    expect(data.entries.some((entry) => entry.method === 'Awake')).toBe(true);
    expect(data.entries.some((entry) => entry.method === 'Update')).toBe(true);
  });
});
