import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseFrontmatter } from '../tools/shared/registry/src/frontmatter';
import { validateContract } from '../tools/shared/registry/src/contract';

const repoRoot = resolve(import.meta.dir, '..');
const schemaPath = resolve(repoRoot, 'xdomains', 'context', 'capability-contract.schema.json');

interface CapabilitySchema {
  schemaVersion?: unknown;
  type?: string;
  required?: string[];
  properties?: Record<string, { type?: string | string[]; enum?: string[]; items?: { type?: string } }>;
}

const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as CapabilitySchema;

describe('capability contract schema', () => {
  test('loads and declares its version and object shape', () => {
    expect(schema.schemaVersion).toBeDefined();
    expect(schema.type).toBe('object');
  });

  test('declares id and summary as required', () => {
    expect(schema.required).toContain('id');
    expect(schema.required).toContain('summary');
  });

  test('declares family and mode enums', () => {
    expect(schema.properties?.family?.enum).toEqual(['sense', 'act', 'verify', 'run', 'compose']);
    expect(schema.properties?.mode?.enum).toEqual(['offline', 'live', 'both']);
  });

  test('declares every structured contract field', () => {
    const names = Object.keys(schema.properties ?? {});
    for (const field of [
      'requires',
      'provides',
      'compatiblePrimitives',
      'conflictsWith',
      'setupSteps',
      'testPlan',
      'failureModes',
      'codeFiles',
      'inputs',
      'outputs',
      'sideEffects',
      'safetyGate',
      'versionCompatibility',
      'uses',
      'usedBy',
    ]) {
      expect(names).toContain(field);
    }
    expect(schema.properties?.inputs?.type).toBe('object');
    expect(schema.properties?.outputs?.type).toBe('object');
  });

  test('declares safetyGate as an object of optional booleans', () => {
    const gate = schema.properties?.safetyGate as {
      type?: string;
      additionalProperties?: boolean;
      properties?: Record<string, { type?: string }>;
    };
    expect(gate?.type).toBe('object');
    expect(gate?.additionalProperties).toBe(false);
    expect(Object.keys(gate?.properties ?? {}).sort()).toEqual([
      'advisory',
      'dryRunFirst',
      'mutates',
      'requiresApproval',
      'requiresEditor',
    ]);
    for (const property of Object.values(gate?.properties ?? {})) {
      expect(property.type).toBe('boolean');
    }
  });
});

describe('frontmatter parser', () => {
  test('parses scalars, flow arrays, block sequences, and flow objects', () => {
    const content = [
      '---',
      'id: gather-unity-context',
      'summary: "Gathers Unity project context"',
      'family: sense',
      'mode: offline',
      'uses: [scan-project, structure]',
      'provides:',
      '  - gate.md',
      '  - preferences.md',
      'inputs: { projectRoot: "string", depth: 3 }',
      "outputs: { files: ['a.md', 'b.md'] }",
      '---',
      '',
      '# body',
    ].join('\n');

    const fm = parseFrontmatter(content);
    expect(fm.id).toBe('gather-unity-context');
    expect(fm.summary).toBe('Gathers Unity project context');
    expect(fm.family).toBe('sense');
    expect(fm.mode).toBe('offline');
    expect(fm.uses).toEqual(['scan-project', 'structure']);
    expect(fm.provides).toEqual(['gate.md', 'preferences.md']);
    expect(fm.inputs).toEqual({ projectRoot: 'string', depth: 3 });
    expect(fm.outputs).toEqual({ files: ['a.md', 'b.md'] });
  });

  test('keeps flow-object boolean literals as real booleans', () => {
    const content = [
      '---',
      'safetyGate: { mutates: false, requiresEditor: true, advisory: false }',
      '---',
    ].join('\n');

    const fm = parseFrontmatter(content);
    expect(fm.safetyGate).toEqual({ mutates: false, requiresEditor: true, advisory: false });
  });
});

describe('validateContract', () => {
  test('accepts a valid contract', () => {
    const result = validateContract({
      id: 'gather-unity-context',
      summary: 'Gathers Unity project context',
      family: 'sense',
      mode: 'offline',
    }, schema);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('rejects a missing id and a bad family', () => {
    const result = validateContract({ summary: 'No id here', family: 'sensing' }, schema);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('missing required field: id');
    expect(result.errors.some((error) => error.startsWith('invalid family'))).toBe(true);
  });

  test('rejects a bad mode', () => {
    const result = validateContract({ id: 'x', summary: 'y', mode: 'sometimes' }, schema);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.startsWith('invalid mode'))).toBe(true);
  });
});
