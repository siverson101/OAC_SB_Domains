import { join } from 'node:path';
import { readJson } from './io';

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
    patterns: join(contextDir, 'programming-patterns.json'),
  };
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
