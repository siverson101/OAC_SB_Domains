// test-plan — generate a per-feature test plan from capability `testPlan` data
// (Phase 5 Step 5.4).
//
// The capability contract is the single source of truth: for each requested
// capability this reads `command/<ability>.md` frontmatter (`id`, `summary`,
// `testPlan`) or a primitive's `primitive.yaml` (`testPlan`/`test_plan`) and
// renders the declared steps as a deduplicated checklist under
// `.opencode/test-plans/<slug>.md`. A missing capability or one with no
// `testPlan` is reported as a problem, never a crash. Offline and fail-soft: it
// writes only under `.opencode/test-plans/` and never needs the Editor.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { nowIso, readText, toPosix } from '../../../shared/io';
import {
  frontmatterString,
  frontmatterStringArray,
  parseFrontmatter,
} from '../../../shared/registry/src/frontmatter';
import { isValidSlug } from '../../../shared/slug';
import { canonicalizeText } from '../../../shared/text';
import { parseYaml } from '../../../shared/yaml';
import { defaultCapabilitiesDir } from './contract-aware-design';
import { defaultPrimitivesDir } from './primitive-composition';
import { asRecord, makeResult, type ComposeBase, type ComposeOptions } from './shared';

export const TEST_PLAN_DIR = 'test-plans';
export const TEST_PLAN_SCHEMA_VERSION = 1;

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

export function primitivesDir(options: ComposeOptions): string {
  return options.primitivesDir ?? defaultPrimitivesDir(options);
}

export interface ResolvedAbilities {
  abilities: string[];
  error: string | null;
}

export function resolveFeatureAbilities(options: ComposeOptions): ResolvedAbilities {
  if (options.planAbilities && options.planAbilities.length > 0) {
    return { abilities: options.planAbilities, error: null };
  }
  return { abilities: [], error: 'no --abilities supplied (comma-separated capability or primitive ids)' };
}

function yamlStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

// The contract is the single source of truth: a capability's `testPlan` lives in
// its command frontmatter, a primitive's in `primitive.yaml` (`testPlan` or the
// upstream `test_plan`). A missing plan is a problem, never a crash.
export function readCapabilitySection(options: ComposeOptions, ability: string): TestPlanSection {
  const commandPath = join(commandsDir(options), `${ability}.md`);
  const commandText = readText(commandPath);
  if (commandText !== null) {
    const frontmatter = parseFrontmatter(commandText);
    const steps = frontmatterStringArray(frontmatter, 'testPlan') ?? [];
    return {
      ability,
      id: frontmatterString(frontmatter, 'id') ?? ability,
      summary: frontmatterString(frontmatter, 'summary') ?? null,
      steps: [...steps],
      problems: steps.length === 0 ? ['no testPlan declared in the capability contract'] : [],
    };
  }

  const primitivePath = join(primitivesDir(options), ability, 'primitive.yaml');
  const primitiveText = readText(primitivePath);
  if (primitiveText !== null) {
    const data = asRecord(parseYaml(primitiveText));
    const steps = yamlStringArray(data?.testPlan ?? data?.test_plan);
    return {
      ability,
      id: typeof data?.id === 'string' ? data.id : ability,
      summary: typeof data?.summary === 'string' ? data.summary : null,
      steps,
      problems: steps.length === 0 ? ['no testPlan declared in the primitive contract'] : [],
    };
  }

  return {
    ability,
    id: null,
    summary: null,
    steps: [],
    problems: [`capability not found at ${toPosix(commandPath)} or ${toPosix(primitivePath)}`],
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
  if (artifact.duplicateSteps.length > 0) {
    lines.push('', '## Duplicate Steps Dropped', '');
    lines.push('Declared by more than one capability; shown once in the checklist above:');
    for (const step of artifact.duplicateSteps) lines.push(`- ${step}`);
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

  const resolved = resolveFeatureAbilities(options);
  if (resolved.error) return refuse(resolved.error);
  if (resolved.abilities.length === 0) return refuse(`no abilities resolved for feature "${slug}"`);

  const sections = resolved.abilities.map((ability) => readCapabilitySection(options, ability));
  const seen = new Set<string>();
  const checklist: string[] = [];
  const duplicateSteps: string[] = [];
  for (const section of sections) {
    const kept: string[] = [];
    for (const step of section.steps) {
      const key = canonicalizeText(step);
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
