// Multi-axis agent templating: shared vocabulary (ADR-0020).
//
// A template is `<Base>.md` with `{{PLACEHOLDER}}` markers; a manifest declares
// the axes an agent varies along, the substitution map for each placeholder, and
// the output/install names. One shared resolver turns a template + a selection
// into a concrete variant; nothing agent-specific lives here.

// One axis value's abbreviation -> human label (or boolean marker). The
// abbreviation is what appears in a variant filename and in an axis selection.
export type AxisValues = Record<string, string | boolean>;

export interface Axis {
  id: string;
  values: AxisValues;
  // The value used when no explicit selection is given (registry/tests default).
  default?: string;
}

// A placeholder's replacement: a constant string, or a map keyed by a selected
// axis value (the value of whichever axis is present in the map).
export type Substitution = string | Record<string, string>;

export interface TemplateManifest {
  schemaVersion?: number;
  base: string;
  installAs: string;
  axes: Axis[];
  output: string;
  substitutions: Record<string, Substitution>;
  // Documents which placeholders are conditional (present for some values only).
  conditionals?: Record<string, string>;
}

export interface ResolvedTemplate {
  content: string;
  filename: string;
  installAs: string;
  axes: Record<string, string>;
}

export class TemplateError extends Error {}
