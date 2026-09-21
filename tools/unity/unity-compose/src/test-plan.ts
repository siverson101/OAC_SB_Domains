// test-plan — generate a per-feature test plan from capability `testPlan` data
// (Phase 5 Step 5.4).
//
// The capability contract is the single source of truth: for each requested
// capability this reads `command/<ability>.md` frontmatter (`id`, `summary`,
// `testPlan`) and renders the declared steps as a deduplicated checklist under
// `.opencode/test-plans/<slug>.md`. A missing capability or a capability with no
// `testPlan` is reported as a problem, never a crash. Offline and fail-soft: it
// writes only under `.opencode/test-plans/` and never needs the Editor.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { nowIso, readJson, readText, toPosix } from '../../../shared/io';
import {
  frontmatterString,
  frontmatterStringArray,
  parseFrontmatter,
} from '../../../shared/registry/src/frontmatter';
import { isValidSlug } from '../../../shared/slug';
import { defaultCapabilitiesDir } from './contract-aware-design';
import { makeResult, type ComposeBase, type ComposeOptions, type Json } from './shared';

export const TEST_PLAN_DIR = 'test-plans';
export const TEST_PLAN_SCHEMA_VERSION = 1;
export const FEATURES_FILE = 'features.json';

export interface TestPlanSection {
  ability: string;
  id: string | null;
  summary: string | null;
  steps: string[];
  problems: string[];
}

export interface TestPlanArtifact {
  schemaVersion: number;
  generatedAt: string;
  feature: string;
  abilities: string[];
  sections: TestPlanSection[];
  checklist: string[];
  duplicateSteps: string[];
  problems: string[];
}

export type TestPlanAction = 'write' | 'refuse';

export interface TestPlanResult extends ComposeBase {
  action: TestPlanAction;
  feature: string | null;
  planPath: string;
  written: boolean;
  sections: number;
  checklist: number;
  problems: string[];
}

export function testPlansDir(options: ComposeOptions): string {
  return join(options.opencodeDir, TEST_PLAN_DIR);
}

export function testPlanPath(options: ComposeOptions, slug: string): string {
  return join(testPlansDir(options), `${slug}.md`);
}

export function commandsDir(options: ComposeOptions): string {
  return options.commandsDir ?? options.capabilitiesDir ?? defaultCapabilitiesDir(options);
}

function canonicalStep(step: string): string {
  return step.replace(/\s+/g, ' ').trim().toLowerCase();
}

export interface ResolvedAbilities {
  abilities: string[];
  error: string | null;
}

export function resolveFeatureAbilities(options: ComposeOptions, feature: string): ResolvedAbilities {
  if (options.planAbilities && options.planAbilities.length > 0) {
    return { abilities: options.planAbilities, error: null };
  }
  const mapPath = options.featuresMap ?? join(testPlansDir(options), FEATURES_FILE);
  const map = readJson<Json>(mapPath);
  if (!map) {
    return { abilities: [], error: `no --abilities and no feature→abilities mapping at ${toPosix(mapPath)}` };
  }
  const entry = map[feature];
  if (!Array.isArray(entry)) {
    return { abilities: [], error: `no abilities mapped for feature "${feature}" in ${toPosix(mapPath)}` };
  }
  return { abilities: entry.filter((item): item is string => typeof item === 'string'), error: null };
}

export function readCapabilitySection(options: ComposeOptions, ability: string): TestPlanSection {
  const path = join(commandsDir(options), `${ability}.md`);
  const text = readText(path);
  if (text === null) {
    return { ability, id: null, summary: null, steps: [], problems: [`capability not found at ${toPosix(path)}`] };
  }
  const frontmatter = parseFrontmatter(text);
  const steps = frontmatterStringArray(frontmatter, 'testPlan') ?? [];
  return {
    ability,
    id: frontmatterString(frontmatter, 'id') ?? ability,
    summary: frontmatterString(frontmatter, 'summary') ?? null,
    steps: [...steps],
    problems: steps.length === 0 ? ['no testPlan declared in the capability contract'] : [],
  };
}

export function renderTestPlan(artifact: TestPlanArtifact): string {
  const lines = [
    `# Test Plan: ${artifact.feature}`,
    '',
    'Generated from the capability contract `testPlan` fields — the contract is the single source of truth.',
  ];
  for (const section of artifact.sections) {
    lines.push('', `## ${section.ability}`, '');
    lines.push(section.summary ?? '_No summary declared._');
    if (section.steps.length > 0) {
      lines.push('');
      for (const step of section.steps) lines.push(`- [ ] ${step}`);
    }
    for (const problem of section.problems) lines.push('', `> Problem: ${problem}`);
  }
  lines.push('');
  return lines.join('\n');
}

export function runTestPlan(options: ComposeOptions): TestPlanResult {
  const slug = (options.feature ?? '').trim();
  const target = slug ? toPosix(testPlanPath(options, slug)) : toPosix(testPlansDir(options));

  const refuse = (message: string): TestPlanResult => {
    const base = makeResult('test-plan', 'refused', message, [message], { writesState: true });
    return {
      ...base,
      action: 'refuse',
      feature: slug || null,
      planPath: target,
      written: false,
      sections: 0,
      checklist: 0,
      problems: [message],
    };
  };

  if (!slug) return refuse('a --feature <slug> is required');
  if (!isValidSlug(slug)) return refuse(`invalid feature slug "${slug}"; use kebab-case (a-z, 0-9, -)`);

  const resolved = resolveFeatureAbilities(options, slug);
  if (resolved.error) return refuse(resolved.error);
  if (resolved.abilities.length === 0) return refuse(`no abilities resolved for feature "${slug}"`);

  const sections = resolved.abilities.map((ability) => readCapabilitySection(options, ability));
  const seen = new Set<string>();
  const checklist: string[] = [];
  const duplicateSteps: string[] = [];
  for (const section of sections) {
    const kept: string[] = [];
    for (const step of section.steps) {
      const key = canonicalStep(step);
      if (seen.has(key)) {
        duplicateSteps.push(step);
        continue;
      }
      seen.add(key);
      kept.push(step);
      checklist.push(step);
    }
    section.steps = kept;
  }

  const problems = sections.flatMap((section) => section.problems.map((problem) => `${section.ability}: ${problem}`));
  const artifact: TestPlanArtifact = {
    schemaVersion: TEST_PLAN_SCHEMA_VERSION,
    generatedAt: nowIso(),
    feature: slug,
    abilities: resolved.abilities,
    sections,
    checklist,
    duplicateSteps,
    problems,
  };

  const path = testPlanPath(options, slug);
  mkdirSync(testPlansDir(options), { recursive: true });
  writeFileSync(path, renderTestPlan(artifact));

  const status = problems.length > 0 ? 'observed_locally' : 'ok';
  const summary = `wrote test plan for "${slug}" (${sections.length} capability section(s), ${checklist.length} checklist step(s))`;
  const base = makeResult('test-plan', status, summary, problems, { writesState: true });
  return {
    ...base,
    action: 'write',
    feature: slug,
    planPath: toPosix(path),
    written: true,
    sections: sections.length,
    checklist: checklist.length,
    problems,
  };
}
