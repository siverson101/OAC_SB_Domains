// plan-feature — assemble and write a plan artifact (Phase 5 Step 5.3).
//
// OAC has no plan mode, so this ability does the job the Claude-Code
// `plan-feature` skill's plan file does: it assembles the Test Cases (carried
// verbatim from test-designer) plus the design/testing decisions into
// `.opencode/plans/<slug>.md` and returns the Testability verdict. It is gated
// by `toggles.tdd`; a `FAIL` loops back once, then aborts. The loopback marker
// is the one-retry enforcement point within a cycle: the first `FAIL` writes
// it, a second consecutive `FAIL` aborts and CLEARS it, so a genuine design
// revision starts a fresh cycle with one retry again. Offline and fail-soft: it
// reads/writes plain files under `.opencode/plans/` only and never needs the
// Editor.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { nowIso, readJson, toPosix, writeJson } from '../../../shared/io';
import { isValidSlug } from '../../../shared/slug';
import { loadStudioConfig } from '../../studio-config/src/config';
import { makeResult, num, type ComposeBase, type ComposeOptions, type Json } from './shared';

export const PLAN_DIR = 'plans';
export const LOOPBACK_SUFFIX = '.loopback.json';
export const PLAN_SCHEMA_VERSION = 1;

export type TestabilityVerdict = 'PASS' | 'WARN' | 'FAIL';

// The plan artifact sections, in the order they must appear (Step 5.3).
export const PLAN_SECTIONS = [
  'Context',
  'Implementation Design',
  'Test Cases',
  'Testing Decisions',
  'Testability Assessment',
  'Known Trade-offs',
  'Development Workflow',
] as const;
export type PlanSection = (typeof PLAN_SECTIONS)[number];

export const NOT_PROVIDED = '_Not provided._';
export const NONE_RECORDED = '- None recorded.';

// The `tdd` loop rules (red before green, one vertical slice, seams, review)
// and the rejected anti-patterns, encoded so the artifact carries them.
export const DEVELOPMENT_WORKFLOW = [
  'Follow the `tdd` loop rules:',
  '',
  '1. **Red before green.** Write the failing test first, then only enough code to pass it.',
  '2. **One vertical slice at a time.** One seam, one test, one minimal implementation per cycle.',
  '3. **Tests at pre-agreed public seams only.** Confirm the seams before writing any test.',
  '4. **Refactoring belongs to review**, not the red → green loop.',
  '',
  'Reject these test anti-patterns:',
  '',
  '- **Implementation-coupled** — mocks internal collaborators, tests private methods, or observes through a side channel.',
  '- **Tautological** — the assertion recomputes the expected value the way the code does; expected values must come from an independent source of truth.',
  '- **Horizontally sliced** — all tests written before any implementation; work in vertical tracer-bullet slices instead.',
].join('\n');

export interface PlanArtifact {
  feature: string;
  context: string;
  implementationDesign: string;
  testCases: string;
  testingDecisions: string;
  testability: TestabilityVerdict;
  tradeOffs: string;
  developmentWorkflow: string;
}

export type PlanAction = 'write' | 'loopback' | 'abort' | 'refuse';

export interface PlanFeatureResult extends ComposeBase {
  action: PlanAction;
  feature: string | null;
  planPath: string;
  testability: TestabilityVerdict | null;
  attempt: number;
  written: boolean;
  instruction: string | null;
}

interface LoopbackState {
  schemaVersion: number;
  feature: string;
  attempts: number;
  updatedAt: string;
}

export function plansDir(options: ComposeOptions): string {
  return join(options.opencodeDir, PLAN_DIR);
}

export function planPath(options: ComposeOptions, slug: string): string {
  return join(plansDir(options), `${slug}.md`);
}

export function loopbackPath(options: ComposeOptions, slug: string): string {
  return join(plansDir(options), `${slug}${LOOPBACK_SUFFIX}`);
}

export function normalizeVerdict(value: string | undefined): TestabilityVerdict | null {
  const text = (value ?? '').trim().toUpperCase();
  return text === 'PASS' || text === 'WARN' || text === 'FAIL' ? text : null;
}

export function renderPlanArtifact(artifact: PlanArtifact): string {
  return [
    `# Plan: ${artifact.feature}`,
    `## Context\n\n${artifact.context}`,
    `## Implementation Design\n\n${artifact.implementationDesign}`,
    `## Test Cases\n\n${artifact.testCases}`,
    `## Testing Decisions\n\n${artifact.testingDecisions}`,
    `## Testability Assessment\n\nTESTABILITY: ${artifact.testability}`,
    `## Known Trade-offs\n\n${artifact.tradeOffs}`,
    `## Development Workflow\n\n${artifact.developmentWorkflow}`,
  ].join('\n\n') + '\n';
}

export function validatePlanArtifact(markdown: string): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  let cursor = -1;
  for (const section of PLAN_SECTIONS) {
    const index = markdown.indexOf(`## ${section}`);
    if (index === -1) {
      errors.push(`missing section: ${section}`);
      continue;
    }
    if (index < cursor) errors.push(`section out of order: ${section}`);
    cursor = index;
  }
  return { ok: errors.length === 0, errors };
}

function tradeOffsBody(options: ComposeOptions, verdict: TestabilityVerdict): string {
  const base = (options.tradeOffs ?? '').trim();
  if (verdict !== 'WARN') return base || NONE_RECORDED;
  const warning = '- Testability WARN: the test-designer reported testability issues; resolve them before implementation.';
  return base ? `${base}\n${warning}` : warning;
}

// A marker with an unknown `schemaVersion` is ignored (fail-soft): its shape is
// not ours to interpret, so it must not silently enforce a retry from a prior
// format. A missing marker reads as zero attempts (a fresh cycle).
function readLoopbackAttempts(options: ComposeOptions, slug: string): number {
  const state = readJson<Json>(loopbackPath(options, slug));
  if (num(state, 'schemaVersion') !== PLAN_SCHEMA_VERSION) return 0;
  return num(state, 'attempts') ?? 0;
}

function writeLoopback(options: ComposeOptions, slug: string, attempts: number): void {
  const state: LoopbackState = {
    schemaVersion: PLAN_SCHEMA_VERSION,
    feature: slug,
    attempts,
    updatedAt: nowIso(),
  };
  writeJson(loopbackPath(options, slug), state);
}

function clearLoopback(options: ComposeOptions, slug: string): void {
  try {
    rmSync(loopbackPath(options, slug), { force: true });
  } catch {
    /* ignore: a missing marker is already the cleared state */
  }
}

function refuse(
  slug: string | null,
  target: string,
  testability: TestabilityVerdict | null,
  message: string
): PlanFeatureResult {
  const base = makeResult('plan-feature', 'refused', message, [message], { writesState: true });
  return {
    ...base,
    action: 'refuse',
    feature: slug,
    planPath: target,
    testability,
    attempt: 0,
    written: false,
    instruction: null,
  };
}

export function runPlanFeature(options: ComposeOptions): PlanFeatureResult {
  const slug = (options.feature ?? '').trim();
  const target = slug ? toPosix(planPath(options, slug)) : toPosix(plansDir(options));

  if (!slug) return refuse(null, target, null, 'a --feature <slug> is required');
  if (!isValidSlug(slug)) {
    return refuse(slug, target, null, `invalid feature slug "${slug}"; use kebab-case (a-z, 0-9, -)`);
  }

  const load = loadStudioConfig(join(options.opencodeDir, 'unity-studio.json'));
  if (!load.config.toggles.tdd) {
    return refuse(
      slug,
      target,
      null,
      'TDD is off (.opencode/unity-studio.json toggles.tdd=false); plan-feature is TDD-gated. Enable the toggle to plan test-first — TDD off still requires tests, just not first.'
    );
  }

  const verdict = normalizeVerdict(options.testability);
  if (!verdict) {
    return refuse(slug, target, null, 'a --testability verdict is required (PASS|WARN|FAIL)');
  }

  const testCases = options.testCases ?? '';
  if (testCases.trim() === '') {
    return refuse(
      slug,
      target,
      verdict,
      'Test Cases are required (--test-cases); the artifact carries them verbatim from test-designer'
    );
  }

  if (verdict === 'FAIL') {
    const attempts = readLoopbackAttempts(options, slug);
    if (attempts < 1) {
      writeLoopback(options, slug, 1);
      const base = makeResult('plan-feature', 'loopback', `Testability FAIL for "${slug}"; one retry remains`, [], {
        writesState: true,
      });
      return {
        ...base,
        action: 'loopback',
        feature: slug,
        planPath: target,
        testability: verdict,
        attempt: 1,
        written: false,
        instruction:
          'Revise the Implementation Design to address the testability issues, then re-run plan-feature. This is the one permitted retry.',
      };
    }
    // A second consecutive FAIL aborts and clears the marker: the retry was
    // already spent within this cycle, and a fresh cycle must not inherit the
    // abort. The user can revise the design and re-run to earn one retry again.
    clearLoopback(options, slug);
    const base = makeResult('plan-feature', 'aborted', `Testability FAIL persists for "${slug}" after one retry; aborting`, [], {
      writesState: true,
    });
    return {
      ...base,
      action: 'abort',
      feature: slug,
      planPath: target,
      testability: verdict,
      attempt: attempts + 1,
      written: false,
      instruction: 'Abort: the revised design still fails testability. Escalate to the user with the testability issues.',
    };
  }

  clearLoopback(options, slug);
  const artifact: PlanArtifact = {
    feature: slug,
    context: (options.context ?? '').trim() || NOT_PROVIDED,
    implementationDesign: (options.design ?? '').trim() || NOT_PROVIDED,
    testCases,
    testingDecisions: (options.testingDecisions ?? '').trim() || NOT_PROVIDED,
    testability: verdict,
    tradeOffs: tradeOffsBody(options, verdict),
    developmentWorkflow: DEVELOPMENT_WORKFLOW,
  };

  const markdown = renderPlanArtifact(artifact);
  const validation = validatePlanArtifact(markdown);
  if (!validation.ok) {
    return refuse(slug, target, verdict, `assembled plan failed validation: ${validation.errors.join('; ')}`);
  }

  const path = planPath(options, slug);
  mkdirSync(plansDir(options), { recursive: true });
  writeFileSync(path, markdown);
  const base = makeResult('plan-feature', 'ok', `wrote plan artifact for "${slug}" (TESTABILITY: ${verdict})`, [], {
    writesState: true,
  });
  return {
    ...base,
    action: 'write',
    feature: slug,
    planPath: toPosix(path),
    testability: verdict,
    attempt: 0,
    written: true,
    instruction: null,
  };
}
