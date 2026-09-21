// Types for the pattern-toggle config (Phase 3 Step 3.4, FR6).
//
// `.opencode/unity-studio.json` holds the enabled patterns/packages, the
// TDD/FTF toggles, the studio hierarchy and the review intensity. The resolver
// checks that selection against the pattern catalog and reports every conflict;
// it never silently drops a pattern to pick a winner.

export const STUDIO_MODES = ['lean', 'full'] as const;
export type StudioMode = (typeof STUDIO_MODES)[number];

export const REVIEW_INTENSITIES = ['full', 'lean', 'solo'] as const;
export type ReviewIntensity = (typeof REVIEW_INTENSITIES)[number];

export interface StudioToggles {
  tdd: boolean;
  ftf: boolean;
}

// The only schema version this loader understands. An unknown version is
// recorded as a problem (fail-soft) rather than silently accepted.
export const STUDIO_CONFIG_SCHEMA_VERSION = 1;

export interface StudioConfig {
  schemaVersion: number;
  studioMode: StudioMode;
  reviewIntensity: ReviewIntensity;
  toggles: StudioToggles;
  patterns: string[];
  packages: string[];
}

// The fail-soft default when the file is missing or unreadable: Lean hierarchy,
// full review, no patterns/packages, both toggles off.
export const DEFAULT_STUDIO_CONFIG: StudioConfig = {
  schemaVersion: STUDIO_CONFIG_SCHEMA_VERSION,
  studioMode: 'lean',
  reviewIntensity: 'full',
  toggles: { tdd: false, ftf: false },
  patterns: [],
  packages: [],
};

// A schema/loader complaint. Problems are reported alongside the effective
// config rather than aborting, so a malformed file still yields a usable result.
export interface ConfigProblem {
  field: string;
  message: string;
}

export type ConflictKind = 'single-selection' | 'mutually-exclusive' | 'conflictsWith';

// A surfaced pattern conflict. `patterns` is the conflicting set (two ids for a
// `conflictsWith` edge, the whole enabled set for a category violation).
export interface PatternConflict {
  kind: ConflictKind;
  category?: string;
  patterns: string[];
  message: string;
}

// Structural subset of `xdomains/context/programming-patterns.json`. Loosened so
// a `PatternsFile` from the shared context loader is assignable while a partial
// fixture is still accepted.
export interface CatalogCategory {
  id: string;
  name?: string;
  selection?: 'single' | 'multiple';
  mutuallyExclusive?: boolean;
  patterns?: string[];
  deferToStage4?: boolean;
}

export interface CatalogPattern {
  id: string;
  name?: string;
  category?: string;
  conflictsWith?: string[];
}

export interface PatternCatalog {
  version?: string;
  categories?: CatalogCategory[];
  patterns?: CatalogPattern[];
}

export interface ResolvedStudioConfig {
  // The effective config: patterns/packages deduplicated, order preserved.
  config: StudioConfig;
  enabledPatterns: string[];
  enabledPackages: string[];
  byCategory: Record<string, string[]>;
  conflicts: PatternConflict[];
  problems: ConfigProblem[];
  valid: boolean;
}
