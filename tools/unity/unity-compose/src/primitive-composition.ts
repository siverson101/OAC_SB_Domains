// primitive-composition — read `primitive.yaml` composition (Phase 2 Step 2.7).
//
// A primitive declares its composition in `primitive.yaml`: which primitives it
// depends on (`requires.primitives`), the events it wires through
// (`wireThroughEvents`/`events`), and the compatibility graph
// (`compatiblePrimitives` / `conflictsWith`). This ability discovers every
// `primitive.yaml` under a directory, builds the graph, and reports composition
// and conflicts (including dependency cycles and unresolved references).
//
// Offline, read-only and fail-soft: a missing primitives directory is reported,
// not thrown.
import { readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { dirExists, readText, toPosix } from '../../../shared/io';
import { asRecord, makeResult, str, type ComposeBase, type ComposeOptions, type Json } from './shared';
import { parseYaml } from '../../../shared/yaml';

export interface PrimitiveRecord {
  id: string;
  path: string;
  summary: string | null;
  requires: string[];
  events: string[];
  compatiblePrimitives: string[];
  conflictsWith: string[];
}

export type CompositionEdgeKind = 'requires' | 'event' | 'compatible' | 'conflicts';

export interface CompositionEdge {
  from: string;
  to: string;
  kind: CompositionEdgeKind;
}

export interface CompositionConflict {
  a: string;
  b: string;
  reason: string;
}

export interface CompositionReport {
  primitives: PrimitiveRecord[];
  edges: CompositionEdge[];
  conflicts: CompositionConflict[];
  unresolved: string[];
  cycles: string[][];
}

export function emptyReport(): CompositionReport {
  return { primitives: [], edges: [], conflicts: [], unresolved: [], cycles: [] };
}

function asStrings(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value === 'string' && value.trim() !== '') return [value];
  return [];
}

export function toPrimitiveRecord(id: string, path: string, parsed: unknown): PrimitiveRecord {
  const record = asRecord(parsed);
  const requiresBlock = asRecord(record?.requires);
  return {
    id: str(record, 'id') ?? id,
    path,
    summary: str(record, 'summary'),
    requires: asStrings(requiresBlock?.primitives),
    events: asStrings(record?.wireThroughEvents ?? record?.wire_through_events ?? record?.events),
    compatiblePrimitives: asStrings(record?.compatiblePrimitives ?? record?.compatible_primitives),
    conflictsWith: asStrings(record?.conflictsWith ?? record?.conflicts_with),
  };
}

export function discoverPrimitives(dir: string): PrimitiveRecord[] {
  const records: PrimitiveRecord[] = [];
  const walk = (current: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(current, entry);
      let directory = false;
      try {
        directory = statSync(full).isDirectory();
      } catch {
        continue;
      }
      if (directory) {
        walk(full);
        continue;
      }
      if (entry !== 'primitive.yaml' && entry !== 'primitive.yml') continue;
      const text = readText(full);
      if (text === null) continue;
      records.push(toPrimitiveRecord(basename(current), toPosix(full), parseYaml(text)));
    }
  };
  walk(dir);
  records.sort((a, b) => a.id.localeCompare(b.id));
  return records;
}

function findCycles(records: PrimitiveRecord[]): string[][] {
  const known = new Set(records.map((record) => record.id));
  const graph = new Map<string, string[]>();
  for (const record of records) graph.set(record.id, record.requires.filter((dep) => known.has(dep)));

  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack: string[] = [];
  const inStack = new Set<string>();

  const visit = (node: string): void => {
    if (inStack.has(node)) {
      const index = stack.indexOf(node);
      if (index !== -1) cycles.push([...stack.slice(index), node]);
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    inStack.add(node);
    stack.push(node);
    for (const dep of graph.get(node) ?? []) visit(dep);
    stack.pop();
    inStack.delete(node);
  };

  for (const record of records) visit(record.id);
  return cycles;
}

export function analyzeComposition(records: PrimitiveRecord[]): CompositionReport {
  const ids = new Set(records.map((record) => record.id));
  const edges: CompositionEdge[] = [];
  const unresolved: string[] = [];
  const conflicts: CompositionConflict[] = [];
  const seenPairs = new Set<string>();

  for (const record of records) {
    for (const dep of record.requires) {
      edges.push({ from: record.id, to: dep, kind: 'requires' });
      if (!ids.has(dep)) unresolved.push(`${record.id} requires unknown primitive "${dep}"`);
    }
    for (const event of record.events) edges.push({ from: record.id, to: event, kind: 'event' });
    for (const compatible of record.compatiblePrimitives) {
      edges.push({ from: record.id, to: compatible, kind: 'compatible' });
    }
    for (const conflict of record.conflictsWith) {
      edges.push({ from: record.id, to: conflict, kind: 'conflicts' });
      if (!ids.has(conflict)) unresolved.push(`${record.id} conflicts with unknown primitive "${conflict}"`);
      const pair = [record.id, conflict].sort().join('|');
      if (seenPairs.has(pair)) continue;
      seenPairs.add(pair);
      conflicts.push({ a: record.id, b: conflict, reason: 'declared conflictsWith' });
    }
  }

  return { primitives: records, edges, conflicts, unresolved, cycles: findCycles(records) };
}

export interface PrimitiveCompositionResult extends ComposeBase {
  primitivesDir: string;
  report: CompositionReport;
}

export function defaultPrimitivesDir(options: ComposeOptions): string {
  return join(options.projectRoot, 'xdomains', 'game-dev', 'unity-3d', 'primitives');
}

export function runPrimitiveComposition(options: ComposeOptions): PrimitiveCompositionResult {
  const dir = options.primitivesDir ?? defaultPrimitivesDir(options);
  if (!dirExists(dir)) {
    const base = makeResult('primitive-composition', 'unavailable', `no primitives directory at ${toPosix(dir)}`, []);
    return { ...base, primitivesDir: toPosix(dir), report: emptyReport() };
  }

  const records = discoverPrimitives(dir);
  const report = analyzeComposition(records);
  const problems = report.conflicts.length + report.unresolved.length + report.cycles.length;
  const status = problems > 0 ? 'observed_locally' : 'ok';
  const summary =
    records.length === 0
      ? `no primitive.yaml found under ${toPosix(dir)}`
      : `${records.length} primitive(s); ${report.edges.length} edge(s), ${report.conflicts.length} conflict(s), ${report.cycles.length} cycle(s), ${report.unresolved.length} unresolved`;
  const base = makeResult('primitive-composition', status, summary, []);
  return { ...base, primitivesDir: toPosix(dir), report };
}
