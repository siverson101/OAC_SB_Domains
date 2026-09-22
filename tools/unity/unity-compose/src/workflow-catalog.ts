// workflow-catalog — validate the 7-phase lifecycle catalog and the recipes,
// evaluate the catalog's artifact checks, and surface the next command.
//
// The catalog (xdomains/context/workflow-catalog.json) pairs each lifecycle step
// with the command that realises it and, where progression is machine-checkable,
// an artifact check (glob + required pattern). Required steps are machine-checkable
// and gate the phase; a required step that is `unmet` or `undetectable` (a `note`
// fallback that cannot prove completion) blocks it. The recipes
// (xdomains/game-dev/unity-3d/recipes/*.json) are validated with the same
// `validateRecipe` the Compose family ships (ADR-0016). Offline, read-only and
// fail-soft: a missing catalog or recipe is reported, never thrown.
import { readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { readJson, toPosix } from '../../../shared/io';
import { asRecord } from '../../../shared/json-helpers';
import {
  evaluateArtifactCheck,
  makeProjectGlob,
  requireFields,
  validateArtifact,
  validateRecipe,
  validateUniqueId,
  type ArtifactCheckOutcome,
  type RecipeArtifact,
  type RecipeValidation,
} from './recipes';
import { makeResult, type ComposeBase, type ComposeOptions } from './shared';

export { makeProjectGlob };

export const CATALOG_SCHEMA_VERSION = 1;

export interface CatalogStep {
  id: string;
  name: string;
  command: string;
  required: boolean;
  description: string;
  repeatable?: boolean;
  artifact?: RecipeArtifact;
}

export interface CatalogPhase {
  id: string;
  label: string;
  description: string;
  nextPhase: string | null;
  steps: CatalogStep[];
}

export interface WorkflowCatalog {
  schemaVersion: number;
  id: string;
  name: string;
  description: string;
  phases: CatalogPhase[];
}

const CATALOG_REQUIRED_FIELDS = ['schemaVersion', 'id', 'name', 'description', 'phases'] as const;
const CATALOG_PHASE_REQUIRED_FIELDS = ['id', 'label', 'description', 'steps'] as const;
const CATALOG_STEP_REQUIRED_FIELDS = ['id', 'name', 'command', 'description'] as const;

export function validateWorkflowCatalog(data: unknown): RecipeValidation {
  const errors: string[] = [];
  const root = asRecord(data);
  if (!root) return { ok: false, errors: ['workflow catalog must be a JSON object'] };

  requireFields(root, '', CATALOG_REQUIRED_FIELDS, errors);
  if (root.schemaVersion !== undefined && root.schemaVersion !== CATALOG_SCHEMA_VERSION) {
    errors.push(`unsupported schemaVersion: expected ${CATALOG_SCHEMA_VERSION}, got ${JSON.stringify(root.schemaVersion)}`);
  }

  const phases = root.phases;
  if (phases === undefined) return { ok: errors.length === 0, errors };
  if (!Array.isArray(phases)) {
    errors.push('invalid phases: expected array');
    return { ok: false, errors };
  }

  const phaseIds = new Set<string>();
  phases.forEach((phaseRaw, i) => {
    const where = `phase[${i}]`;
    const phase = asRecord(phaseRaw);
    if (!phase) {
      errors.push(`${where} must be an object`);
      return;
    }
    const id = typeof phase.id === 'string' ? phase.id : null;
    const label = id ? `phase "${id}"` : where;
    requireFields(phase, label, CATALOG_PHASE_REQUIRED_FIELDS, errors);
    validateUniqueId(id, phaseIds, errors, 'phase');
    if (phase.nextPhase !== undefined && phase.nextPhase !== null && typeof phase.nextPhase !== 'string') {
      errors.push(`${label} nextPhase must be a string or null`);
    }

    if (phase.steps === undefined) return;
    if (!Array.isArray(phase.steps)) {
      errors.push(`${label} steps must be an array`);
      return;
    }
    const stepIds = new Set<string>();
    phase.steps.forEach((stepRaw, j) => {
      const step = asRecord(stepRaw);
      if (!step) {
        errors.push(`${label} step[${j}] must be an object`);
        return;
      }
      const stepId = typeof step.id === 'string' ? step.id : null;
      const stepLabel = stepId ? `${label} step "${stepId}"` : `${label} step[${j}]`;
      requireFields(step, stepLabel, CATALOG_STEP_REQUIRED_FIELDS, errors);
      if (typeof step.required !== 'boolean') errors.push(`${stepLabel} missing required field: required`);
      validateUniqueId(stepId, stepIds, errors, 'step', label);
      for (const key of ['name', 'command', 'description']) {
        if (step[key] !== undefined && typeof step[key] !== 'string') errors.push(`${stepLabel} ${key} must be a string`);
      }
      if (step.repeatable !== undefined && typeof step.repeatable !== 'boolean') errors.push(`${stepLabel} repeatable must be a boolean`);
      validateArtifact(step.artifact, stepLabel, errors);
    });
  });

  phases.forEach((phaseRaw, i) => {
    const phase = asRecord(phaseRaw);
    if (!phase) return;
    const id = typeof phase.id === 'string' ? phase.id : `phase[${i}]`;
    const next = phase.nextPhase;
    if (typeof next !== 'string') return;
    if (!phaseIds.has(next)) errors.push(`phase "${id}" nextPhase names unknown phase "${next}"`);
    if (next === phase.id) errors.push(`phase "${id}" nextPhase must not reference itself`);
  });

  return { ok: errors.length === 0, errors };
}

export interface WorkflowRecipeCheck {
  id: string;
  path: string;
  valid: boolean;
  errors: string[];
}

export interface CatalogStepCheck {
  id: string;
  name: string;
  command: string;
  required: boolean;
  outcome: ArtifactCheckOutcome;
  // A required step that is not `met` blocks its phase: `unmet` is detectably
  // missing, `undetectable` is a note-only check that cannot prove completion.
  blocking: boolean;
}

export interface CatalogPhaseProgress {
  id: string;
  label: string;
  nextPhase: string | null;
  complete: boolean;
  steps: CatalogStepCheck[];
}

export interface WorkflowCatalogResult extends ComposeBase {
  catalogPath: string;
  recipesDir: string;
  catalogValid: boolean;
  catalogErrors: string[];
  recipes: WorkflowRecipeCheck[];
  phases: CatalogPhaseProgress[];
  currentPhase: string | null;
  nextCommand: string | null;
  nextStepId: string | null;
}

export function defaultCatalogPath(options: ComposeOptions): string {
  return join(options.projectRoot, 'xdomains', 'context', 'workflow-catalog.json');
}

export function defaultRecipesDir(options: ComposeOptions): string {
  return join(options.projectRoot, 'xdomains', 'game-dev', 'unity-3d', 'recipes');
}

function readRecipes(dir: string): WorkflowRecipeCheck[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.endsWith('.json'))
    .sort()
    .map((entry) => {
      const path = join(dir, entry);
      const data = readJson<unknown>(path);
      const record = asRecord(data);
      const id = typeof record?.id === 'string' ? record.id : basename(entry, '.json');
      if (data === null) return { id, path: toPosix(path), valid: false, errors: [`unreadable recipe: ${toPosix(path)}`] };
      const validation = validateRecipe(data);
      return { id, path: toPosix(path), valid: validation.ok, errors: validation.errors };
    });
}

function evaluatePhases(catalog: WorkflowCatalog, projectRoot: string): CatalogPhaseProgress[] {
  return catalog.phases.map((phase) => {
    const steps: CatalogStepCheck[] = phase.steps.map((step) => {
      const outcome = step.artifact ? evaluateArtifactCheck(step.artifact, { projectRoot }) : 'undetectable';
      return {
        id: step.id,
        name: step.name,
        command: step.command,
        required: step.required,
        outcome,
        blocking: step.required && outcome !== 'met',
      };
    });
    const complete = steps.every((step) => !step.blocking);
    return { id: phase.id, label: phase.label, nextPhase: phase.nextPhase, complete, steps };
  });
}

// The first required step that does not satisfy its phase. `unmet` and
// `undetectable` both block: a note-only check cannot prove completion, so it
// must not be reported as done (review-lessons #4).
function firstBlocking(phases: CatalogPhaseProgress[]): { phaseId: string; step: CatalogStepCheck } | null {
  for (const phase of phases) {
    for (const step of phase.steps) {
      if (step.blocking) return { phaseId: phase.id, step };
    }
  }
  return null;
}

export function runWorkflowCatalog(options: ComposeOptions): WorkflowCatalogResult {
  const catalogPath = options.catalog ?? defaultCatalogPath(options);
  const recipesDir = options.recipesDir ?? defaultRecipesDir(options);
  const recipes = readRecipes(recipesDir);
  const base = { catalogPath: toPosix(catalogPath), recipesDir: toPosix(recipesDir), recipes };

  const raw = readJson<unknown>(catalogPath);
  if (raw === null) {
    const result = makeResult('workflow-catalog', 'unavailable', `no workflow catalog at ${toPosix(catalogPath)}`, []);
    return { ...result, ...base, catalogValid: false, catalogErrors: [], phases: [], currentPhase: null, nextCommand: null, nextStepId: null };
  }

  const validation = validateWorkflowCatalog(raw);
  if (!validation.ok) {
    const result = makeResult(
      'workflow-catalog',
      'observed_locally',
      `workflow catalog invalid: ${validation.errors.length} error(s)`,
      validation.errors
    );
    return { ...result, ...base, catalogValid: false, catalogErrors: validation.errors, phases: [], currentPhase: null, nextCommand: null, nextStepId: null };
  }

  const catalog = raw as WorkflowCatalog;
  const phases = evaluatePhases(catalog, options.projectRoot);
  const blocking = firstBlocking(phases);
  const invalidRecipes = recipes.filter((recipe) => !recipe.valid);
  const status = invalidRecipes.length > 0 ? 'observed_locally' : 'ok';
  const blockingNote = blocking
    ? `next: ${blocking.step.command} (required step "${blocking.step.id}" is ${blocking.step.outcome})`
    : 'all machine-checkable phases complete';
  const summary =
    invalidRecipes.length > 0
      ? `catalog valid; ${invalidRecipes.length}/${recipes.length} recipe(s) invalid`
      : `catalog valid; ${recipes.length} recipe(s) valid; ${blockingNote}`;
  const result = makeResult(
    'workflow-catalog',
    status,
    summary,
    invalidRecipes.flatMap((recipe) => recipe.errors.map((error) => `recipe "${recipe.id}": ${error}`))
  );
  return {
    ...result,
    ...base,
    catalogValid: true,
    catalogErrors: validation.errors,
    phases,
    currentPhase: blocking?.phaseId ?? null,
    nextCommand: blocking?.step.command ?? null,
    nextStepId: blocking?.step.id ?? null,
  };
}
