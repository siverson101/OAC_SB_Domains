// JSON-table loaders for the offline Sense abilities.
//
// `unity-api-lookup` and `platform-info` are backed by shipped tables under
// `xdomains/context/unity/`. Resolution tries the bundle layout
// (`xdomains/scripts/unity/` -> `xdomains/context/unity/`) first, then the
// source layout (`tools/unity/unity-sense/src/` -> repo root). Missing tables
// are reported, never thrown.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, toPosix } from '../../../shared/io';

export interface ApiEntry {
  symbol: string;
  kind: string;
  namespace?: string;
  summary: string;
  replacement?: string;
  since?: string;
  docUrl?: string;
}

export interface ApiQuickrefTable {
  schemaVersion?: number;
  description?: string;
  entries?: ApiEntry[];
}

export interface PlatformEntry {
  name: string;
  displayName?: string;
  buildTarget: string;
  defines: string[];
  scriptingBackend?: string;
  notes?: string;
}

export interface VersionDefineEntry {
  define: string;
  since?: string;
  summary?: string;
}

export interface PlatformDefinesTable {
  schemaVersion?: number;
  description?: string;
  platforms?: PlatformEntry[];
  versionDefines?: VersionDefineEntry[];
}

export interface TableLoad<T> {
  data: T | null;
  path: string | null;
  source: 'bundle' | 'missing';
}

function moduleDir(): string {
  return dirname(fileURLToPath(import.meta.url));
}

export function contextTableCandidates(file: string): string[] {
  const here = moduleDir();
  return [
    join(here, '..', '..', 'context', 'unity', file),
    join(here, '..', '..', '..', '..', 'xdomains', 'context', 'unity', file),
  ];
}

export function loadContextTable<T>(file: string, overridePath?: string): TableLoad<T> {
  const candidates = overridePath ? [overridePath] : contextTableCandidates(file);
  for (const path of candidates) {
    const data = readJson<T>(path);
    if (data) return { data, path: toPosix(path), source: 'bundle' };
  }
  return { data: null, path: null, source: 'missing' };
}

export function loadApiQuickref(overridePath?: string): TableLoad<ApiQuickrefTable> {
  return loadContextTable<ApiQuickrefTable>('unity-api-quickref.json', overridePath);
}

export function loadPlatformDefines(overridePath?: string): TableLoad<PlatformDefinesTable> {
  return loadContextTable<PlatformDefinesTable>('platform-defines.json', overridePath);
}
