// pattern-library — read the shipped programming-pattern catalog.
//
// Reads `xdomains/context/programming-patterns.json` (categories, patterns,
// per-pattern `conflictsWith`) and, given an enabled set, surfaces cross-pattern
// conflicts instead of silently choosing. Read-only and offline.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { patternCatalogCandidates } from '../../../shared/context-files';
import { readJson, toPosix } from '../../../shared/io';
import { asArray, asRecord, makeResult, str, stringArray, type ActOptions } from './shared';
import type { ActBase, Json } from './types';

export interface PatternSummary {
  id: string;
  name: string;
  category: string;
  description: string;
  whenToUse: string;
  aliases: string[];
  conflictsWith: string[];
  pairsWellWith: string[];
}

export interface CategorySummary {
  id: string;
  name: string;
  selection: string;
  mutuallyExclusive: boolean;
  description: string;
  patterns: string[];
  guidance: string[];
}

export interface ConflictReport {
  pattern: string;
  conflictsWith: string;
  reason: string;
}

export interface PatternLibraryResult extends ActBase {
  table: { source: 'bundle' | 'missing'; path: string | null; categoryCount: number; patternCount: number };
  query: string | null;
  categoryFilter: string | null;
  patternFilter: string | null;
  enabled: string[];
  categories: CategorySummary[];
  matches: PatternSummary[];
  selected: PatternSummary | null;
  conflicts: ConflictReport[];
}

function moduleDir(): string {
  return dirname(fileURLToPath(import.meta.url));
}

export function patternTableCandidates(): string[] {
  return patternCatalogCandidates({ moduleDir: moduleDir() });
}

export function loadPatternTable(overridePath?: string): { data: Json | null; path: string | null; source: 'bundle' | 'missing' } {
  const candidates = overridePath ? [overridePath] : patternTableCandidates();
  for (const path of candidates) {
    const data = asRecord(readJson<unknown>(path));
    if (data) return { data, path: toPosix(path), source: 'bundle' };
  }
  return { data: null, path: null, source: 'missing' };
}

function toPatternSummary(entry: Json): PatternSummary {
  return {
    id: str(entry, 'id') ?? '',
    name: str(entry, 'name') ?? '',
    category: str(entry, 'category') ?? '',
    description: str(entry, 'description') ?? '',
    whenToUse: str(entry, 'whenToUse') ?? '',
    aliases: stringArray(entry, 'aliases'),
    conflictsWith: stringArray(entry, 'conflictsWith'),
    pairsWellWith: stringArray(entry, 'pairsWellWith'),
  };
}

function toCategorySummary(entry: Json): CategorySummary {
  return {
    id: str(entry, 'id') ?? '',
    name: str(entry, 'name') ?? '',
    selection: str(entry, 'selection') ?? 'multiple',
    mutuallyExclusive: entry.mutuallyExclusive === true,
    description: str(entry, 'description') ?? '',
    patterns: stringArray(entry, 'patterns'),
    guidance: stringArray(entry, 'guidance'),
  };
}

function matchesQuery(pattern: PatternSummary, query: string): boolean {
  const needle = query.toLowerCase();
  return (
    pattern.id.toLowerCase().includes(needle) ||
    pattern.name.toLowerCase().includes(needle) ||
    pattern.description.toLowerCase().includes(needle) ||
    pattern.whenToUse.toLowerCase().includes(needle) ||
    pattern.aliases.some((alias) => alias.toLowerCase().includes(needle))
  );
}

export function patternLibrary(options: ActOptions): PatternLibraryResult {
  const load = loadPatternTable(options.patternsFile);
  const table = load.data;
  const categoryEntries = asArray(table?.categories).map(asRecord).filter((entry): entry is Json => entry !== null);
  const patternEntries = asArray(table?.patterns).map(asRecord).filter((entry): entry is Json => entry !== null);

  const categories = categoryEntries.map(toCategorySummary);
  const allPatterns = patternEntries.map(toPatternSummary);

  const query = options.query?.trim() || null;
  const categoryFilter = options.category?.trim() || null;
  const patternFilter = options.pattern?.trim() || null;
  const enabled = (options.enabled ?? []).map((item) => item.trim()).filter(Boolean);

  let matches = allPatterns;
  if (categoryFilter) matches = matches.filter((pattern) => pattern.category === categoryFilter);
  if (query) matches = matches.filter((pattern) => matchesQuery(pattern, query));

  const selected = patternFilter ? allPatterns.find((pattern) => pattern.id === patternFilter) ?? null : null;

  const enabledSet = new Set(enabled);
  const conflicts: ConflictReport[] = [];
  for (const pattern of allPatterns) {
    if (!enabledSet.has(pattern.id)) continue;
    for (const other of pattern.conflictsWith) {
      if (enabledSet.has(other) && pattern.id < other) {
        conflicts.push({
          pattern: pattern.id,
          conflictsWith: other,
          reason: `${pattern.id} conflicts with ${other}; resolve before generating code`,
        });
      }
    }
  }

  const found = !query || matches.length > 0;
  const status =
    load.source === 'missing'
      ? 'unavailable'
      : patternFilter && !selected
        ? 'unknown'
        : query && !found
          ? 'unknown'
          : 'observed_locally';

  const result: PatternLibraryResult = {
    ...makeResult('pattern-library', status, 'Programming-pattern catalog lookup', [], 'offline'),
    table: {
      source: load.source,
      path: load.path,
      categoryCount: categories.length,
      patternCount: allPatterns.length,
    },
    query,
    categoryFilter,
    patternFilter,
    enabled,
    categories,
    matches,
    selected,
    conflicts,
  };

  if (load.source === 'missing') result.errors.push('programming-patterns.json not found');
  result.summary = query
    ? `${matches.length} pattern(s) matching "${query}"`
    : `${allPatterns.length} pattern(s) across ${categories.length} categor(ies)`;
  if (conflicts.length > 0) result.summary += ` · ${conflicts.length} conflict(s)`;
  return result;
}
