import { readdirSync, statSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';
import { findPatternCatalog } from '../../../shared/context-files';
import { readJson } from '../../../shared/io';
import {
  defaultStudioConfig,
  resolveStudioConfigProject,
  type ConfigProblem,
  type PatternConflict,
  type ReviewIntensity,
  type StudioMode,
  type StudioToggles,
} from '../../../unity/studio-config/src/resolve';
import { frontmatterString, frontmatterStringArray, readFrontmatter } from './frontmatter';

export interface RegistryEntry {
  id: string;
  name: string;
  path: string;
  description?: string;
  realisedAs?: string;
  consumes?: string[];
  layer?: 'tool' | 'ability' | 'command';
  standardsVersion?: string;
}

export type RegistryEdgeType = 'agent-ability' | 'workflow-ability' | 'workflow-agent';

export interface RegistryEdge {
  type: RegistryEdgeType;
  from: string;
  to: string;
}

// The enabled pattern/package config surfaced from `.opencode/unity-studio.json`
// (fail-soft: absent -> defaults, `present: false`). Conflicts are reported, not
// resolved by dropping a pattern.
export interface RegistryStudioConfig {
  present: boolean;
  path: string | null;
  studioMode: StudioMode;
  reviewIntensity: ReviewIntensity;
  toggles: StudioToggles;
  patterns: string[];
  packages: string[];
  conflicts: PatternConflict[];
  problems: ConfigProblem[];
  valid: boolean;
}

export interface Registry {
  schemaVersion: number;
  generatedAt: string;
  domain: string;
  subdomain: string;
  displayName: string;
  version: string;
  counts: Record<string, number>;
  agents: RegistryEntry[];
  subagents: RegistryEntry[];
  commands: RegistryEntry[];
  abilities: RegistryEntry[];
  context: RegistryEntry[];
  workflows: RegistryEntry[];
  snippets: RegistryEntry[];
  templates: RegistryEntry[];
  tools: RegistryEntry[];
  scripts: RegistryEntry[];
  edges: RegistryEdge[];
  studioConfig: RegistryStudioConfig;
  projections: { outputDir: string | null; outputs: { file: string; title: string; consumedBy: string[] }[] };
}

interface Manifest {
  name?: string;
  displayName?: string;
  version?: string;
  domain?: string;
  subdomain?: string;
  agents?: string[];
  subagents?: string[];
  commands?: string[];
  context?: string[];
  abilities?: string[];
  tools?: string[];
  scripts?: string[];
}

interface Projections {
  outputDir?: string;
  outputs?: { file: string; title?: string }[];
  consumers?: Record<string, string[]>;
}

interface SnippetEntry {
  id: string;
  path: string;
  description?: string;
  language?: string;
  priority?: string;
  standardsVersion?: string;
}

interface SnippetManifest {
  schemaVersion?: number;
  standardsVersion?: string;
  snippets?: SnippetEntry[];
}

interface TemplateEntry {
  id: string;
  path: string;
  description?: string;
  priority?: string;
  standardsVersion?: string;
  files?: string[];
}

interface TemplateManifest {
  schemaVersion?: number;
  standardsVersion?: string;
  templates?: TemplateEntry[];
}

function toPosix(path: string): string {
  return path.split(sep).join('/');
}

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function walkFiles(dir: string, base: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (isDir(full)) walkFiles(full, base, out);
    else out.push(toPosix(relative(base, full)));
  }
  return out;
}

function entry(
  domainDir: string,
  relPath: string,
  id: string,
  consumes: string[],
  layer?: RegistryEntry['layer']
): RegistryEntry {
  const fm = readFrontmatter(join(domainDir, relPath));
  return {
    id,
    name: frontmatterString(fm, 'name') || id,
    path: relPath,
    description: frontmatterString(fm, 'description'),
    consumes: consumes.length > 0 ? consumes : undefined,
    layer,
  };
}

function candidateKeys(path: string, id: string): string[] {
  const noExt = path.replace(/\.md$/, '');
  const keys = new Set<string>([noExt, id]);
  if (noExt.startsWith('agent/')) keys.add(noExt.slice('agent/'.length));
  return [...keys];
}

function consumedOutputs(path: string, id: string, consumers: Record<string, string[]>): string[] {
  const keys = candidateKeys(path, id);
  const out = new Set<string>();
  for (const key of keys) {
    for (const output of consumers[key] ?? []) out.add(output);
  }
  return [...out];
}

function readKindManifest<T>(
  domainDir: string,
  context: string[] | undefined,
  kind: string
): { baseDir: string; manifest: T } | null {
  for (const rel of context ?? []) {
    const full = join(domainDir, rel);
    if (!isDir(full)) continue;
    const manifestPath = join(full, kind, 'manifest.json');
    const manifest = readJson<T>(manifestPath);
    if (manifest) return { baseDir: toPosix(join(rel, kind)), manifest };
  }
  return null;
}

function absentStudioConfig(): RegistryStudioConfig {
  const defaults = defaultStudioConfig();
  return {
    present: false,
    path: null,
    studioMode: defaults.studioMode,
    reviewIntensity: defaults.reviewIntensity,
    toggles: { ...defaults.toggles },
    patterns: [],
    packages: [],
    conflicts: [],
    problems: [],
    valid: true,
  };
}

function buildStudioConfig(domainDir: string, opencodeDir?: string): RegistryStudioConfig {
  const opencodePath = opencodeDir ? join(opencodeDir, 'unity-studio.json') : null;
  const domainPath = join(domainDir, 'unity-studio.json');
  const catalogPath = findPatternCatalog({ domainDir, opencodeDir });

  // Prefer the installed `.opencode/unity-studio.json`; fall back to the default
  // config shipped with the domain; otherwise the fail-soft defaults.
  let resolved = resolveStudioConfigProject({ configPath: opencodePath ?? domainPath, catalogPath });
  if (opencodePath && !resolved.present) {
    resolved = resolveStudioConfigProject({ configPath: domainPath, catalogPath });
  }
  if (!resolved.present) return absentStudioConfig();

  return {
    present: true,
    path: resolved.configPath,
    studioMode: resolved.resolution.config.studioMode,
    reviewIntensity: resolved.resolution.config.reviewIntensity,
    toggles: resolved.resolution.config.toggles,
    patterns: resolved.resolution.enabledPatterns,
    packages: resolved.resolution.enabledPackages,
    conflicts: resolved.resolution.conflicts,
    problems: resolved.resolution.problems,
    valid: resolved.resolution.valid,
  };
}

export function buildRegistry(domainDir: string, generatedAt: string, opencodeDir?: string): Registry {
  const manifest = readJson<Manifest>(join(domainDir, 'sb-domain.json')) ?? {};
  const projections = readJson<Projections>(join(domainDir, 'context-projections.json')) ?? {};
  const consumers = projections.consumers ?? {};
  const studioConfig = buildStudioConfig(domainDir, opencodeDir);

  const mapEntries = (paths: string[] | undefined, layer?: RegistryEntry['layer']): RegistryEntry[] =>
    (paths ?? []).map((rel) => entry(domainDir, rel, basename(rel, '.md'), consumedOutputs(rel, basename(rel, '.md'), consumers), layer));

  const agents = mapEntries(manifest.agents);
  const subagents = mapEntries(manifest.subagents);
  const commands = mapEntries(manifest.commands, 'command');

  const abilities: RegistryEntry[] = (manifest.abilities ?? []).map((ability) => {
    const rel = `command/${ability}.md`;
    const exists = (() => {
      try {
        return statSync(join(domainDir, rel)).isFile();
      } catch {
        return false;
      }
    })();
    return { id: ability, name: ability, path: rel, realisedAs: exists ? rel : undefined, layer: 'ability' };
  });

  const contextFiles = (manifest.context ?? []).flatMap((rel) => {
    const full = join(domainDir, rel);
    return isDir(full) ? walkFiles(full, domainDir) : [rel];
  });
  const context = contextFiles
    .filter((rel) => rel.endsWith('.md'))
    .filter((rel) => !rel.includes('/snippets/') && !rel.includes('/templates/'))
    .map((rel) => entry(domainDir, rel, basename(rel, '.md'), consumedOutputs(rel, basename(rel, '.md'), consumers)));
  const workflows = context.filter((c) => c.path.includes('/workflows/'));

  const snippetsManifest = readKindManifest<SnippetManifest>(domainDir, manifest.context, 'snippets');
  const templatesManifest = readKindManifest<TemplateManifest>(domainDir, manifest.context, 'templates');

  const snippets: RegistryEntry[] = (snippetsManifest?.manifest.snippets ?? []).map((snippet) => ({
    id: snippet.id,
    name: snippet.id,
    path: `${snippetsManifest?.baseDir ?? 'context/unity-3d/snippets'}/${snippet.path}`,
    description: snippet.description,
    standardsVersion: snippet.standardsVersion ?? snippetsManifest?.manifest.standardsVersion,
  }));

  const templates: RegistryEntry[] = (templatesManifest?.manifest.templates ?? []).map((template) => ({
    id: template.id,
    name: template.id,
    path: `${templatesManifest?.baseDir ?? 'context/unity-3d/templates'}/${template.path}/README.md`,
    description: template.description,
    standardsVersion: template.standardsVersion ?? templatesManifest?.manifest.standardsVersion,
  }));

  const tools: RegistryEntry[] = (manifest.tools ?? []).map((tool) => ({ id: tool, name: tool, path: `tools/${tool}`, layer: 'tool' as const }));
  const scripts: RegistryEntry[] = (manifest.scripts ?? []).map((script) => ({ id: basename(script), name: basename(script), path: script }));

  const outputs = (projections.outputs ?? []).map((output) => {
    const consumedBy = Object.entries(consumers)
      .filter(([, files]) => files.includes(output.file))
      .map(([consumer]) => consumer);
    return { file: output.file, title: output.title ?? output.file, consumedBy };
  });

  const edges: RegistryEdge[] = [];
  const addEdges = (type: RegistryEdgeType, from: string, tos: string[]): void => {
    for (const to of tos) edges.push({ type, from, to });
  };

  for (const rel of [...(manifest.agents ?? []), ...(manifest.subagents ?? [])]) {
    const fm = readFrontmatter(join(domainDir, rel));
    addEdges('agent-ability', basename(rel, '.md'), frontmatterStringArray(fm, 'abilities') ?? []);
  }

  for (const workflow of workflows) {
    const fm = readFrontmatter(join(domainDir, workflow.path));
    addEdges('workflow-ability', workflow.id, frontmatterStringArray(fm, 'abilities') ?? []);
    addEdges('workflow-agent', workflow.id, frontmatterStringArray(fm, 'agents') ?? []);
  }

  const counts = {
    agents: agents.length,
    subagents: subagents.length,
    commands: commands.length,
    abilities: abilities.length,
    context: context.length,
    workflows: workflows.length,
    snippets: snippets.length,
    templates: templates.length,
    tools: tools.length,
    scripts: scripts.length,
    edges: edges.length,
    studioPatterns: studioConfig.patterns.length,
  };

  return {
    schemaVersion: 1,
    generatedAt,
    domain: manifest.domain ?? '',
    subdomain: manifest.subdomain ?? manifest.name ?? '',
    displayName: manifest.displayName ?? manifest.name ?? '',
    version: manifest.version ?? '',
    counts,
    agents,
    subagents,
    commands,
    abilities,
    context,
    workflows,
    snippets,
    templates,
    tools,
    scripts,
    edges,
    studioConfig,
    projections: { outputDir: projections.outputDir ?? null, outputs },
  };
}
