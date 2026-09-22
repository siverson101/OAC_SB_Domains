import { readdirSync, statSync } from 'node:fs';
import { basename, join, relative, resolve, sep } from 'node:path';
import { findPatternCatalog } from '../../../shared/context-files';
import { readJson, readText } from '../../../shared/io';
import {
  defaultStudioConfig,
  MODEL_TIERS,
  optionalPaths,
  resolveStudioConfigProject,
  selectActiveRoster,
  STUDIO_MODES,
  type ConfigProblem,
  type ModelTier,
  type ModelTiers,
  type PatternConflict,
  type ReviewIntensity,
  type StudioGates,
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
  // Agents and subagents only: the abstract tier from frontmatter and, when the
  // studio config maps that tier, the resolved concrete model id.
  tier?: ModelTier;
  model?: string;
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
  modelTiers: ModelTiers;
  conflicts: PatternConflict[];
  problems: ConfigProblem[];
  valid: boolean;
}

// The prose `## Delegation Map` bullets from an agent file, surfaced verbatim
// (continuation lines folded) so the blueprint mirrors what the agent declares.
export interface AgentDelegationMap {
  reportsTo?: string;
  implementsFrom?: string;
  escalationTargets?: string;
  siblings?: string;
}

export interface BlueprintAgent {
  id: string;
  name: string;
  path: string;
  role: 'agent' | 'subagent';
  tier?: ModelTier;
  model?: string;
  abilities: string[];
  optional: boolean;
  gate?: string;
  delegation: AgentDelegationMap;
}

export interface BlueprintHierarchy {
  mode: StudioMode;
  agents: BlueprintAgent[];
  subagents: BlueprintAgent[];
}

// FR8 agent-system blueprint: every hierarchy a studio mode can install (not
// just the active one), with per-agent ability allowlists, delegation maps, and
// resolved model tiers.
export interface AgentSystemBlueprint {
  domain: string;
  subdomain: string;
  displayName: string;
  version: string;
  modelTiers: ModelTiers;
  hierarchies: BlueprintHierarchy[];
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
  recipes: RegistryEntry[];
  snippets: RegistryEntry[];
  templates: RegistryEntry[];
  tools: RegistryEntry[];
  scripts: RegistryEntry[];
  edges: RegistryEdge[];
  warnings: string[];
  studioConfig: RegistryStudioConfig;
  agentSystem: AgentSystemBlueprint;
  projections: { outputDir: string | null; outputs: { file: string; title: string; consumedBy: string[] }[] };
}

interface StudioModeRoster {
  agents?: string[];
  subagents?: string[];
  optional?: (string | { path?: string })[];
}

interface Manifest {
  name?: string;
  displayName?: string;
  version?: string;
  domain?: string;
  subdomain?: string;
  agents?: string[];
  subagents?: string[];
  studioModes?: Record<string, StudioModeRoster>;
  commands?: string[];
  context?: string[];
  abilities?: string[];
  recipes?: string[];
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

// Membership lives only in `studioModes`; a manifest without it falls back to
// the legacy flat arrays (fail-soft for domains that predate studio modes).
// The gating condition is read once, from each optional agent's frontmatter
// `enabledBy`, through the shared `selectActiveRoster` semantics the apply
// engine also uses.
function selectStudioRoster(
  manifest: Manifest,
  studioMode: StudioMode,
  gates: StudioGates,
  domainDir: string
): { agents: string[]; subagents: string[] } {
  const mode = manifest.studioModes?.[studioMode];
  if (!mode) return { agents: manifest.agents ?? [], subagents: manifest.subagents ?? [] };
  return selectActiveRoster(
    {
      agents: mode.agents ?? [],
      subagents: mode.subagents ?? [],
      optional: optionalPaths(mode.optional),
    },
    gates,
    (rel) => frontmatterString(readFrontmatter(join(domainDir, rel)), 'enabledBy')
  );
}

// Every agent any mode can install, for validating cross-hierarchy workflow
// edges without depending on the active mode, and for the doc-drift check.
export function allStudioAgents(manifest: Manifest): string[] {
  if (!manifest.studioModes) return [...(manifest.agents ?? []), ...(manifest.subagents ?? [])];
  const out: string[] = [];
  for (const mode of Object.values(manifest.studioModes)) {
    out.push(...(mode.agents ?? []), ...(mode.subagents ?? []), ...optionalPaths(mode.optional));
  }
  return out;
}

// Native detection reads the standard project-data artifact (written by
// project-scan); a missing file or a merely declared solution is "not
// detected". Affirmative means the solution file exists.
//
// Keep in sync with detectNativeSubproject in xdomains/merge-domains.js;
// pinned by tests/gating-agreement.test.ts.
export function nativeSubprojectPresent(opencodeDir?: string): boolean {
  if (!opencodeDir) return false;
  const artifact = readJson<{ state?: { solutionExists?: boolean } }>(
    join(opencodeDir, 'project-data', 'native-project-state.json')
  );
  return artifact?.state?.solutionExists === true;
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

function asModelTier(value: string | undefined): ModelTier | undefined {
  return value && (MODEL_TIERS as readonly string[]).includes(value) ? (value as ModelTier) : undefined;
}

function parseDelegationMap(content: string): AgentDelegationMap {
  const marker = '## Delegation Map';
  const start = content.indexOf(marker);
  if (start === -1) return {};
  const fields: Record<string, string> = {};
  let current: string | null = null;
  let buffer: string[] = [];
  const flush = (): void => {
    if (current) fields[current] = buffer.join(' ').replace(/\s+/g, ' ').trim();
    current = null;
    buffer = [];
  };
  for (const line of content.slice(start + marker.length).split(/\r?\n/)) {
    if (/^##\s/.test(line)) break;
    const bullet = /^\s*-\s*\*\*([^*]+)\*\*:\s*(.*)$/.exec(line);
    if (bullet) {
      flush();
      current = bullet[1].trim().toLowerCase();
      buffer = [bullet[2]];
      continue;
    }
    if (line.trim() === '') {
      flush();
      continue;
    }
    if (/^\s/.test(line)) {
      if (current) buffer.push(line.trim());
      continue;
    }
    break;
  }
  flush();
  return {
    reportsTo: fields['reports to'],
    implementsFrom: fields['implements from'],
    escalationTargets: fields['escalation targets'],
    siblings: fields['siblings'],
  };
}

function blueprintAgent(
  domainDir: string,
  rel: string,
  role: BlueprintAgent['role'],
  optional: boolean,
  modelTiers: ModelTiers
): BlueprintAgent {
  const fm = readFrontmatter(join(domainDir, rel));
  const id = basename(rel, '.md');
  const tier = asModelTier(frontmatterString(fm, 'tier'));
  return {
    id,
    name: frontmatterString(fm, 'name') || id,
    path: rel,
    role,
    tier,
    model: tier ? modelTiers[tier] : undefined,
    abilities: frontmatterStringArray(fm, 'abilities') ?? [],
    optional,
    gate: optional ? frontmatterString(fm, 'enabledBy') : undefined,
    delegation: parseDelegationMap(readText(join(domainDir, rel)) ?? ''),
  };
}

function buildAgentSystem(manifest: Manifest, domainDir: string, modelTiers: ModelTiers): AgentSystemBlueprint {
  const hierarchies: BlueprintHierarchy[] = [];
  if (manifest.studioModes) {
    for (const mode of STUDIO_MODES) {
      const roster = manifest.studioModes[mode];
      if (!roster) continue;
      hierarchies.push({
        mode,
        agents: (roster.agents ?? []).map((rel) => blueprintAgent(domainDir, rel, 'agent', false, modelTiers)),
        subagents: [
          ...(roster.subagents ?? []).map((rel) => blueprintAgent(domainDir, rel, 'subagent', false, modelTiers)),
          ...optionalPaths(roster.optional).map((rel) => blueprintAgent(domainDir, rel, 'subagent', true, modelTiers)),
        ],
      });
    }
  } else {
    hierarchies.push({
      mode: 'lean',
      agents: (manifest.agents ?? []).map((rel) => blueprintAgent(domainDir, rel, 'agent', false, modelTiers)),
      subagents: (manifest.subagents ?? []).map((rel) => blueprintAgent(domainDir, rel, 'subagent', false, modelTiers)),
    });
  }
  return {
    domain: manifest.domain ?? '',
    subdomain: manifest.subdomain ?? manifest.name ?? '',
    displayName: manifest.displayName ?? manifest.name ?? '',
    version: manifest.version ?? '',
    modelTiers,
    hierarchies,
  };
}

function entry(
  domainDir: string,
  relPath: string,
  id: string,
  consumes: string[],
  layer?: RegistryEntry['layer'],
  modelTiers?: ModelTiers
): RegistryEntry {
  const fm = readFrontmatter(join(domainDir, relPath));
  // `modelTiers` is passed for agents/subagents (which carry a `tier`) and
  // omitted for every other entry kind, so tier resolution is intentionally
  // conditional. Do not resolve a tier for entries that have no such concept.
  const tier = modelTiers ? asModelTier(frontmatterString(fm, 'tier')) : undefined;
  return {
    id,
    name: frontmatterString(fm, 'name') || id,
    path: relPath,
    description: frontmatterString(fm, 'description'),
    consumes: consumes.length > 0 ? consumes : undefined,
    layer,
    tier,
    model: tier ? modelTiers?.[tier] : undefined,
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
    modelTiers: { ...defaults.modelTiers },
    conflicts: [],
    problems: [],
    valid: true,
  };
}

function buildStudioConfig(
  domainDir: string,
  opencodeDir?: string,
  studioConfigPath?: string
): RegistryStudioConfig {
  const opencodePath = opencodeDir ? join(opencodeDir, 'unity-studio.json') : null;
  const domainPath = join(domainDir, 'unity-studio.json');
  const catalogPath = findPatternCatalog({ domainDir, opencodeDir });

  // Prefer an explicit `--studio-config` path (used by `build:docs` so the
  // committed blueprint depends on the domain's shipped config, never on a
  // developer's untracked `.opencode/unity-studio.json`); then the installed
  // `.opencode/unity-studio.json`; then the config shipped with the domain;
  // otherwise the fail-soft defaults.
  let resolved = studioConfigPath
    ? resolveStudioConfigProject({ configPath: resolve(studioConfigPath), catalogPath })
    : resolveStudioConfigProject({ configPath: opencodePath ?? domainPath, catalogPath });
  if (!resolved.present && resolved.configPath !== domainPath) {
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
    modelTiers: resolved.resolution.config.modelTiers,
    conflicts: resolved.resolution.conflicts,
    problems: resolved.resolution.problems,
    valid: resolved.resolution.valid,
  };
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

// Recipe step `abilities`/`agents` arrays are the source of the workflow↔ability
// and workflow↔agent edges (ADR-0016), the JSON analogue of the workflow
// frontmatter allowlists.
function recipeLinks(data: unknown): { abilities: string[]; agents: string[] } {
  const abilities = new Set<string>();
  const agents = new Set<string>();
  const phases = asObject(data)?.phases;
  for (const phaseRaw of Array.isArray(phases) ? phases : []) {
    const steps = asObject(phaseRaw)?.steps;
    for (const stepRaw of Array.isArray(steps) ? steps : []) {
      const step = asObject(stepRaw);
      if (!step) continue;
      for (const ability of stringList(step.abilities)) abilities.add(ability);
      for (const agent of stringList(step.agents)) agents.add(agent);
    }
  }
  return { abilities: [...abilities], agents: [...agents] };
}

export function buildRegistry(
  domainDir: string,
  generatedAt: string,
  opencodeDir?: string,
  studioConfigPath?: string
): Registry {
  const manifest = readJson<Manifest>(join(domainDir, 'sb-domain.json')) ?? {};
  const projections = readJson<Projections>(join(domainDir, 'context-projections.json')) ?? {};
  const consumers = projections.consumers ?? {};
  const studioConfig = buildStudioConfig(domainDir, opencodeDir, studioConfigPath);

  const mapEntries = (
    paths: string[] | undefined,
    layer?: RegistryEntry['layer'],
    modelTiers?: ModelTiers
  ): RegistryEntry[] =>
    (paths ?? []).map((rel) =>
      entry(domainDir, rel, basename(rel, '.md'), consumedOutputs(rel, basename(rel, '.md'), consumers), layer, modelTiers)
    );

  const gates: StudioGates = {
    tdd: studioConfig.toggles.tdd === true,
    'native-subproject': nativeSubprojectPresent(opencodeDir),
  };
  const roster = selectStudioRoster(manifest, studioConfig.studioMode, gates, domainDir);
  const agents = mapEntries(roster.agents, undefined, studioConfig.modelTiers);
  const subagents = mapEntries(roster.subagents, undefined, studioConfig.modelTiers);
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

  // Exclude the snippet/template kind dirs by comparing the path segment under
  // each context dir, so a decoy path like `notes/templates/foo.md` is kept.
  const kindDirs = (manifest.context ?? [])
    .filter((rel) => isDir(join(domainDir, rel)))
    .flatMap((rel) => [toPosix(join(rel, 'snippets')), toPosix(join(rel, 'templates'))]);
  const isKindFile = (rel: string): boolean =>
    kindDirs.some((dir) => rel === dir || rel.startsWith(`${dir}/`));

  const contextFiles = (manifest.context ?? []).flatMap((rel) => {
    const full = join(domainDir, rel);
    return isDir(full) ? walkFiles(full, domainDir) : [rel];
  });
  const context = contextFiles
    .filter((rel) => rel.endsWith('.md'))
    .filter((rel) => !isKindFile(rel))
    .map((rel) => entry(domainDir, rel, basename(rel, '.md'), consumedOutputs(rel, basename(rel, '.md'), consumers)));
  const workflows = context.filter((c) => c.path.includes('/workflows/'));

  const snippetsManifest = readKindManifest<SnippetManifest>(domainDir, manifest.context, 'snippets');
  const templatesManifest = readKindManifest<TemplateManifest>(domainDir, manifest.context, 'templates');

  // The fallback only matters when a manifest is absent (no entries are emitted
  // then); derive it from the domain's context dir rather than hardcoding a
  // sub-domain so a non-unity-3d domain keeps correct paths.
  const defaultContextDir =
    (manifest.context ?? []).find((rel) => isDir(join(domainDir, rel))) ??
    `context/${manifest.subdomain ?? manifest.name ?? ''}`;
  const snippetsBaseDir = snippetsManifest?.baseDir ?? toPosix(join(defaultContextDir, 'snippets'));
  const templatesBaseDir = templatesManifest?.baseDir ?? toPosix(join(defaultContextDir, 'templates'));

  const snippets: RegistryEntry[] = (snippetsManifest?.manifest.snippets ?? []).map((snippet) => ({
    id: snippet.id,
    name: snippet.id,
    path: `${snippetsBaseDir}/${snippet.path}`,
    description: snippet.description,
    standardsVersion: snippet.standardsVersion ?? snippetsManifest?.manifest.standardsVersion,
  }));

  const templates: RegistryEntry[] = (templatesManifest?.manifest.templates ?? []).map((template) => ({
    id: template.id,
    name: template.id,
    path: `${templatesBaseDir}/${template.path}/README.md`,
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

  const knownAbilities = new Set(manifest.abilities ?? []);
  const knownAgents = new Set(allStudioAgents(manifest).map((rel) => basename(rel, '.md')));

  const warnings: string[] = [];
  const recipeEntries: RegistryEntry[] = (manifest.recipes ?? []).map((rel) => {
    const data = readJson<Record<string, unknown>>(join(domainDir, rel));
    if (data === null) warnings.push(`declared recipe not found: ${rel}`);
    const id = data && typeof data.id === 'string' ? data.id : basename(rel, '.json');
    return {
      id,
      name: data && typeof data.name === 'string' ? data.name : id,
      path: rel,
      description: data && typeof data.description === 'string' ? data.description : undefined,
    };
  });
  const edges: RegistryEdge[] = [];
  const seenEdges = new Set<string>();
  const addEdges = (type: RegistryEdgeType, from: string, tos: string[]): void => {
    for (const to of tos) {
      const key = `${type}\u0000${from}\u0000${to}`;
      if (seenEdges.has(key)) continue;
      seenEdges.add(key);
      if ((type === 'agent-ability' || type === 'workflow-ability') && !knownAbilities.has(to)) {
        warnings.push(`edge ${type} ${from} -> ${to}: unknown ability`);
        continue;
      }
      if (type === 'workflow-agent' && !knownAgents.has(to)) {
        warnings.push(`edge ${type} ${from} -> ${to}: unknown agent`);
        continue;
      }
      edges.push({ type, from, to });
    }
  };

  for (const rel of [...roster.agents, ...roster.subagents]) {
    const fm = readFrontmatter(join(domainDir, rel));
    addEdges('agent-ability', basename(rel, '.md'), frontmatterStringArray(fm, 'abilities') ?? []);
  }

  // Recipes are the canonical data layer for workflow↔ability/agent edges
  // (ADR-0016). The prose workflows under `context/**/workflows/` describe the
  // same pipelines as knowledge, so their frontmatter is deliberately not an
  // edge source: reading both would emit duplicate/conflicting edges under
  // different ids (e.g. `feature-delivery` vs the `unity-change-loop` recipe).
  // Recipe links go through the same `addEdges` validation as agent allowlists,
  // so an unknown ability/agent is dropped and warned, never silently emitted.
  for (const recipe of recipeEntries) {
    const links = recipeLinks(readJson(join(domainDir, recipe.path)));
    addEdges('workflow-ability', recipe.id, links.abilities);
    addEdges('workflow-agent', recipe.id, links.agents);
  }

  // Deterministic order (type, from, to) so reordering `sb-domain.json` or a
  // frontmatter list does not churn the rendered registry.md.
  edges.sort((a, b) => {
    if (a.type !== b.type) return a.type < b.type ? -1 : 1;
    if (a.from !== b.from) return a.from < b.from ? -1 : 1;
    if (a.to !== b.to) return a.to < b.to ? -1 : 1;
    return 0;
  });

  const counts = {
    agents: agents.length,
    subagents: subagents.length,
    commands: commands.length,
    abilities: abilities.length,
    context: context.length,
    workflows: workflows.length,
    recipes: recipeEntries.length,
    snippets: snippets.length,
    templates: templates.length,
    tools: tools.length,
    scripts: scripts.length,
    edges: edges.length,
    warnings: warnings.length,
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
    recipes: recipeEntries,
    snippets,
    templates,
    tools,
    scripts,
    edges,
    warnings,
    studioConfig,
    agentSystem: buildAgentSystem(manifest, domainDir, studioConfig.modelTiers),
    projections: { outputDir: projections.outputDir ?? null, outputs },
  };
}
