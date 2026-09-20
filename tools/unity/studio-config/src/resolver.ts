// Pattern resolver (Phase 3 Step 3.4, FR6).
//
// Given the parsed studio config and the pattern catalog, validate the enabled
// set against:
//   - `selection: 'single'` categories (at most one pattern),
//   - `mutuallyExclusive` categories (patterns cannot be combined),
//   - per-pattern `conflictsWith` edges (across the enabled set).
//
// Every violation is returned in `conflicts`; the enabled set is never pruned to
// pick a winner. The effective config is the deduplicated input.

import type {
  CatalogPattern,
  ConfigProblem,
  PatternCatalog,
  PatternConflict,
  ResolvedStudioConfig,
  StudioConfig,
} from './types';

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function resolveStudioConfig(
  config: StudioConfig,
  catalog: PatternCatalog,
  extraProblems: ConfigProblem[] = []
): ResolvedStudioConfig {
  const problems: ConfigProblem[] = [...extraProblems];
  const conflicts: PatternConflict[] = [];

  const patterns = uniqueStrings(config.patterns);
  const packages = uniqueStrings(config.packages);
  const enabled = new Set(patterns);

  const patternById = new Map<string, CatalogPattern>(
    (catalog.patterns ?? []).map((pattern): [string, CatalogPattern] => [pattern.id, pattern])
  );
  const categoryById = new Map((catalog.categories ?? []).map((category) => [category.id, category]));

  for (const id of patterns) {
    if (!patternById.has(id)) problems.push({ field: 'patterns', message: `unknown pattern id '${id}'` });
  }

  // Group enabled patterns by category, using the category's own membership list
  // and the pattern's declared category (so a pattern missing from its
  // category's list is still checked).
  const byCategory: Record<string, string[]> = {};
  for (const category of catalog.categories ?? []) {
    const members = uniqueStrings((category.patterns ?? []).filter((id) => enabled.has(id)));
    for (const id of patterns) {
      if (patternById.get(id)?.category === category.id && !members.includes(id)) members.push(id);
    }
    if (members.length === 0) continue;
    byCategory[category.id] = members;

    if (members.length > 1) {
      if (category.selection === 'single') {
        conflicts.push({
          kind: 'single-selection',
          category: category.id,
          patterns: members,
          message: `category '${category.id}' allows a single pattern but ${members.length} are enabled: ${members.join(', ')}`,
        });
      }
      if (category.mutuallyExclusive) {
        conflicts.push({
          kind: 'mutually-exclusive',
          category: category.id,
          patterns: members,
          message: `category '${category.id}' is mutually exclusive but combines: ${members.join(', ')}`,
        });
      }
    }
  }

  for (const id of patterns) {
    const category = patternById.get(id)?.category;
    if (category && !categoryById.has(category)) {
      problems.push({ field: 'patterns', message: `pattern '${id}' references unknown category '${category}'` });
    }
  }

  // `conflictsWith` edges, deduplicated across the symmetric declarations in the
  // catalog (e.g. tdd→bdd and bdd→tdd yield one conflict).
  const seenPairs = new Set<string>();
  for (const id of patterns) {
    for (const other of patternById.get(id)?.conflictsWith ?? []) {
      if (!enabled.has(other)) continue;
      const pair = [id, other].sort();
      const key = pair.join('\u0000');
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      conflicts.push({
        kind: 'conflictsWith',
        patterns: pair,
        message: `patterns '${pair[0]}' and '${pair[1]}' conflict`,
      });
    }
  }

  const effective: StudioConfig = { ...config, patterns, packages };

  return {
    config: effective,
    enabledPatterns: patterns,
    enabledPackages: packages,
    byCategory,
    conflicts,
    problems,
    valid: conflicts.length === 0 && problems.length === 0,
  };
}
