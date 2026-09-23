// Pure resolver for multi-axis agent templates (ADR-0020).
//
// Given a template body, a manifest, and one value per axis, substitute every
// `{{PLACEHOLDER}}` and compute the variant filename. Fails fast: an invalid
// selection, an unknown placeholder, or any `{{` left after substitution throws
// rather than emitting a half-resolved agent.

import { asRecord } from '../../json-helpers';
import { TemplateError, type ResolvedTemplate, type Substitution, type TemplateManifest } from './types';

export const TEMPLATE_SCHEMA_VERSION = 1;

export function parseManifest(value: unknown): TemplateManifest {
  const record = asRecord(value);
  if (!record) throw new TemplateError('manifest must be a JSON object');

  // Refuse an unknown schema version loudly rather than silently accepting it.
  if (record.schemaVersion !== undefined && record.schemaVersion !== TEMPLATE_SCHEMA_VERSION) {
    throw new TemplateError(
      `unsupported manifest schemaVersion ${JSON.stringify(record.schemaVersion)}, expected ${TEMPLATE_SCHEMA_VERSION}`
    );
  }

  const base = record.base;
  if (typeof base !== 'string' || base.trim() === '') throw new TemplateError('manifest.base must be a non-empty string');

  const installAs = record.installAs;
  if (typeof installAs !== 'string' || installAs.trim() === '') {
    throw new TemplateError('manifest.installAs must be a non-empty string');
  }

  if (!Array.isArray(record.axes) || record.axes.length === 0) {
    throw new TemplateError('manifest.axes must be a non-empty array');
  }
  const axes = record.axes.map((entry, index) => {
    const axis = asRecord(entry);
    if (!axis || typeof axis.id !== 'string' || axis.id.trim() === '') {
      throw new TemplateError(`manifest.axes[${index}].id must be a non-empty string`);
    }
    const values = asRecord(axis.values);
    if (!values || Object.keys(values).length === 0) {
      throw new TemplateError(`manifest.axes[${index}].values must be a non-empty object`);
    }
    let fallback: string | undefined;
    if (axis.default !== undefined) {
      if (typeof axis.default !== 'string' || !Object.prototype.hasOwnProperty.call(values, axis.default)) {
        throw new TemplateError(`manifest.axes[${index}].default must be one of ${Object.keys(values).join('|')}`);
      }
      fallback = axis.default;
    }
    return { id: axis.id.trim(), values: values as Record<string, string | boolean>, default: fallback };
  });

  if (typeof record.output !== 'string' || record.output.trim() === '') {
    throw new TemplateError('manifest.output must be a non-empty string');
  }

  const rawSubs = asRecord(record.substitutions);
  if (!rawSubs) throw new TemplateError('manifest.substitutions must be an object');
  const substitutions: Record<string, Substitution> = {};
  for (const [key, value] of Object.entries(rawSubs)) {
    if (typeof value === 'string') {
      substitutions[key] = value;
    } else {
      const map = asRecord(value);
      if (!map || !Object.values(map).every((v) => typeof v === 'string')) {
        throw new TemplateError(`manifest.substitutions.${key} must be a string or a map of strings`);
      }
      substitutions[key] = map as Record<string, string>;
    }
  }

  const conditionals = asRecord(record.conditionals);
  return {
    schemaVersion: typeof record.schemaVersion === 'number' ? record.schemaVersion : TEMPLATE_SCHEMA_VERSION,
    base,
    installAs,
    axes,
    output: record.output,
    substitutions,
    conditionals: conditionals ? (conditionals as Record<string, string>) : undefined,
  };
}

export function axisIds(manifest: TemplateManifest): string[] {
  return manifest.axes.map((axis) => axis.id);
}

// The selection used when none is supplied (registry/tests): each axis's
// declared `default`, else its first value in declaration order.
export function defaultSelection(manifest: TemplateManifest): Record<string, string> {
  const selection: Record<string, string> = {};
  for (const axis of manifest.axes) {
    selection[axis.id] = axis.default ?? Object.keys(axis.values)[0];
  }
  return selection;
}

export function validateSelection(manifest: TemplateManifest, selection: Record<string, string>): void {
  // Extra axes are ignored: one selection can drive several manifests that
  // declare different axes (the apply engine passes the project selection to
  // every templated agent). Each manifest still requires all of its own axes.
  for (const axis of manifest.axes) {
    const value = selection[axis.id];
    if (value === undefined) throw new TemplateError(`missing value for axis "${axis.id}"`);
    if (!Object.prototype.hasOwnProperty.call(axis.values, value)) {
      throw new TemplateError(`unknown value "${value}" for axis "${axis.id}" (expected ${Object.keys(axis.values).join('|')})`);
    }
  }
}

function installStem(installAs: string): string {
  const base = installAs.split('/').pop() ?? installAs;
  return base.replace(/\.md$/, '');
}

function placeholderValue(name: string, manifest: TemplateManifest, selection: Record<string, string>): string {
  if (Object.prototype.hasOwnProperty.call(manifest.substitutions, name)) {
    const sub = manifest.substitutions[name];
    if (typeof sub === 'string') return sub;
    for (const value of Object.values(selection)) {
      if (Object.prototype.hasOwnProperty.call(sub, value)) return sub[value];
    }
    throw new TemplateError(`no substitution value for {{${name}}} with selection ${JSON.stringify(selection)}`);
  }
  if (name === 'BASE_NAME') return manifest.base;
  if (name === 'INSTALL_NAME') return installStem(manifest.installAs);
  if (Object.prototype.hasOwnProperty.call(selection, name)) return selection[name];
  throw new TemplateError(`unknown placeholder {{${name}}}`);
}

const PLACEHOLDER = /\{\{([A-Za-z0-9_]+)\}\}/g;

function substitute(text: string, manifest: TemplateManifest, selection: Record<string, string>): string {
  const out = text.replace(PLACEHOLDER, (_match, name: string) => placeholderValue(name, manifest, selection));
  if (out.includes('{{') || out.includes('}}')) {
    const leftover = out.match(/\{\{[^}]*\}\}|\}\}|\{\{/);
    throw new TemplateError(`unresolved placeholder remains after substitution: ${leftover?.[0] ?? '{{'}`);
  }
  return out;
}

export function resolveTemplate(
  template: string,
  manifest: TemplateManifest,
  selection: Record<string, string>
): ResolvedTemplate {
  validateSelection(manifest, selection);
  const content = substitute(template, manifest, selection);
  const filename = substitute(manifest.output, manifest, selection);
  return { content, filename, installAs: manifest.installAs, axes: { ...selection } };
}

// Every axis combination, in declaration order (cartesian product).
export function combinations(manifest: TemplateManifest): Record<string, string>[] {
  let out: Record<string, string>[] = [{}];
  for (const axis of manifest.axes) {
    const values = Object.keys(axis.values);
    const next: Record<string, string>[] = [];
    for (const partial of out) {
      for (const value of values) next.push({ ...partial, [axis.id]: value });
    }
    out = next;
  }
  return out;
}

export function parseSelection(input: string): Record<string, string> {
  const selection: Record<string, string> = {};
  for (const pair of input.split(',')) {
    const trimmed = pair.trim();
    if (trimmed === '') continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) throw new TemplateError(`axis selection "${trimmed}" must be id=value`);
    selection[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return selection;
}
