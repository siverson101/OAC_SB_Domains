import { readdirSync, statSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';
import { readJson } from '../../../shared/io';
import { frontmatterString, readFrontmatter } from './frontmatter';

export interface RegistryEntry {
  id: string;
  name: string;
  path: string;
  description?: string;
  realisedAs?: string;
  consumes?: string[];
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
  tools: RegistryEntry[];
  scripts: RegistryEntry[];
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

function entry(domainDir: string, relPath: string, id: string, consumes: string[]): RegistryEntry {
  const fm = readFrontmatter(join(domainDir, relPath));
  return {
    id,
    name: frontmatterString(fm, 'name') || id,
    path: relPath,
    description: frontmatterString(fm, 'description'),
    consumes: consumes.length > 0 ? consumes : undefined,
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

export function buildRegistry(domainDir: string, generatedAt: string): Registry {
  const manifest = readJson<Manifest>(join(domainDir, 'sb-domain.json')) ?? {};
  const projections = readJson<Projections>(join(domainDir, 'context-projections.json')) ?? {};
  const consumers = projections.consumers ?? {};

  const mapEntries = (paths: string[] | undefined, folder: string): RegistryEntry[] =>
    (paths ?? []).map((rel) => entry(domainDir, rel, basename(rel, '.md'), consumedOutputs(rel, basename(rel, '.md'), consumers)));

  const agents = mapEntries(manifest.agents, 'agent');
  const subagents = mapEntries(manifest.subagents, 'subagents');
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
    return { id: ability, name: ability, path: rel, realisedAs: exists ? rel : undefined };
  });

  const contextFiles = (manifest.context ?? []).flatMap((rel) => {
    const full = join(domainDir, rel);
    return isDir(full) ? walkFiles(full, domainDir) : [rel];
  });
  const context = contextFiles
    .filter((rel) => rel.endsWith('.md'))
    .map((rel) => entry(domainDir, rel, basename(rel, '.md'), consumedOutputs(rel, basename(rel, '.md'), consumers)));
  const workflows = context.filter((c) => c.path.includes('/workflows/'));

  const tools: RegistryEntry[] = (manifest.tools ?? []).map((tool) => ({ id: tool, name: tool, path: `tools/${tool}` }));
  const scripts: RegistryEntry[] = (manifest.scripts ?? []).map((script) => ({ id: basename(script), name: basename(script), path: script }));

  const outputs = (projections.outputs ?? []).map((output) => {
    const consumedBy = Object.entries(consumers)
      .filter(([, files]) => files.includes(output.file))
      .map(([consumer]) => consumer);
    return { file: output.file, title: output.title ?? output.file, consumedBy };
  });

  const counts = {
    agents: agents.length,
    subagents: subagents.length,
    commands: commands.length,
    abilities: abilities.length,
    context: context.length,
    workflows: workflows.length,
    tools: tools.length,
    scripts: scripts.length,
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
    tools,
    scripts,
    projections: { outputDir: projections.outputDir ?? null, outputs },
  };
}
