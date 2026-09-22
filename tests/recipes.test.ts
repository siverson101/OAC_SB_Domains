import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  RECIPE_PHASE_TYPES,
  RECIPE_STEP_KINDS,
  evaluateArtifactCheck,
  validateRecipe,
  type ArtifactCheckContext,
  type Recipe,
} from '../tools/unity/unity-compose/src/recipes';

const repoRoot = resolve(import.meta.dir, '..');
const schemaPath = join(repoRoot, 'xdomains', 'context', 'recipe.schema.json');

function validRecipe(): Recipe {
  return {
    schemaVersion: 1,
    id: 'unity-change-loop',
    name: 'Unity Change Loop',
    description: 'Resolve, inspect, change, compile, test, observe.',
    version: '1.0.0',
    phases: [
      {
        id: 'inspect',
        type: 'serial',
        description: 'Inspect the target.',
        steps: [
          {
            id: 'resolve-path',
            kind: 'ability',
            description: 'Resolve the symbol to a file path.',
            abilities: ['code-navigation'],
            artifact: { glob: 'Assets/**/*.cs', pattern: 'class ' },
          },
        ],
      },
      {
        id: 'change',
        type: 'serial',
        description: 'Apply the smallest change.',
        dependsOn: ['inspect'],
        steps: [
          {
            id: 'apply',
            kind: 'agent',
            role: 'implementer',
            description: 'Edit the file.',
            agents: ['unity-3d-implementer'],
            gates: ['compile-clean'],
            artifact: { glob: 'Assets/**/*.cs', minCount: 1, note: 'review the diff' },
          },
        ],
      },
    ],
  };
}

describe('validateRecipe', () => {
  test('a valid recipe passes', () => {
    const result = validateRecipe(validRecipe());
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  test('rejects a missing required phase field with a precise message', () => {
    const recipe = validRecipe();
    delete (recipe.phases[0] as Partial<Recipe['phases'][number]>).type;
    const result = validateRecipe(recipe);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('phase "inspect" missing required field: type');
  });

  test('rejects a missing required step field with a precise message', () => {
    const recipe = validRecipe();
    delete (recipe.phases[0].steps[0] as Partial<Recipe['phases'][number]['steps'][number]>).kind;
    const result = validateRecipe(recipe);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('step "resolve-path" missing required field: kind');
  });

  test('rejects an unknown phase type', () => {
    const recipe = validRecipe();
    (recipe.phases[0] as { type: string }).type = 'banana';
    const result = validateRecipe(recipe);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('phase "inspect" has unknown type "banana"');
  });

  test('rejects an unknown step kind', () => {
    const recipe = validRecipe();
    (recipe.phases[0].steps[0] as { kind: string }).kind = 'wizard';
    const result = validateRecipe(recipe);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('step "resolve-path" has unknown kind "wizard"');
  });

  test('rejects a duplicate phase id', () => {
    const recipe = validRecipe();
    recipe.phases.push({ ...recipe.phases[0] });
    const result = validateRecipe(recipe);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('duplicate phase id "inspect"');
  });

  test('rejects a duplicate step id within a phase', () => {
    const recipe = validRecipe();
    recipe.phases[0].steps.push({ ...recipe.phases[0].steps[0] });
    const result = validateRecipe(recipe);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('duplicate step id "resolve-path"');
  });

  test('rejects a dependsOn naming a missing phase', () => {
    const recipe = validRecipe();
    recipe.phases[1].dependsOn = ['inspect', 'ghost'];
    const result = validateRecipe(recipe);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('phase "change" dependsOn unknown phase "ghost"');
  });

  test('rejects a malformed artifact check', () => {
    const recipe = validRecipe();
    (recipe.phases[1].steps[0] as unknown as { artifact: unknown }).artifact = { pattern: 'x' };
    const result = validateRecipe(recipe);
    expect(result.ok).toBe(false);
    const joined = result.errors.join('\n');
    expect(joined).toContain('artifact must declare "glob" (machine-evaluable) or "note" (fallback)');
    expect(joined).toContain('artifact.pattern/minCount require artifact.glob');
  });

  test('rejects a non-object recipe', () => {
    expect(validateRecipe(null).ok).toBe(false);
    expect(validateRecipe('nope').errors[0]).toBe('recipe must be a JSON object');
  });
});

describe('recipe schema agrees with the TS contract', () => {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as {
    $defs: { step: { properties: { kind: { enum: string[] } } }; artifact: { properties: Record<string, unknown> } };
    properties: { phases: { items: { properties: { type: { enum: string[] } } } } };
  };

  test('phase type enum matches RECIPE_PHASE_TYPES', () => {
    expect(schema.properties.phases.items.properties.type.enum).toEqual([...RECIPE_PHASE_TYPES]);
  });

  test('step kind enum matches RECIPE_STEP_KINDS', () => {
    expect(schema.$defs.step.properties.kind.enum).toEqual([...RECIPE_STEP_KINDS]);
  });

  test('artifact declares glob, pattern, minCount and note', () => {
    expect(Object.keys(schema.$defs.artifact.properties).sort()).toEqual(['glob', 'minCount', 'note', 'pattern']);
  });
});

describe('evaluateArtifactCheck', () => {
  function context(files: Record<string, string>, matches: string[] | ((pattern: string) => string[])): ArtifactCheckContext {
    return {
      projectRoot: '/project',
      glob: (pattern) => (typeof matches === 'function' ? matches(pattern) : matches),
      readFile: (path) => files[path] ?? null,
    };
  }

  test('met when the glob matches at least minCount files', () => {
    expect(evaluateArtifactCheck({ glob: 'design/*.md' }, context({}, ['design/a.md']))).toBe('met');
  });

  test('unmet when the glob matches nothing', () => {
    expect(evaluateArtifactCheck({ glob: 'design/*.md' }, context({}, []))).toBe('unmet');
  });

  test('minCount is respected', () => {
    const check = { glob: 'docs/adr-*.md', minCount: 3 };
    expect(evaluateArtifactCheck(check, context({}, ['a', 'b']))).toBe('unmet');
    expect(evaluateArtifactCheck(check, context({}, ['a', 'b', 'c']))).toBe('met');
  });

  test('pattern is checked against file contents', () => {
    const check = { glob: 'technical-preferences.md', pattern: 'Engine: [^[]' };
    expect(evaluateArtifactCheck(check, context({ 'technical-preferences.md': 'Engine: Unity 6' }, ['technical-preferences.md']))).toBe('met');
    expect(evaluateArtifactCheck(check, context({ 'technical-preferences.md': 'Engine: [none]' }, ['technical-preferences.md']))).toBe('unmet');
  });

  test('pattern requires a readFile seam', () => {
    const result = evaluateArtifactCheck(
      { glob: 'a.md', pattern: 'x' },
      { projectRoot: '/project', glob: () => ['a.md'] }
    );
    expect(result).toBe('undetectable');
  });

  test('note-only checks are undetectable', () => {
    expect(evaluateArtifactCheck({ note: 'a human checks this' }, context({}, []))).toBe('undetectable');
  });

  test('a throwing glob is undetectable (fail-soft)', () => {
    const result = evaluateArtifactCheck(
      { glob: 'a.md' },
      {
        projectRoot: '/project',
        glob: () => {
          throw new Error('boom');
        },
      }
    );
    expect(result).toBe('undetectable');
  });

  test('an invalid pattern regex is undetectable', () => {
    expect(evaluateArtifactCheck({ glob: 'a.md', pattern: '[' }, context({ 'a.md': 'x' }, ['a.md']))).toBe('undetectable');
  });
});
