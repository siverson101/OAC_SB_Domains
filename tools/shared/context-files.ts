import { join } from 'node:path';
import { fileExists, readJson } from './io';

export const PATTERN_CATALOG_FILENAME = 'programming-patterns.json';

export interface FiletypesFile {
  version?: string;
  filetypes: Record<string, string>;
}

export interface PackageChoiceRow {
  category: string;
  name: string;
  packageNames: string[];
  prompt: string;
  deferToStage4?: boolean;
}

export interface PackageChoicesFile {
  version?: string;
  choices: PackageChoiceRow[];
}

export interface UnderstoodPackage {
  category: string;
  packageName: string;
  prettyName: string;
}

export interface UnderstoodPackagesFile {
  version?: string;
  categoryLegend?: Record<string, string>;
  packages: UnderstoodPackage[];
}

export interface PatternCategory {
  id: string;
  name: string;
  selection: 'single' | 'multiple';
  mutuallyExclusive?: boolean;
  description?: string;
  guidance?: string[];
  patterns: string[];
  deferToStage4?: boolean;
}

export interface Pattern {
  id: string;
  name: string;
  category: string;
  description?: string;
  whenToUse?: string;
  rules?: string[];
  conflictsWith?: string[];
  pairsWellWith?: string[];
  aliases?: string[];
  notes?: string;
}

export interface PatternsFile {
  version?: string;
  categories: PatternCategory[];
  patterns: Pattern[];
}

export interface ContextPaths {
  filetypes: string;
  packageChoices: string;
  understoodPackages: string;
  patterns: string;
}

export function contextPaths(contextDir: string): ContextPaths {
  return {
    filetypes: join(contextDir, 'filetypes.json'),
    packageChoices: join(contextDir, 'unity', 'package-choices.json'),
    understoodPackages: join(contextDir, 'unity', 'understood-package-categories.json'),
    patterns: join(contextDir, PATTERN_CATALOG_FILENAME),
  };
}

// The search locations for the shared `programming-patterns.json` catalog. Each
// caller supplies the roots it knows (the source context dir, a domain dir, an
// installed `.opencode` dir, or the module's own directory) and gets the
// candidate paths back in priority order.
export interface PatternCatalogSearch {
  contextDir?: string;
  domainDir?: string;
  opencodeDir?: string;
  moduleDir?: string;
}

export function patternCatalogCandidates(search: PatternCatalogSearch): string[] {
  const candidates: string[] = [];
  if (search.contextDir) candidates.push(join(search.contextDir, PATTERN_CATALOG_FILENAME));
  if (search.domainDir) {
    candidates.push(join(search.domainDir, '..', '..', 'context', PATTERN_CATALOG_FILENAME));
  }
  if (search.moduleDir) {
    candidates.push(join(search.moduleDir, '..', '..', 'context', PATTERN_CATALOG_FILENAME));
    candidates.push(
      join(search.moduleDir, '..', '..', '..', '..', 'xdomains', 'context', PATTERN_CATALOG_FILENAME)
    );
  }
  if (search.opencodeDir) {
    candidates.push(join(search.opencodeDir, 'xdomains', 'context', PATTERN_CATALOG_FILENAME));
    candidates.push(join(search.opencodeDir, '..', 'xdomains', 'context', PATTERN_CATALOG_FILENAME));
  }
  return candidates;
}

export function findPatternCatalog(search: PatternCatalogSearch): string | null {
  return patternCatalogCandidates(search).find((candidate) => fileExists(candidate)) ?? null;
}

export function loadFiletypes(path: string): FiletypesFile {
  return readJson<FiletypesFile>(path) ?? { filetypes: {} };
}

export function loadPackageChoices(path: string): PackageChoicesFile {
  return readJson<PackageChoicesFile>(path) ?? { choices: [] };
}

export function loadUnderstoodPackages(path: string): UnderstoodPackagesFile {
  return readJson<UnderstoodPackagesFile>(path) ?? { packages: [] };
}

export function loadPatterns(path: string): PatternsFile {
  return readJson<PatternsFile>(path) ?? { categories: [], patterns: [] };
}
