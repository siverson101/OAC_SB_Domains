import { renderStudioConfigLines } from '../../../unity/studio-config/src/resolve';
import type { VersionMatrix } from '../../unity-version';
import type {
  AgentSystemBlueprint,
  BlueprintAgent,
  Registry,
  RegistryEdge,
  RegistryEntry,
  RegistryStudioConfig,
} from './build';

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

function hierarchyTitle(mode: string): string {
  return mode === 'full' ? 'Full Studio Hierarchy' : `${mode.charAt(0).toUpperCase()}${mode.slice(1)} Hierarchy`;
}

function blueprintAgentTable(agents: BlueprintAgent[]): string[] {
  const lines: string[] = [];
  lines.push('| Id | Name | Path | Tier | Model | Abilities | Gate |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const agent of agents) {
    lines.push(
      `| ${agent.id} | ${escapeCell(agent.name)} | \`${agent.path}\` | ${agent.tier ?? ''} | ${agent.model ?? ''} | ${escapeCell(agent.abilities.join(', '))} | ${agent.optional ? escapeCell(agent.gate ?? 'gated') : ''} |`
    );
  }
  return lines;
}

function delegationMapLines(agents: BlueprintAgent[]): string[] {
  const lines: string[] = [];
  const withMaps = agents.filter((agent) => Object.values(agent.delegation).some((value) => value));
  if (withMaps.length === 0) return lines;
  lines.push('### Delegation Maps');
  lines.push('');
  for (const agent of withMaps) {
    const parts: string[] = [];
    if (agent.delegation.reportsTo) parts.push(`Reports to: ${agent.delegation.reportsTo}`);
    if (agent.delegation.implementsFrom) parts.push(`Implements from: ${agent.delegation.implementsFrom}`);
    if (agent.delegation.escalationTargets) parts.push(`Escalation targets: ${agent.delegation.escalationTargets}`);
    if (agent.delegation.siblings) parts.push(`Siblings: ${agent.delegation.siblings}`);
    lines.push(`- **${agent.id}** — ${parts.join('; ')}`);
  }
  lines.push('');
  return lines;
}

function blueprintHierarchy(lines: string[], hierarchy: AgentSystemBlueprint['hierarchies'][number]): void {
  lines.push(`## ${hierarchyTitle(hierarchy.mode)}`);
  lines.push('');
  lines.push(
    `Orchestrator: ${hierarchy.agents.map((agent) => `\`${agent.id}\``).join(', ') || '(none)'}; subagents: ${hierarchy.subagents.length}.`
  );
  lines.push('');
  if (hierarchy.agents.length > 0) {
    lines.push('### Agents');
    lines.push('');
    lines.push(...blueprintAgentTable(hierarchy.agents));
    lines.push('');
  }
  if (hierarchy.subagents.length > 0) {
    lines.push('### SubAgents');
    lines.push('');
    lines.push(...blueprintAgentTable(hierarchy.subagents));
    lines.push('');
  }
  lines.push(...delegationMapLines([...hierarchy.agents, ...hierarchy.subagents]));
}

// The FR8 agent-system blueprint. Deliberately timestamp-free so the committed
// copy can be drift-checked byte-for-byte by `bun run build:check`.
export function renderAgentSystemBlueprint(registry: Registry): string {
  const blueprint = registry.agentSystem;
  const lines: string[] = [];
  lines.push(`<!-- Context: ${blueprint.subdomain}/agent-system-blueprint | Priority: high | Version: 1.0 -->`);
  lines.push('');
  lines.push(`# ${blueprint.displayName} Agent System Blueprint`);
  lines.push('');
  lines.push('> Generated from `sb-domain.json`, agent frontmatter, and the studio config. Do not edit by hand; regenerate with `build-registry.mjs`.');
  lines.push('');
  lines.push(`- Domain: \`${blueprint.domain}\``);
  lines.push(`- Sub-domain: \`${blueprint.subdomain}\``);
  lines.push(`- Version: ${blueprint.version}`);
  lines.push('');
  lines.push('## Model Tiers');
  lines.push('');
  lines.push('| Tier | Model |');
  lines.push('|---|---|');
  for (const tier of ['router', 'lead', 'specialist']) {
    lines.push(`| ${tier} | ${blueprint.modelTiers[tier as keyof typeof blueprint.modelTiers] ?? '(unset)'} |`);
  }
  lines.push('');
  for (const hierarchy of blueprint.hierarchies) blueprintHierarchy(lines, hierarchy);
  return lines.join('\n');
}

function featureMark(enabled: boolean | undefined): string {
  return enabled === true ? 'yes' : 'no';
}

// The version-matrix doc, generated from `xdomains/context/unity/version-matrix.json`.
// Timestamp-free for the same drift-check reason as the blueprint.
export function renderVersionMatrixDoc(matrix: VersionMatrix, subdomain: string): string {
  const versions = matrix.versions ?? [];
  const lines: string[] = [];
  lines.push(`<!-- Context: ${subdomain}/version-matrix | Priority: high | Version: 1.0 -->`);
  lines.push('');
  lines.push('# Unity Version Matrix');
  lines.push('');
  lines.push('> Generated from `xdomains/context/unity/version-matrix.json`. Do not edit by hand; regenerate with `build-registry.mjs`.');
  lines.push('');
  if (matrix.description) {
    lines.push(matrix.description);
    lines.push('');
  }
  lines.push(`- Versions: ${versions.map((version) => `\`${version}\``).join(', ')}`);
  if (matrix.primaryVersion) lines.push(`- Primary version: \`${matrix.primaryVersion}\``);
  if (matrix.newerDispatchKey) lines.push(`- Newer dispatch key: \`${matrix.newerDispatchKey}\``);
  lines.push('');
  lines.push('## Dispatch keys');
  lines.push('');
  lines.push('| Editor line | Dispatch key |');
  lines.push('|---|---|');
  for (const [editorLine, key] of Object.entries(matrix.dispatch ?? {})) {
    lines.push(`| \`${editorLine}\` | \`${key}\` |`);
  }
  lines.push('');
  lines.push('## Feature flags');
  lines.push('');
  lines.push(`| Feature | Since | Deprecated | Removed | ${versions.map((version) => `\`${version}\``).join(' | ')} |`);
  lines.push(`|---|---|---|---|${versions.map(() => '---').join('|')}|`);
  for (const feature of matrix.features ?? []) {
    const flags = versions.map((version) => featureMark(feature.versions[version]));
    lines.push(
      `| ${feature.id} | ${feature.since ?? '—'} | ${feature.deprecatedSince ?? '—'} | ${feature.removedSince ?? '—'} | ${flags.join(' | ')} |`
    );
  }
  lines.push('');
  if (matrix.overlays && Object.keys(matrix.overlays).length > 0) {
    lines.push('## Overlays');
    lines.push('');
    lines.push('| Dispatch key | Overlay |');
    lines.push('|---|---|');
    for (const [key, overlay] of Object.entries(matrix.overlays)) {
      lines.push(`| \`${key}\` | \`${overlay}\` |`);
    }
    lines.push('');
  }
  if (matrix.verifyNote) {
    lines.push(`> ${matrix.verifyNote}`);
    lines.push('');
  }
  return lines.join('\n');
}
