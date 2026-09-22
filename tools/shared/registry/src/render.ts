import { renderStudioConfigLines } from '../../../unity/studio-config/src/resolve';
import type { Registry, RegistryEdge, RegistryEntry, RegistryStudioConfig } from './build';

function escapeCell(value: string | undefined): string {
  return (value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function entriesTable(
  entries: RegistryEntry[],
  options: {
    realised?: boolean;
    consumes?: boolean;
    layer?: boolean;
    standards?: boolean;
    tier?: boolean;
    model?: boolean;
  } = {}
): string[] {
  const lines: string[] = [];
  const header = ['Id', 'Name', 'Path', 'Description'];
  if (options.tier) header.push('Tier');
  if (options.model) header.push('Model');
  if (options.layer) header.push('Layer');
  if (options.realised) header.push('Realised as');
  if (options.consumes) header.push('Consumes');
  if (options.standards) header.push('Standards');
  lines.push(`| ${header.join(' | ')} |`);
  lines.push(`|${header.map(() => '---').join('|')}|`);
  for (const entry of entries) {
    const row = [entry.id, entry.name, `\`${entry.path}\``, escapeCell(entry.description)];
    if (options.tier) row.push(entry.tier ?? '');
    if (options.model) row.push(entry.model ?? '');
    if (options.layer) row.push(entry.layer ?? '');
    if (options.realised) row.push(entry.realisedAs ? `\`${entry.realisedAs}\`` : '');
    if (options.consumes) row.push(escapeCell((entry.consumes ?? []).join(', ')));
    if (options.standards) row.push(entry.standardsVersion ?? '');
    lines.push(`| ${row.join(' | ')} |`);
  }
  return lines;
}

function section(
  lines: string[],
  title: string,
  entries: RegistryEntry[],
  options?: {
    realised?: boolean;
    consumes?: boolean;
    layer?: boolean;
    standards?: boolean;
    tier?: boolean;
    model?: boolean;
  }
): void {
  if (entries.length === 0) return;
  lines.push(`## ${title}`);
  lines.push('');
  lines.push(...entriesTable(entries, options));
  lines.push('');
}

function studioConfigSection(lines: string[], studio: RegistryStudioConfig): void {
  lines.push('## Studio Config');
  lines.push('');
  if (studio.present) {
    lines.push(`Source: \`${studio.path ?? 'unity-studio.json'}\``);
    lines.push('');
  } else {
    lines.push('> No `.opencode/unity-studio.json` found; using defaults (fail-soft).');
    lines.push('');
  }
  lines.push(...renderStudioConfigLines(studio));
  lines.push('');
}

const EDGE_ORDER: RegistryEdge['type'][] = ['agent-ability', 'workflow-ability', 'workflow-agent'];

function edgesSection(lines: string[], edges: RegistryEdge[]): void {
  if (edges.length === 0) return;
  lines.push('## Edges');
  lines.push('');
  for (const type of EDGE_ORDER) {
    const group = edges.filter((edge) => edge.type === type);
    if (group.length === 0) continue;
    lines.push(`### ${type}`);
    lines.push('');
    for (const edge of group) lines.push(`- \`${edge.from}\` → \`${edge.to}\``);
    lines.push('');
  }
}

function warningsSection(lines: string[], warnings: string[]): void {
  if (warnings.length === 0) return;
  lines.push('## Warnings');
  lines.push('');
  for (const warning of warnings) lines.push(`- ${warning}`);
  lines.push('');
}

export function renderRegistry(registry: Registry): string {
  const lines: string[] = [];
  const date = registry.generatedAt.slice(0, 10);
  lines.push(`<!-- Context: ${registry.subdomain}/registry | Priority: high | Version: 1.0 | Updated: ${date} -->`);
  lines.push('');
  lines.push(`# ${registry.displayName} Registry`);
  lines.push('');
  lines.push('> Generated from `sb-domain.json`, asset frontmatter, and `context-projections.json`.');
  lines.push('> Do not edit by hand; regenerate with `build-registry.mjs`.');
  lines.push('');
  lines.push(`- Domain: \`${registry.domain}\``);
  lines.push(`- Sub-domain: \`${registry.subdomain}\``);
  lines.push(`- Version: ${registry.version}`);
  lines.push(`- Generated: ${registry.generatedAt}`);
  lines.push('');
  lines.push('## Counts');
  lines.push('');
  for (const [key, value] of Object.entries(registry.counts)) lines.push(`- ${key}: ${value}`);
  lines.push('');
  lines.push('> Layering: **tool** = thin typed adapter (no workflow logic); **ability** = named capability composing tools; **command** = user-invocable entry realising an ability (ADR-0004 / ADR-0012).');
  lines.push('');

  studioConfigSection(lines, registry.studioConfig);

  section(lines, 'Agents', registry.agents, { consumes: true, tier: true, model: true });
  section(lines, 'SubAgents', registry.subagents, { consumes: true, tier: true, model: true });
  section(lines, 'Commands', registry.commands, { consumes: true, layer: true });
  section(lines, 'Abilities', registry.abilities, { realised: true, layer: true });
  section(lines, 'Context', registry.context, { consumes: true });
  section(lines, 'Workflows', registry.workflows, { consumes: true });
  section(lines, 'Recipes', registry.recipes);
  section(lines, 'Snippets', registry.snippets, { standards: true });
  section(lines, 'Templates', registry.templates, { standards: true });
  section(lines, 'Tools', registry.tools, { layer: true });
  section(lines, 'Scripts', registry.scripts);

  edgesSection(lines, registry.edges);

  warningsSection(lines, registry.warnings);

  if (registry.projections.outputs.length > 0) {
    lines.push('## Projected Context');
    lines.push('');
    if (registry.projections.outputDir) {
      lines.push(`Output directory: \`${registry.projections.outputDir}\``);
      lines.push('');
    }
    lines.push('| File | Title | Consumed by |');
    lines.push('|---|---|---|');
    for (const output of registry.projections.outputs) {
      lines.push(`| \`${output.file}\` | ${escapeCell(output.title)} | ${escapeCell(output.consumedBy.join(', '))} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
