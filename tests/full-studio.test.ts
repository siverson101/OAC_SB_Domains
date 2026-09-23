import { describe, expect, test } from 'bun:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { buildTemplateOverlay, readAgentSource } from '../tools/shared/registry/src/build';
import { frontmatterString, frontmatterStringArray, parseFrontmatter } from '../tools/shared/registry/src/frontmatter';

const repoRoot = resolve(import.meta.dir, '..');
const unity3dDir = join(repoRoot, 'xdomains', 'game-dev', 'unity-3d');
const fullStudioDir = join(unity3dDir, 'agent', 'full-studio');

const manifest = JSON.parse(readFileSync(join(unity3dDir, 'sb-domain.json'), 'utf8')) as {
  abilities: string[];
  templates?: { installAs?: string; template?: string; manifest?: string }[];
};
const knownAbilities = new Set(manifest.abilities);
const templateOverlay = buildTemplateOverlay(unity3dDir, manifest as never);

// Multi-axis templates (ADR-0020) live beside the roster agents; their template
// and resolved variants must not be counted as roster agents.
const fullStudioTemplateBases = (manifest.templates ?? [])
  .filter((entry) => entry.installAs?.startsWith('agent/full-studio/'))
  .map((entry) => (JSON.parse(readFileSync(join(unity3dDir, entry.manifest ?? ''), 'utf8')) as { base: string }).base);
const isTemplateSource = (name: string): boolean =>
  fullStudioTemplateBases.some((base) => name === `${base}.md` || name.startsWith(`${base}.`));

// The 18-agent roster: filename stem -> frontmatter `name`.
const EXPECTED: Record<string, string> = {
  'full-studio-orchestrator': 'FullStudioOrchestrator',
  'creative-director': 'CreativeDirector',
  'technical-director': 'TechnicalDirector',
  producer: 'Producer',
  'art-director': 'ArtDirector',
  'game-designer': 'GameDesigner',
  'lead-programmer': 'LeadProgrammer',
  'qa-lead': 'QaLead',
  'art-lead': 'ArtLead',
  'gameplay-programmer': 'GameplayProgrammer',
  'ui-programmer': 'UiProgrammer',
  'performance-analyst': 'PerformanceAnalyst',
  'shader-specialist': 'ShaderSpecialist',
  'audio-specialist': 'AudioSpecialist',
  'level-designer': 'LevelDesigner',
  'technical-artist': 'TechnicalArtist',
  'native-plugin': 'NativePlugin',
  'tdd-specialist': 'TddSpecialist',
};

const DIRECTORS = ['creative-director', 'technical-director', 'producer', 'art-director'];
const LEADS = ['game-designer', 'lead-programmer', 'qa-lead', 'art-lead'];
const SPECIALISTS = [
  'gameplay-programmer',
  'ui-programmer',
  'performance-analyst',
  'shader-specialist',
  'audio-specialist',
  'level-designer',
  'technical-artist',
  'native-plugin',
  'tdd-specialist',
];

const CODE_ASSET_GLOBS = ['Assets/**', '**/*.cs', '**/*.shader', '**/*.hlsl', '**/*.asmdef', '**/*.uxml', '**/*.uss'];

function walkMarkdown(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkMarkdown(full, out);
    else if (name.endsWith('.md')) out.push(full);
  }
  return out;
}

const templatedStems = new Set(
  (manifest.templates ?? [])
    .filter((entry) => entry.installAs?.startsWith('agent/full-studio/'))
    .map((entry) => basename(entry.installAs ?? '', '.md'))
);

const diskAgentIds = walkMarkdown(fullStudioDir)
  .filter((file) => !isTemplateSource(basename(file)))
  .map((file) => basename(file, '.md'))
  .sort();
const agentIds = Object.keys(EXPECTED).sort();

function readAgent(id: string): string {
  return readAgentSource(unity3dDir, `agent/full-studio/${id}.md`, templateOverlay).content;
}

// The registry frontmatter parser is shallow and cannot read quoted glob keys
// nested under `permission`; this small indentation-aware reader handles the
// `permission.<section>.<glob>: <action>` shape the directors rely on.
function permissionRules(content: string): Record<string, Record<string, string>> {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content)?.[1] ?? '';
  const rules: Record<string, Record<string, string>> = {};
  let inPermission = false;
  let section: string | null = null;
  for (const raw of fm.split(/\r?\n/)) {
    if (/^permission:\s*$/.test(raw)) {
      inPermission = true;
      continue;
    }
    if (!inPermission) continue;
    if (raw.trim() === '' || !/^\s/.test(raw)) {
      inPermission = false;
      continue;
    }
    const indent = raw.length - raw.trimStart().length;
    const line = raw.trim();
    if (indent === 2) {
      const m = /^([A-Za-z0-9_-]+):\s*$/.exec(line);
      section = m ? m[1] : null;
      if (section) rules[section] = rules[section] ?? {};
      continue;
    }
    if (indent === 4 && section) {
      const m = /^(?:"([^"]+)"|([A-Za-z0-9_*/.!-]+)):\s*"?(deny|allow|ask)"?\s*$/.exec(line);
      if (m) rules[section][m[1] ?? m[2]] = m[3];
    }
  }
  return rules;
}

describe('Full Studio hierarchy', () => {
  test('ships exactly the 18-agent roster', () => {
    expect(agentIds).toHaveLength(18);
    expect(agentIds).toEqual(Object.keys(EXPECTED).sort());
    // The non-templated agents are plain files; the templated ones are source
    // templates resolved at install. No stray agent files beyond those.
    const expectedDisk = agentIds.filter((id) => !templatedStems.has(id)).sort();
    expect(diskAgentIds).toEqual(expectedDisk);
    for (const id of templatedStems) expect(EXPECTED[id], `${id} is not a roster agent`).toBeDefined();
  });

  test('every agent declares valid frontmatter and a Delegation Map', () => {
    for (const id of agentIds) {
      const content = readAgent(id);
      const fm = parseFrontmatter(content);
      expect(frontmatterString(fm, 'name'), `${id} name`).toBe(EXPECTED[id]);
      expect(frontmatterString(fm, 'description')?.trim().length, `${id} description`).toBeGreaterThan(0);
      const mode = frontmatterString(fm, 'mode');
      expect(['primary', 'subagent'], `${id} mode=${mode}`).toContain(mode ?? '');
      const tier = frontmatterString(fm, 'tier');
      expect(['router', 'lead', 'specialist'], `${id} tier=${tier}`).toContain(tier ?? '');
      const abilities = frontmatterStringArray(fm, 'abilities') ?? [];
      expect(abilities.length, `${id} allowlist`).toBeGreaterThan(0);

      expect(content, `${id} heading`).toMatch(/## Delegation Map/);
      for (const field of ['Reports to', 'Implements from', 'Escalation targets', 'Siblings']) {
        expect(content.toLowerCase(), `${id} ${field}`).toContain(field.toLowerCase());
      }
    }
  });

  test('assigns the tier expected for each roster group', () => {
    expect(frontmatterString(parseFrontmatter(readAgent('full-studio-orchestrator')), 'tier')).toBe('router');
    for (const id of [...DIRECTORS, ...LEADS]) {
      expect(frontmatterString(parseFrontmatter(readAgent(id)), 'tier'), `${id} tier`).toBe('lead');
    }
    for (const id of SPECIALISTS) {
      expect(frontmatterString(parseFrontmatter(readAgent(id)), 'tier'), `${id} tier`).toBe('specialist');
    }
  });

  test('only the orchestrator is a primary agent', () => {
    const primaries = agentIds.filter(
      (id) => frontmatterString(parseFrontmatter(readAgent(id)), 'mode') === 'primary'
    );
    expect(primaries).toEqual(['full-studio-orchestrator']);
    for (const id of agentIds) {
      if (id === 'full-studio-orchestrator') continue;
      expect(frontmatterString(parseFrontmatter(readAgent(id)), 'mode'), `${id} mode`).toBe('subagent');
    }
  });

  test('every allowlist id exists in sb-domain.json abilities', () => {
    for (const id of agentIds) {
      const abilities = frontmatterStringArray(parseFrontmatter(readAgent(id)), 'abilities') ?? [];
      for (const ability of abilities) {
        expect(knownAbilities.has(ability), `${id} -> ${ability}`).toBe(true);
      }
    }
  });

  test('directors deny every code and asset write glob', () => {
    for (const id of DIRECTORS) {
      const rules = permissionRules(readAgent(id));
      for (const glob of CODE_ASSET_GLOBS) {
        expect(rules.write?.[glob], `${id} write ${glob}`).toBe('deny');
        expect(rules.edit?.[glob], `${id} edit ${glob}`).toBe('deny');
      }
    }
  });

  test('the router orchestrator does not deny code/asset globs while directors do', () => {
    // Intentional asymmetry: directors own the implementation gates and deny
    // code/asset writes outright; the router relies on the delegate-don't-do
    // rule instead, exactly as the Lean orchestrator does.
    const orchestrator = permissionRules(readAgent('full-studio-orchestrator'));
    for (const glob of CODE_ASSET_GLOBS) {
      expect(orchestrator.write?.[glob], `orchestrator write ${glob}`).not.toBe('deny');
      expect(orchestrator.edit?.[glob], `orchestrator edit ${glob}`).not.toBe('deny');
    }
    for (const id of DIRECTORS) {
      const rules = permissionRules(readAgent(id));
      expect(rules.write?.['**/*.cs'], `${id} write cs`).toBe('deny');
      expect(rules.edit?.['Assets/**'], `${id} edit assets`).toBe('deny');
    }
  });

  test('leads and specialists may write code and assets', () => {
    for (const id of [...LEADS, ...SPECIALISTS]) {
      const rules = permissionRules(readAgent(id));
      expect(rules.write?.['**/*.cs'], `${id} write cs`).not.toBe('deny');
      expect(rules.write?.['Assets/**'], `${id} write assets`).not.toBe('deny');
    }
  });
});
