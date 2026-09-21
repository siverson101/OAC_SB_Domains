// Public library entry for the studio-config module (Phase 3 Step 3.4).
//
// The CLI entry (`./index`) and the shared registry both use this load ->
// resolve flow, so the orchestration lives in one place and the registry does
// not re-implement it. Fail-soft: a missing config yields the defaults.

import { loadPatternCatalog } from './catalog';
import { loadStudioConfig } from './config';
import { resolveStudioConfig } from './resolver';
import type { ConfigProblem, ResolvedStudioConfig } from './types';

export interface StudioConfigResult {
  configPath: string;
  catalogPath: string | null;
  present: boolean;
  resolution: ResolvedStudioConfig;
}

export function resolveStudioConfigProject(options: {
  configPath: string;
  catalogPath: string | null;
}): StudioConfigResult {
  const load = loadStudioConfig(options.configPath);
  const catalog = options.catalogPath ? loadPatternCatalog(options.catalogPath) : null;

  const problems: ConfigProblem[] = [...load.problems];
  if (load.present && !catalog) {
    problems.push({ field: 'catalog', message: 'pattern catalog not found; pattern conflicts were not validated' });
  }

  const resolution = resolveStudioConfig(load.config, catalog ?? { categories: [], patterns: [] }, problems);
  return { configPath: options.configPath, catalogPath: options.catalogPath, present: load.present, resolution };
}

export { defaultStudioConfig, loadStudioConfig } from './config';
export { renderStudioConfigLines, type StudioConfigView } from './render';
export { resolveStudioConfig } from './resolver';
export {
  emptyStudioGates,
  isGateEnabled,
  optionalPaths,
  selectActiveRoster,
  STUDIO_GATES,
  type StudioGate,
  type StudioGates,
  type StudioModeRoster,
} from './roster';
export { MODEL_TIERS, STUDIO_MODES } from './types';
export type {
  ConfigProblem,
  ModelTier,
  ModelTiers,
  PatternCatalog,
  PatternConflict,
  ResolvedStudioConfig,
  ReviewIntensity,
  StudioConfig,
  StudioMode,
  StudioToggles,
} from './types';
