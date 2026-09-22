// Recipe data contract for the Compose family (Phase 6 Step 6.2, ADR-0016).
//
// A recipe is a versioned pipeline of phases and steps; each step may declare a
// machine-evaluable artifact check (glob + required pattern) or a `note`
// fallback. This module holds the pure pieces only: the validator (precise
// messages for malformed input) and `evaluateArtifactCheck`, which is pure over
// an injectable glob/readFile seam and never touches the wall clock.
import { asRecord } from '../../../shared/json-helpers';

export const RECIPE_SCHEMA_VERSION = 1;

export const RECIPE_PHASE_TYPES = ['serial', 'parallel'] as const;
export type RecipePhaseType = (typeof RECIPE_PHASE_TYPES)[number];

export const RECIPE_STEP_KINDS = ['agent', 'manual', 'command', 'cli', 'ability', 'report'] as const;
export type RecipeStepKind = (typeof RECIPE_STEP_KINDS)[number];

export interface RecipeArtifact {
  glob?: string;
  pattern?: string;
  minCount?: number;
  note?: string;
}

export interface RecipeStep {
  id: string;
  kind: RecipeStepKind;
  role?: string;
  description: string;
  command?: string;
  abilities?: string[];
  agents?: string[];
  gates?: string[];
  artifact?: RecipeArtifact;
}

export interface RecipePhase {
  id: string;
  type: RecipePhaseType;
  description: string;
  dependsOn?: string[];
  steps: RecipeStep[];
}

export interface Recipe {
  schemaVersion: number;
  id: string;
  name: string;
  description: string;
  version: string;
  phases: RecipePhase[];
}

export interface RecipeValidation {
  ok: boolean;
  errors: string[];
}

const RECIPE_REQUIRED_FIELDS = ['schemaVersion', 'id', 'name', 'description', 'version', 'phases'] as const;
const PHASE_REQUIRED_FIELDS = ['id', 'type', 'description', 'steps'] as const;
const STEP_REQUIRED_FIELDS = ['id', 'kind', 'description'] as const;

export function isMissing(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function validateArtifact(value: unknown, label: string, errors: string[]): void {
  if (value === undefined) return;
  const artifact = asRecord(value);
  if (!artifact) {
    errors.push(`${label} artifact must be an object`);
    return;
  }
  if (artifact.glob === undefined && artifact.note === undefined) {
    errors.push(`${label} artifact must declare "glob" (machine-evaluable) or "note" (fallback)`);
  }
  if (artifact.glob !== undefined && (typeof artifact.glob !== 'string' || artifact.glob.trim() === '')) {
    errors.push(`${label} artifact.glob must be a non-empty string`);
  }
  if (artifact.pattern !== undefined && typeof artifact.pattern !== 'string') {
    errors.push(`${label} artifact.pattern must be a string`);
  }
  if (artifact.note !== undefined && typeof artifact.note !== 'string') {
    errors.push(`${label} artifact.note must be a string`);
  }
  if (artifact.minCount !== undefined && (!Number.isInteger(artifact.minCount) || (artifact.minCount as number) < 1)) {
    errors.push(`${label} artifact.minCount must be a positive integer`);
  }
  if ((artifact.pattern !== undefined || artifact.minCount !== undefined) && artifact.glob === undefined) {
    errors.push(`${label} artifact.pattern/minCount require artifact.glob`);
  }
}

export function validateRecipe(data: unknown): RecipeValidation {
  const errors: string[] = [];
  const root = asRecord(data);
  if (!root) return { ok: false, errors: ['recipe must be a JSON object'] };

  for (const key of RECIPE_REQUIRED_FIELDS) {
    if (isMissing(root[key])) errors.push(`missing required field: ${key}`);
  }
  if (root.schemaVersion !== undefined && root.schemaVersion !== RECIPE_SCHEMA_VERSION) {
    errors.push(`unsupported schemaVersion: expected ${RECIPE_SCHEMA_VERSION}, got ${JSON.stringify(root.schemaVersion)}`);
  }
  if (root.version !== undefined && (typeof root.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(root.version))) {
    errors.push(`invalid version: expected MAJOR.MINOR.PATCH, got ${JSON.stringify(root.version)}`);
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
    for (const key of PHASE_REQUIRED_FIELDS) {
      if (isMissing(phase[key])) errors.push(`${label} missing required field: ${key}`);
    }
    if (id) {
      if (phaseIds.has(id)) errors.push(`duplicate phase id "${id}"`);
      phaseIds.add(id);
    }

    if (phase.type !== undefined && !(RECIPE_PHASE_TYPES as readonly unknown[]).includes(phase.type)) {
      errors.push(`${label} has unknown type ${JSON.stringify(phase.type)}: expected one of ${RECIPE_PHASE_TYPES.join('|')}`);
    }
    if (phase.dependsOn !== undefined && !isStringArray(phase.dependsOn)) {
      errors.push(`${label} dependsOn must be an array of phase ids`);
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
      for (const key of STEP_REQUIRED_FIELDS) {
        if (isMissing(step[key])) errors.push(`${stepLabel} missing required field: ${key}`);
      }
      if (stepId) {
        if (stepIds.has(stepId)) errors.push(`duplicate step id "${stepId}" in ${label}`);
        stepIds.add(stepId);
      }

      if (step.kind !== undefined && !(RECIPE_STEP_KINDS as readonly unknown[]).includes(step.kind)) {
        errors.push(`${stepLabel} has unknown kind ${JSON.stringify(step.kind)}: expected one of ${RECIPE_STEP_KINDS.join('|')}`);
      }
      for (const key of ['role', 'command']) {
        if (step[key] !== undefined && typeof step[key] !== 'string') errors.push(`${stepLabel} ${key} must be a string`);
      }
      for (const key of ['abilities', 'agents', 'gates']) {
        if (step[key] !== undefined && !isStringArray(step[key])) errors.push(`${stepLabel} ${key} must be an array of strings`);
      }
      validateArtifact(step.artifact, stepLabel, errors);
    });
  });

  phases.forEach((phaseRaw, i) => {
    const phase = asRecord(phaseRaw);
    if (!phase || !isStringArray(phase.dependsOn)) return;
    const id = typeof phase.id === 'string' ? phase.id : `phase[${i}]`;
    for (const dependency of phase.dependsOn) {
      if (!phaseIds.has(dependency)) errors.push(`phase "${id}" dependsOn unknown phase "${dependency}"`);
    }
  });

  return { ok: errors.length === 0, errors };
}

export type ArtifactCheckOutcome = 'met' | 'unmet' | 'undetectable';

export type RecipeGlob = (pattern: string, options: { cwd: string }) => string[];
export type RecipeReadFile = (path: string) => string | null;

export interface ArtifactCheckContext {
  projectRoot: string;
  glob: RecipeGlob;
  readFile?: RecipeReadFile;
}

export function evaluateArtifactCheck(check: RecipeArtifact, context: ArtifactCheckContext): ArtifactCheckOutcome {
  if (!check || typeof check.glob !== 'string' || check.glob.trim() === '') return 'undetectable';

  let matches: string[];
  try {
    matches = context.glob(check.glob, { cwd: context.projectRoot });
  } catch {
    return 'undetectable';
  }
  if (!Array.isArray(matches)) return 'undetectable';

  const minCount = typeof check.minCount === 'number' && Number.isInteger(check.minCount) && check.minCount > 0 ? check.minCount : 1;

  if (typeof check.pattern !== 'string' || check.pattern === '') {
    return matches.length >= minCount ? 'met' : 'unmet';
  }

  let matcher: RegExp;
  try {
    matcher = new RegExp(check.pattern);
  } catch {
    return 'undetectable';
  }
  if (!context.readFile) return 'undetectable';

  let satisfied = 0;
  for (const file of matches) {
    let content: string | null;
    try {
      content = context.readFile(file);
    } catch {
      return 'undetectable';
    }
    if (typeof content === 'string' && matcher.test(content)) satisfied += 1;
  }
  return satisfied >= minCount ? 'met' : 'unmet';
}
