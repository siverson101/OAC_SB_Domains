// Checkpoint capture + post-mutation snapshot (ADR-0015).
//
// The checkpoint anchors on the Phase 2a `compile-state` producer
// (`Library/ScriptAssemblies/*.dll` mtimes + `Editor.log`) plus the on-disk
// gate/test state. Capturing and reading are fail-soft and read-only; only
// `writeCheckpoint` touches disk, and only under `.opencode/project-data/verify`.
import { join } from 'node:path';
import { dirExists, nowIso, readJson, writeJson } from '../../../shared/io';
import {
  produceCompileState,
  produceLogDigest,
  type CompileState,
  type LogDigest,
  type OfflineInput,
} from '../../gather-unity-context/src/offline';
import { makeSnapshot, type Json } from './shared';
import { collectIssues } from './delta';
import type { VerifyOptions, VerifySnapshot, VerifyTests } from './types';

interface ScanResult {
  assetFolder?: string;
}

function assetFolderFor(options: { projectRoot: string; opencodeDir: string }): string {
  const scan = readJson<ScanResult>(join(options.opencodeDir, 'project-data', 'scan-result.json'));
  return scan?.assetFolder || join(options.projectRoot, 'Assets');
}

export interface SnapshotSources {
  compileState?: CompileState | null;
  logDigest?: LogDigest | null;
  gateState?: Json | null;
  testCounts?: Partial<VerifyTests>;
}

export function buildSnapshot(sources: SnapshotSources): VerifySnapshot {
  const compile = sources.compileState ?? null;
  const logErrors = (sources.logDigest?.logs ?? []).flatMap((log) =>
    log.recentErrors.map((message) => message.text)
  );

  const tests: VerifyTests = {
    editMode: sources.testCounts?.editMode ?? null,
    playMode: sources.testCounts?.playMode ?? null,
  };

  const testFailures = [];
  if (tests.editMode && tests.editMode.failed > 0) {
    testFailures.push({ kind: 'editMode' as const, count: tests.editMode.failed });
  }
  if (tests.playMode && tests.playMode.failed > 0) {
    testFailures.push({ kind: 'playMode' as const, count: tests.playMode.failed });
  }

  return makeSnapshot({
    capturedAt: nowIso(),
    compile: {
      status: compile?.status ?? null,
      stale: compile?.stale ?? null,
      noOpRecompile: compile?.noOpRecompile ?? null,
      assemblyCount: compile?.assemblyCount ?? null,
      newestAssemblyMtimeUtc: compile?.newestAssembly?.mtimeUtc ?? null,
      newestScriptMtimeUtc: compile?.newestScript?.mtimeUtc ?? null,
    },
    issues: collectIssues({ logErrors, testFailures }),
    tests,
    gateResult: typeof sources.gateState?.gateResult === 'string' ? sources.gateState.gateResult : null,
  });
}

export interface CaptureOptions {
  projectRoot: string;
  opencodeDir: string;
  testCounts?: Partial<VerifyTests>;
  // Override the Editor log paths (tests pass [] for a deterministic scan).
  logPaths?: string[];
}

export function captureSnapshot(options: CaptureOptions): VerifySnapshot {
  const assetFolder = assetFolderFor(options);
  const input: OfflineInput = {
    projectRoot: options.projectRoot,
    assetFolder,
    opencodeDir: options.opencodeDir,
  };
  const logPaths = options.logPaths;
  const compileState = logPaths ? produceCompileState(input, logPaths) : produceCompileState(input);
  const logDigest = logPaths ? produceLogDigest(input, logPaths) : produceLogDigest(input);
  const gateState = readJson<Json>(join(options.opencodeDir, 'project-data', 'gate-state.json'));
  return buildSnapshot({ compileState, logDigest, gateState, testCounts: options.testCounts });
}

export function readCheckpoint(options: VerifyOptions): VerifySnapshot | null {
  const stored = readJson<{ snapshot?: VerifySnapshot }>(
    join(options.opencodeDir, 'project-data', 'verify', 'checkpoint.json')
  );
  return stored?.snapshot ?? null;
}

export function writeCheckpoint(options: VerifyOptions, snapshot: VerifySnapshot): string {
  const path = join(options.opencodeDir, 'project-data', 'verify', 'checkpoint.json');
  writeJson(path, {
    schemaVersion: 1,
    generatedAt: nowIso(),
    project: options.projectRoot,
    snapshot,
  });
  return path;
}

export function assetFolderExists(projectRoot: string): boolean {
  return dirExists(join(projectRoot, 'Assets'));
}
