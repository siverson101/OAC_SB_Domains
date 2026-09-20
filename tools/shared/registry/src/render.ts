import type { Registry, RegistryEdge, RegistryEntry } from './build';

function escapeCell(value: string | undefined): string {
  return (value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function entriesTable(
  entries: RegistryEntry[],
  options: { realised?: boolean; consumes?: boolean; layer?: boolean } = {}
): string[] {
  const lines: string[] = [];
  const header = ['Id', 'Name', 'Path', 'Description'];
  if (options.layer) header.push('Layer');
  if (options.realised) header.push('Realised as');
  if (options.consumes) header.push('Consumes');
  lines.push(`| ${header.join(' | ')} |`);
  lines.push(`|${header.map(() => '---').join('|')}|`);
  for (const entry of entries) {
    const row = [entry.id, entry.name, `\`${entry.path}\``, escapeCell(entry.description)];
    if (options.layer) row.push(entry.layer ?? '');
    if (options.realised) row.push(entry.realisedAs ? `\`${entry.realisedAs}\`` : '');
    if (options.consumes) row.push(escapeCell((entry.consumes ?? []).join(', ')));
    lines.push(`| ${row.join(' | ')} |`);
  }
  return lines;
}

function section(
  lines: string[],
  title: string,
  entries: RegistryEntry[],
  options?: { realised?: boolean; consumes?: boolean; layer?: boolean }
): void {
  if (entries.length === 0) return;
  lines.push(`## ${title}`);
  lines.push('');
  lines.push(...entriesTable(entries, options));
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

  section(lines, 'Agents', registry.agents, { consumes: true });
  section(lines, 'SubAgents', registry.subagents, { consumes: true });
  section(lines, 'Commands', registry.commands, { consumes: true, layer: true });
  section(lines, 'Abilities', registry.abilities, { realised: true, layer: true });
  section(lines, 'Context', registry.context, { consumes: true });
  section(lines, 'Workflows', registry.workflows, { consumes: true });
  section(lines, 'Tools', registry.tools, { layer: true });
  section(lines, 'Scripts', registry.scripts);

  edgesSection(lines, registry.edges);

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
