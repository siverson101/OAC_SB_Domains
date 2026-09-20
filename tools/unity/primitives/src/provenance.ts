// Reader for the source registry's `PROVENANCE.md` attribution table
// (Phase 3 Step 3.3).
//
// PROVENANCE.md holds the id → source_repo → SPDX license mapping for the
// extracted primitives. Only the clean three-column attributed table is parsed;
// the "license problem" / "unattributed" tables have prose columns and are
// intentionally ignored by the row regex.
import { classifyLicense } from './license-gate';

export interface ProvenanceEntry {
  id: string;
  sourceRepo: string;
  license: string;
}

const ATTRIBUTED_ROW = /^\|\s*([a-z][a-z0-9._-]+)\s*\|\s*(https?:\/\/\S+?)\s*\|\s*([A-Za-z0-9.+-]+)\s*\|\s*$/;

export function parseProvenanceTable(markdown: string): ProvenanceEntry[] {
  const entries: ProvenanceEntry[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const match = ATTRIBUTED_ROW.exec(line);
    if (!match) continue;
    entries.push({ id: match[1], sourceRepo: match[2], license: match[3] });
  }
  return entries;
}

export function licenseById(markdown: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of parseProvenanceTable(markdown)) out[entry.id] = entry.license;
  return out;
}

export function copyleftIds(markdown: string): string[] {
  return parseProvenanceTable(markdown)
    .filter((entry) => classifyLicense(entry.license) === 'copyleft')
    .map((entry) => entry.id)
    .sort();
}
