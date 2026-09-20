// Pattern-catalog loader (Phase 3 Step 3.4).
//
// Reads `programming-patterns.json` and returns `null` when it is missing or
// malformed, so callers can decide whether to report an unvalidated catalog.

import { join } from 'node:path';
import { readJson } from '../../../shared/io';
import type { PatternCatalog } from './types';

export function loadPatternCatalog(path: string): PatternCatalog | null {
  const catalog = readJson<PatternCatalog>(path);
  if (!catalog || typeof catalog !== 'object') return null;
  return catalog;
}

// Candidate locations for the catalog relative to a domain dir and an
// `.opencode` dir. The first existing path wins; callers may pass their own.
export function patternCatalogCandidates(domainDir: string, opencodeDir?: string): string[] {
  const candidates = [join(domainDir, '..', '..', 'context', 'programming-patterns.json')];
  if (opencodeDir) candidates.push(join(opencodeDir, 'xdomains', 'context', 'programming-patterns.json'));
  return candidates;
}
