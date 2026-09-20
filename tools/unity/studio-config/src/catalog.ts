// Pattern-catalog loader (Phase 3 Step 3.4).
//
// Reads `programming-patterns.json` and returns `null` when it is missing or
// malformed, so callers can decide whether to report an unvalidated catalog.
// Candidate-path resolution lives in the shared context-files helper.

import { readJson } from '../../../shared/io';
import type { PatternCatalog } from './types';

export function loadPatternCatalog(path: string): PatternCatalog | null {
  const catalog = readJson<PatternCatalog>(path);
  if (!catalog || typeof catalog !== 'object') return null;
  return catalog;
}
