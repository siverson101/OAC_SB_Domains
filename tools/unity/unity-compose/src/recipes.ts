// Recipe data contract for the Compose family (Phase 6 Step 6.2, ADR-0016).
//
// A recipe is a versioned pipeline of phases and steps; each step may declare a
// machine-evaluable artifact check (glob + required pattern) or a `note`
// fallback. This module holds the pure pieces only: the validator (precise
// messages for malformed input) and `evaluateArtifactCheck`, which is pure over
// an injectable glob/readFile seam (with a node-backed default) and never
// touches the wall clock.
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { dirExists, readText, toPosix } from '../../../shared/io';
import { asRecord } from '../../../shared/json-helpers';

export const RECIPE_SCHEMA_VERSION = 1;

// Mirrors `properties.id.pattern` in xdomains/context/recipe.schema.json;
// pinned by tests/recipes.test.ts.
export const RECIPE_ID_PATTERN = '^[a-z0-9]+(?:-[a-z0-9]+)*$';

export const RECIPE_PHASE_TYPES = ['serial', 'parallel'] as const;
export type RecipePhaseType = (typeof RECIPE_PHASE_TYPES)[number];

export const RECIPE_STEP_KINDS = ['agent', 'manual', 'command', 'cli', 'ability', 'report'] as const;
export type RecipeStepKind = (typeof RECIPE_STEP_KINDS)[number];

// The allowed keys per object, mirroring the schema's `additionalProperties:
// false` objects (phase, step, artifact). Unknown keys are rejected so a typo
// (`roles`, `agent`) fails loudly instead of being ignored.
export const RECIPE_PHASE_KEYS = ['id', 'type', 'description', 'dependsOn', 'steps'] as const;
export const RECIPE_STEP_KEYS = [
  'id',
  'kind',
  'description',
  'command',
  'abilities',
  'agents',
  'gates',
  'artifact',
] as const;
export const RECIPE_ARTIFACT_KEYS = ['glob', 'pattern', 'minCount', 'note'] as const;

export interface RecipeArtifact {
  glob?: string;
  pattern?: string;
  minCount?: number;
  note?: string;
}

export interface RecipeStep {
  id: string;
  kind: RecipeStepKind;
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

// Shared required-field check used by both the recipe and catalog validators.
export function requireFields(
  record: Record<string, unknown>,
  label: string,
  fields: readonly string[],
  errors: string[]
): void {
  const prefix = label ? `${label} ` : '';
  for (const key of fields) {
    if (isMissing(record[key])) errors.push(`${prefix}missing required field: ${key}`);
  }
}

// Shared duplicate-id check: one message shape for both validators so a
// duplicated phase/step id is reported identically wherever it is walked.
export function validateUniqueId(
  id: string | null,
  seen: Set<string>,
  errors: string[],
  kind: 'phase' | 'step',
  where?: string
): void {
  if (!id) return;
  if (seen.has(id)) errors.push(where ? `duplicate ${kind} id "${id}" in ${where}` : `duplicate ${kind} id "${id}"`);
  seen.add(id);
}

export function rejectUnknownKeys(
  record: Record<string, unknown>,
  label: string,
  allowed: readonly string[],
  errors: string[]
): void {
  for (const key of Object.keys(record)) {
    if (!(allowed as readonly string[]).includes(key)) errors.push(`${label} has unknown key "${key}"`);
  }
}

export function validateArtifact(value: unknown, label: string, errors: string[]): void {
  if (value === undefined) return;
  const artifact = asRecord(value);
  if (!artifact) {
    errors.push(`${label} artifact must be an object`);
    return;
  }
  rejectUnknownKeys(artifact, `${label} artifact`, RECIPE_ARTIFACT_KEYS, errors);
  if (artifact.glob === undefined && artifact.note === undefined) {
    errors.push(`${label} artifact must declare "glob" (machine-evaluable) or "note" (fallback)`);
  }
  // `note` is the human fallback for a step that cannot be auto-detected; it is
  // meaningless next to a machine check, and `evaluateArtifactCheck` would
  // silently ignore it. Reject the combination rather than ship a decorative key.
  if (artifact.glob !== undefined && artifact.note !== undefined) {
    errors.push(`${label} artifact must not combine "glob" (machine-evaluable) with "note" (fallback)`);
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

  requireFields(root, '', RECIPE_REQUIRED_FIELDS, errors);
  if (root.schemaVersion !== undefined && root.schemaVersion !== RECIPE_SCHEMA_VERSION) {
    errors.push(`unsupported schemaVersion: expected ${RECIPE_SCHEMA_VERSION}, got ${JSON.stringify(root.schemaVersion)}`);
  }
  if (root.id !== undefined && (typeof root.id !== 'string' || !new RegExp(RECIPE_ID_PATTERN).test(root.id))) {
    errors.push(`invalid id: expected kebab-case matching ${RECIPE_ID_PATTERN}, got ${JSON.stringify(root.id)}`);
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
    requireFields(phase, label, PHASE_REQUIRED_FIELDS, errors);
    validateUniqueId(id, phaseIds, errors, 'phase');
    rejectUnknownKeys(phase, label, RECIPE_PHASE_KEYS, errors);

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
      requireFields(step, stepLabel, STEP_REQUIRED_FIELDS, errors);
      validateUniqueId(stepId, stepIds, errors, 'step', label);
      rejectUnknownKeys(step, stepLabel, RECIPE_STEP_KEYS, errors);

      if (step.kind !== undefined && !(RECIPE_STEP_KINDS as readonly unknown[]).includes(step.kind)) {
        errors.push(`${stepLabel} has unknown kind ${JSON.stringify(step.kind)}: expected one of ${RECIPE_STEP_KINDS.join('|')}`);
      }
      if (step.command !== undefined && typeof step.command !== 'string') errors.push(`${stepLabel} command must be a string`);
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
  // Injectable for tests; defaults to the node-backed project glob so
  // `evaluateArtifactCheck(check, { projectRoot })` is a complete call.
  glob?: RecipeGlob;
  readFile?: RecipeReadFile;
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
  // `globToRegExp` has no `[...]` character-class support (it escapes the
  // brackets as literals), so `[`/`]` must not be treated as wildcards here.
  const firstWildcard = pattern.search(/[*?]/);
  const prefix = firstWildcard === -1 ? pattern : pattern.slice(0, firstWildcard);
  const slash = prefix.lastIndexOf('/');
  return slash === -1 ? '' : prefix.slice(0, slash);
}

const MAX_GLOB_MATCHES = 20000;

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

// Evaluate a step's artifact check. `minCount` (default 1) is the number of
// files that must satisfy the check: when `pattern` is absent, the number of
// glob matches; when `pattern` is present, the number of matched files whose
// contents contain the regex. So with three matched files, two of which contain
// the pattern, `minCount: 2` is `met` and `minCount: 3` is `unmet` — `minCount`
// counts pattern-satisfying files, not all glob matches.
export function evaluateArtifactCheck(check: RecipeArtifact, context: ArtifactCheckContext): ArtifactCheckOutcome {
  if (!check || typeof check.glob !== 'string' || check.glob.trim() === '') return 'undetectable';

  const glob = context.glob ?? makeProjectGlob(context.projectRoot);
  let matches: string[];
  try {
    matches = glob(check.glob, { cwd: context.projectRoot });
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
  const readFile = context.readFile ?? ((path: string) => readText(join(context.projectRoot, path)));

  let satisfied = 0;
  for (const file of matches) {
    let content: string | null;
    try {
      content = readFile(file);
    } catch {
      return 'undetectable';
    }
    if (typeof content === 'string' && matcher.test(content)) satisfied += 1;
  }
  return satisfied >= minCount ? 'met' : 'unmet';
}
