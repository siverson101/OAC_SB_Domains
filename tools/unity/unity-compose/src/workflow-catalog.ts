// workflow-catalog — validate the 7-phase lifecycle catalog and the recipes,
// evaluate the catalog's artifact checks, and surface the next command.
//
// The catalog (xdomains/context/workflow-catalog.json) pairs each lifecycle step
// with the command that realises it and, where progression is machine-checkable,
// an artifact check (glob + required pattern) or a human `note` fallback. The
// recipes (xdomains/game-dev/unity-3d/recipes/*.json) are validated with the same
// `validateRecipe` the Compose family ships (ADR-0016). Offline, read-only and
// fail-soft: a missing catalog or recipe is reported, never thrown.
import { readdirSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { dirExists, readJson, readText, toPosix } from '../../../shared/io';
import {
  evaluateArtifactCheck,
  isMissing,
  validateArtifact,
  validateRecipe,
  type ArtifactCheckOutcome,
  type RecipeArtifact,
  type RecipeGlob,
  type RecipeValidation,
} from './recipes';
import { makeResult, type ComposeBase, type ComposeOptions } from './shared';

export const CATALOG_SCHEMA_VERSION = 1;

const MAX_GLOB_MATCHES = 20000;

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
  const root = data !== null && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
  if (!root) return { ok: false, errors: ['workflow catalog must be a JSON object'] };

  for (const key of CATALOG_REQUIRED_FIELDS) {
    if (isMissing(root[key])) errors.push(`missing required field: ${key}`);
  }
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
    const phase = phaseRaw !== null && typeof phaseRaw === 'object' && !Array.isArray(phaseRaw) ? (phaseRaw as Record<string, unknown>) : null;
    if (!phase) {
      errors.push(`${where} must be an object`);
      return;
    }
    const id = typeof phase.id === 'string' ? phase.id : null;
    const label = id ? `phase "${id}"` : where;
    for (const key of CATALOG_PHASE_REQUIRED_FIELDS) {
      if (isMissing(phase[key])) errors.push(`${label} missing required field: ${key}`);
    }
    if (id) {
      if (phaseIds.has(id)) errors.push(`duplicate phase id "${id}"`);
      phaseIds.add(id);
    }
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
      const step = stepRaw !== null && typeof stepRaw === 'object' && !Array.isArray(stepRaw) ? (stepRaw as Record<string, unknown>) : null;
      if (!step) {
        errors.push(`${label} step[${j}] must be an object`);
        return;
      }
      const stepId = typeof step.id === 'string' ? step.id : null;
      const stepLabel = stepId ? `${label} step "${stepId}"` : `${label} step[${j}]`;
      for (const key of CATALOG_STEP_REQUIRED_FIELDS) {
        if (isMissing(step[key])) errors.push(`${stepLabel} missing required field: ${key}`);
      }
      if (typeof step.required !== 'boolean') errors.push(`${stepLabel} missing required field: required`);
      if (stepId) {
        if (stepIds.has(stepId)) errors.push(`duplicate step id "${stepId}" in ${label}`);
        stepIds.add(stepId);
      }
      for (const key of ['name', 'command', 'description']) {
        if (step[key] !== undefined && typeof step[key] !== 'string') errors.push(`${stepLabel} ${key} must be a string`);
      }
      if (step.repeatable !== undefined && typeof step.repeatable !== 'boolean') errors.push(`${stepLabel} repeatable must be a boolean`);
      validateArtifact(step.artifact, stepLabel, errors);
    });
  });

  phases.forEach((phaseRaw, i) => {
    const phase = phaseRaw !== null && typeof phaseRaw === 'object' && !Array.isArray(phaseRaw) ? (phaseRaw as Record<string, unknown>) : null;
    if (!phase) return;
    const id = typeof phase.id === 'string' ? phase.id : `phase[${i}]`;
    const next = phase.nextPhase;
    if (typeof next !== 'string') return;
    if (!phaseIds.has(next)) errors.push(`phase "${id}" nextPhase names unknown phase "${next}"`);
    if (next === phase.id) errors.push(`phase "${id}" nextPhase must not reference itself`);
  });

  return { ok: errors.length === 0, errors };
}

function globToRegExp(pattern: string): RegExp {
  let source = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === '*') {
      if (pattern[i + 1] === '*') {
        i += 1;
        if (pattern[i + 1] === '/') {
          i += 1;
          source += '(?:.*/)?';
        } else {
          source += '.*';
        }
      } else {
        source += '[^/]*';
      }
    } else if (char === '?') {
      source += '[^/]';
    } else if ('.+^${}()|[]\\'.includes(char)) {
      source += `\\${char}`;
    } else {
      source += char;
    }
  }
  return new RegExp(`^${source}$`);
}

// The literal directory a glob can match under, so evaluation only walks the
// subtree it could ever match (e.g. `.opencode/project-data/*.json` -> that dir).
function literalBase(pattern: string): string {
  const firstWildcard = pattern.search(/[*?[\]]/);
  const prefix = firstWildcard === -1 ? pattern : pattern.slice(0, firstWildcard);
  const slash = prefix.lastIndexOf('/');
  return slash === -1 ? '' : prefix.slice(0, slash);
}

export function makeProjectGlob(projectRoot: string): RecipeGlob {
  return (pattern, { cwd }) => {
    const root = cwd || projectRoot;
    const base = literalBase(toPosix(pattern));
    const baseDir = base ? join(root, base) : root;
    if (!dirExists(baseDir)) return [];

    const matcher = globToRegExp(toPosix(pattern));
    const matches: string[] = [];
    const walk = (dir: string): void => {
      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch {
        return;
      }
      for (const entry of entries) {
        if (matches.length >= MAX_GLOB_MATCHES) return;
        const full = join(dir, entry);
        let directory = false;
        try {
          directory = statSync(full).isDirectory();
        } catch {
          continue;
        }
        if (directory) {
          walk(full);
          continue;
        }
        const rel = toPosix(relative(root, full));
        if (matcher.test(rel)) matches.push(rel);
      }
    };
    walk(baseDir);
    return matches;
  };
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
      const id =
        data !== null && typeof data === 'object' && typeof (data as { id?: unknown }).id === 'string'
          ? ((data as { id: string }).id)
          : basename(entry, '.json');
      if (data === null) return { id, path: toPosix(path), valid: false, errors: [`unreadable recipe: ${toPosix(path)}`] };
      const validation = validateRecipe(data);
      return { id, path: toPosix(path), valid: validation.ok, errors: validation.errors };
    });
}

function evaluatePhases(catalog: WorkflowCatalog, projectRoot: string): CatalogPhaseProgress[] {
  const glob = makeProjectGlob(projectRoot);
  const readFile = (path: string): string | null => readText(join(projectRoot, path));
  return catalog.phases.map((phase) => {
    const steps: CatalogStepCheck[] = phase.steps.map((step) => ({
      id: step.id,
      name: step.name,
      command: step.command,
      required: step.required,
      outcome: step.artifact ? evaluateArtifactCheck(step.artifact, { projectRoot, glob, readFile }) : 'undetectable',
    }));
    const complete = steps.every((step) => !step.required || step.outcome !== 'unmet');
    return { id: phase.id, label: phase.label, nextPhase: phase.nextPhase, complete, steps };
  });
}

function firstUnmet(phases: CatalogPhaseProgress[]): { phaseId: string; step: CatalogStepCheck } | null {
  for (const phase of phases) {
    for (const step of phase.steps) {
      if (step.required && step.outcome === 'unmet') return { phaseId: phase.id, step };
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
  const unmet = firstUnmet(phases);
  const invalidRecipes = recipes.filter((recipe) => !recipe.valid);
  const status = invalidRecipes.length > 0 ? 'observed_locally' : 'ok';
  const summary =
    invalidRecipes.length > 0
      ? `catalog valid; ${invalidRecipes.length}/${recipes.length} recipe(s) invalid`
      : unmet
        ? `catalog valid; ${recipes.length} recipe(s) valid; next: ${unmet.step.command}`
        : `catalog valid; ${recipes.length} recipe(s) valid; all machine-checkable phases complete`;
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
    currentPhase: unmet?.phaseId ?? null,
    nextCommand: unmet?.step.command ?? null,
    nextStepId: unmet?.step.id ?? null,
  };
}
