// Shared helpers for the Verify family.
export * from './types';
export {
  asArray,
  asRecord,
  bool,
  num,
  parseBool,
  str,
  stringArray,
} from '../../../shared/json-helpers';

import { join } from 'node:path';
import { nowIso } from '../../../shared/io';
import { makeEnvelope } from '../../../shared/result-envelope';
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
    ...makeEnvelope({ ability, family: 'verify', mode: 'offline', status, summary, errors, route }),
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

export function issueKey(issue: VerifyIssue): string {
  return `${issue.kind}:${issue.id}`;
}
