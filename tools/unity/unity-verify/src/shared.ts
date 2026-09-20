// Shared helpers for the Verify family.
export * from './types';

import { join } from 'node:path';
import { nowIso } from '../../../shared/io';
import type { Route } from '../../../shared/tool-routing';
import type {
  SnapshotOverrides,
  VerifyAbility,
  VerifyBase,
  VerifyCompile,
  VerifyIssue,
  VerifyOptions,
  VerifySnapshot,
  VerifyStatus,
  Json,
} from './types';

export function projectDataDir(options: VerifyOptions): string {
  return join(options.opencodeDir, 'project-data');
}

export function verifyDataDir(options: VerifyOptions): string {
  return join(projectDataDir(options), 'verify');
}

export function checkpointPath(options: VerifyOptions): string {
  return join(verifyDataDir(options), 'checkpoint.json');
}

export function makeResult(
  ability: VerifyAbility,
  status: VerifyStatus,
  summary: string,
  errors: string[],
  route: Route,
  requiresEditor = false
): VerifyBase {
  return {
    schemaVersion: 1,
    generatedAt: nowIso(),
    ability,
    family: 'verify',
    mode: 'offline',
    route,
    status,
    summary,
    errors,
    safetyGate: { mutates: false, requiresEditor },
    checkpoint: null,
    delta: {
      computed: false,
      newIssues: null,
      resolvedIssues: null,
      validateScanFailed: false,
      compilePending: false,
      reasons: ['no delta computed'],
    },
  };
}

const DEFAULT_COMPILE: VerifyCompile = {
  status: 'observed_locally',
  stale: false,
  noOpRecompile: null,
  assemblyCount: 1,
  newestAssemblyMtimeUtc: null,
  newestScriptMtimeUtc: null,
};

export function makeSnapshot(overrides: SnapshotOverrides = {}): VerifySnapshot {
  return {
    capturedAt: overrides.capturedAt ?? nowIso(),
    compile: { ...DEFAULT_COMPILE, ...(overrides.compile ?? {}) },
    issues: overrides.issues ?? [],
    tests: { editMode: null, playMode: null, ...(overrides.tests ?? {}) },
    gateResult: overrides.gateResult ?? null,
  };
}

export function asRecord(value: unknown): Json | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : null;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function str(obj: Json | null, key: string): string | null {
  const value = obj?.[key];
  return typeof value === 'string' ? value : null;
}

export function num(obj: Json | null, key: string): number | null {
  const value = obj?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function bool(obj: Json | null, key: string): boolean | null {
  const value = obj?.[key];
  return typeof value === 'boolean' ? value : null;
}

export function issueKey(issue: VerifyIssue): string {
  return `${issue.kind}:${issue.id}`;
}
