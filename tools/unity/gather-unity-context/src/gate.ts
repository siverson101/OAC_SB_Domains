import { join } from 'node:path';
import { readText } from '../../../shared/io';
import { run } from '../../../shared/toolchain';
import type { EditorInstance } from './editor';
import { runCli } from './producers';
import { writeScratchJson } from './scratch';
import type { GatherOptions } from './types';

export interface TestCounts {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  inconclusive: number;
  result: string;
}

export interface TestRun {
  mode: string;
  source: 'live-editor' | 'batch-editor';
  status: string;
  exitCode: number | null;
  counts: TestCounts;
  artifact?: string;
}

export interface GateResult {
  status: string;
  editMode: TestRun | null;
  playMode: TestRun | null;
  instance: string | null;
}

const EMPTY_COUNTS: TestCounts = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  inconclusive: 0,
  result: 'Unknown',
};

export function parseNUnit(xml: string): TestCounts {
  const match = /<test-run\b[^>]*>/.exec(xml);
  if (!match) return { ...EMPTY_COUNTS };
  const attr = (name: string): number => {
    const m = new RegExp(`${name}="(\\d+)"`).exec(match[0]);
    return m ? Number(m[1]) : 0;
  };
  const resultMatch = /result="([^"]+)"/.exec(match[0]);
  return {
    total: attr('total'),
    passed: attr('passed'),
    failed: attr('failed'),
    skipped: attr('skipped'),
    inconclusive: attr('inconclusive'),
    result: resultMatch ? resultMatch[1] : 'Unknown',
  };
}

interface LiveSummary {
  Total?: number;
  Passed?: number;
  Failed?: number;
  Skipped?: number;
  Inconclusive?: number;
}

// The minimal option surface a single test run needs. GatherOptions is a
// superset, so callers can pass the full options object; the Verify family
// passes only these fields.
export interface TestRunOptions {
  projectRoot: string;
  scratchDir: string;
  cliCommand: string;
}

function runLiveTest(options: TestRunOptions, mode: 'editor' | 'playmode'): TestRun {
  const env = runCli(
    options.cliCommand,
    [
      'command',
      'run_tests',
      '--mode',
      mode,
      '--json',
      '--no-banner',
      '--quiet',
      '--non-interactive',
      '--project-path',
      options.projectRoot,
      '--timeout',
      '600',
    ],
    900000
  );
  const artifact = writeScratchJson(options.scratchDir, `run-tests-${mode}.json`, env);
  const summary = (env.data as { result?: { Summary?: LiveSummary } } | null)?.result?.Summary;
  const counts: TestCounts = summary
    ? {
        total: summary.Total ?? 0,
        passed: summary.Passed ?? 0,
        failed: summary.Failed ?? 0,
        skipped: summary.Skipped ?? 0,
        inconclusive: summary.Inconclusive ?? 0,
        result: (summary.Failed ?? 0) > 0 ? 'Failed' : 'Passed',
      }
    : { ...EMPTY_COUNTS };
  return {
    mode,
    source: 'live-editor',
    status: env.success && counts.failed === 0 ? 'passed' : 'failed',
    exitCode: null,
    counts,
    artifact,
  };
}

function runBatchTest(options: TestRunOptions, mode: 'EditMode' | 'PlayMode'): TestRun {
  const output = join(options.scratchDir, `${mode.toLowerCase()}-results.xml`);
  const res = run(
    options.cliCommand,
    ['test', options.projectRoot, '--mode', mode, '--output', output, '--no-banner', '--quiet', '--non-interactive'],
    { timeout: 900000 }
  );
  const counts = parseNUnit(readText(output) ?? '');
  return {
    mode,
    source: 'batch-editor',
    status: res.ok && counts.failed === 0 ? 'passed' : 'failed',
    exitCode: res.status,
    counts,
    artifact: output,
  };
}

// Run a single mode. With a live instance the run goes through the Unity CLI's
// live channel; without one it falls back to a batch Editor run.
export function runTestMode(
  options: TestRunOptions,
  mode: 'editor' | 'playmode',
  instance: EditorInstance | null
): TestRun {
  if (instance) return runLiveTest(options, mode);
  return runBatchTest(options, mode === 'editor' ? 'EditMode' : 'PlayMode');
}

// The caller owns the Editor lifecycle (see editor.ts): it ensures an instance
// exists before calling this and stops it afterwards if it started one.
export function runGate(options: GatherOptions, instance: EditorInstance | null): GateResult {
  if (!options.runGate) {
    return { status: 'not_run', editMode: null, playMode: null, instance: null };
  }

  const editMode = runTestMode(options, 'editor', instance);
  const playMode = runTestMode(options, 'playmode', instance);
  const failed = [editMode, playMode].some((r) => r.status === 'failed');
  return {
    status: failed ? 'failed' : 'passed',
    editMode,
    playMode,
    instance: instance ? instance.project ?? options.projectRoot : null,
  };
}
