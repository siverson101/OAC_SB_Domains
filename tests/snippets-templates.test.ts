import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { buildRegistry } from '../tools/shared/registry/src/build';

const repoRoot = resolve(import.meta.dir, '..');
const unity3dDir = join(repoRoot, 'xdomains', 'game-dev', 'unity-3d');
const contextDir = join(unity3dDir, 'context', 'unity-3d');
const snippetsDir = join(contextDir, 'snippets');
const templatesDir = join(contextDir, 'templates');

interface SnippetEntry {
  id: string;
  path: string;
  language: string;
  priority: string;
  standardsVersion: string;
  description: string;
}

interface SnippetManifest {
  schemaVersion: number;
  standardsVersion: string;
  updated: string;
  unityVersions: string[];
  provenance: string;
  counts: { total: number };
  snippets: SnippetEntry[];
}

interface TemplateEntry {
  id: string;
  path: string;
  priority: string;
  standardsVersion: string;
  description: string;
  files: string[];
}

interface TemplateManifest {
  schemaVersion: number;
  standardsVersion: string;
  updated: string;
  unityVersions: string[];
  provenance: string;
  counts: { templates: number };
  templates: TemplateEntry[];
}

const snippetManifest = JSON.parse(readFileSync(join(snippetsDir, 'manifest.json'), 'utf8')) as SnippetManifest;
const templateManifest = JSON.parse(readFileSync(join(templatesDir, 'manifest.json'), 'utf8')) as TemplateManifest;

const SNIPPET_HEADER =
  /^\/\/ Context: unity-3d\/snippets\/([^|]+?) \| Standards-Version: (\d+\.\d+) \| Priority: (critical|high|medium|low) \| Updated: (\d{4}-\d{2}-\d{2}) \| Unity: (.+)$/;
const TEMPLATE_HEADER =
  /^<!-- Context: unity-3d\/templates\/([^|]+?) \| Standards-Version: (\d+\.\d+) \| Priority: (critical|high|medium|low) \| Updated: (\d{4}-\d{2}-\d{2}) \| Unity: (.+?) -->$/;
const PRIORITIES = ['critical', 'high', 'medium', 'low'];
const STANDARDS_VERSION = '1.0';

function toPosix(path: string): string {
  return path.split(sep).join('/');
}

const snippetDiskFiles = readdirSync(snippetsDir)
  .filter((name) => name.endsWith('.cs'))
  .sort();
const templateDiskDirs = readdirSync(templatesDir)
  .filter((name) => statSync(join(templatesDir, name)).isDirectory())
  .sort();

describe('snippet manifest schema', () => {
  test('declares a standards-version, provenance and supported versions', () => {
    expect(snippetManifest.schemaVersion).toBe(1);
    expect(snippetManifest.standardsVersion).toBe(STANDARDS_VERSION);
    expect(snippetManifest.provenance.length).toBeGreaterThan(0);
    expect(snippetManifest.unityVersions).toEqual(['6.0', '6.3', '6.5', 'LTS+']);
  });

  test('every declared snippet has an id, priority and standards-version', () => {
    expect(snippetManifest.snippets.length).toBeGreaterThan(0);
    for (const snippet of snippetManifest.snippets) {
      expect(snippet.id.length).toBeGreaterThan(0);
      expect(snippet.path.endsWith('.cs')).toBe(true);
      expect(PRIORITIES).toContain(snippet.priority);
      expect(snippet.standardsVersion).toBe(STANDARDS_VERSION);
      expect(snippet.description.length).toBeGreaterThan(0);
    }
  });

  test('declared count matches the snippet list', () => {
    expect(snippetManifest.counts.total).toBe(snippetManifest.snippets.length);
  });
});

describe('snippet files', () => {
  test('the declared list is exactly the .cs files on disk', () => {
    expect(snippetManifest.snippets.map((snippet) => snippet.path).sort()).toEqual(snippetDiskFiles);
  });

  for (const snippet of snippetManifest.snippets) {
    test(`${snippet.path} carries a drop-in header with a standards-version`, () => {
      const full = join(snippetsDir, snippet.path);
      expect(existsSync(full)).toBe(true);
      const content = readFileSync(full, 'utf8');
      const match = SNIPPET_HEADER.exec(content.split(/\r?\n/, 1)[0]);
      expect(match).not.toBeNull();
      if (!match) return;
      expect(match[1].trim()).toBe(snippet.id);
      expect(match[2]).toBe(snippet.standardsVersion);
      expect(match[3]).toBe(snippet.priority);
      expect(content.length).toBeGreaterThan(200);
    });
  }
});

describe('template manifest schema', () => {
  test('declares a standards-version, provenance and supported versions', () => {
    expect(templateManifest.schemaVersion).toBe(1);
    expect(templateManifest.standardsVersion).toBe(STANDARDS_VERSION);
    expect(templateManifest.provenance.length).toBeGreaterThan(0);
    expect(templateManifest.unityVersions).toEqual(['6.0', '6.3', '6.5', 'LTS+']);
  });

  test('declared count matches the template list', () => {
    expect(templateManifest.counts.templates).toBe(templateManifest.templates.length);
  });
});

describe('template directories', () => {
  test('the declared list is exactly the directories on disk', () => {
    expect(templateManifest.templates.map((template) => template.path).sort()).toEqual(templateDiskDirs);
  });

  for (const template of templateManifest.templates) {
    test(`${template.path} is a directory with a README and declared files`, () => {
      const dir = join(templatesDir, template.path);
      expect(statSync(dir).isDirectory()).toBe(true);
      expect(existsSync(join(dir, 'README.md'))).toBe(true);
      expect(template.files).toContain('README.md');
      expect(PRIORITIES).toContain(template.priority);
      expect(template.standardsVersion).toBe(STANDARDS_VERSION);
      for (const file of template.files) {
        expect(existsSync(join(dir, file))).toBe(true);
      }
    });

    test(`${template.path}/README.md carries a standards-version header`, () => {
      const content = readFileSync(join(templatesDir, template.path, 'README.md'), 'utf8');
      const match = TEMPLATE_HEADER.exec(content.split(/\r?\n/, 1)[0]);
      expect(match).not.toBeNull();
      if (!match) return;
      expect(match[1].trim()).toBe(template.id);
      expect(match[2]).toBe(template.standardsVersion);
      expect(match[3]).toBe(template.priority);
      expect(content.toLowerCase()).toContain('standards-version');
    });
  }
});

describe('registry enumeration', () => {
  const registry = buildRegistry(unity3dDir, '2026-09-20T00:00:00.000Z');

  test('enumerates every snippet with its standards-version', () => {
    expect(registry.snippets.length).toBe(snippetManifest.snippets.length);
    expect(registry.counts.snippets).toBe(registry.snippets.length);
    for (const snippet of snippetManifest.snippets) {
      const entry = registry.snippets.find((candidate) => candidate.id === snippet.id);
      expect(entry).toBeDefined();
      expect(entry?.standardsVersion).toBe(STANDARDS_VERSION);
      expect(entry?.path.endsWith(`/snippets/${snippet.path}`)).toBe(true);
      expect(existsSync(join(unity3dDir, entry?.path ?? ''))).toBe(true);
    }
  });

  test('enumerates every template with its standards-version', () => {
    expect(registry.templates.length).toBe(templateManifest.templates.length);
    expect(registry.counts.templates).toBe(registry.templates.length);
    for (const template of templateManifest.templates) {
      const entry = registry.templates.find((candidate) => candidate.id === template.id);
      expect(entry).toBeDefined();
      expect(entry?.standardsVersion).toBe(STANDARDS_VERSION);
      expect(entry?.path.endsWith(`/templates/${template.path}/README.md`)).toBe(true);
      expect(existsSync(join(unity3dDir, entry?.path ?? ''))).toBe(true);
    }
  });

  test('snippets and templates are not double-counted as generic context', () => {
    for (const entry of registry.context) {
      expect(toPosix(entry.path)).not.toContain('/snippets/');
      expect(toPosix(entry.path)).not.toContain('/templates/');
    }
  });
});
