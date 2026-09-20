// Pure checkpoint -> validate -> delta logic (ADR-0015).
//
// This module is deliberately Editor-free and side-effect-free so the honesty
// rules can be unit-tested without a Unity install:
//   - a delta is only `computed` when there is a checkpoint AND a post-mutation
//     scan that actually observed the compiler's output;
//   - otherwise `newIssues`/`resolvedIssues` are `null`, which means "not
//     computed", never "clean";
//   - `validateScanFailed` and `compilePending` are reported explicitly.
//
// Flag precedence (mutually exclusive): `validateScanFailed` is evaluated
// FIRST — a failed/unavailable scan, a missing post-mutation snapshot, or an
// unavailable compile state yields `validateScanFailed: true` and
// `compilePending: false`. Only when the scan observed the compiler do we ask
// `compilePending`. So a missing `Library` (compile unavailable) is reported as
// a failed scan, not a pending compile. When either flag is true the delta is
// not computed and `newIssues`/`resolvedIssues` are `null`, meaning "not
// computed" (never "clean").
import type {
  IssueKind,
  VerifyCompile,
  VerifyDelta,
  VerifyIssue,
  VerifySnapshot,
} from './types';
import { issueKey, makeSnapshot } from './shared';

export interface DeltaScan {
  ok: boolean;
  errors?: string[];
}

const MAX_ISSUES = 50;

function normalizeMessage(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function pushIssue(issues: VerifyIssue[], seen: Set<string>, issue: VerifyIssue): void {
  if (issues.length >= MAX_ISSUES) return;
  const key = issueKey(issue);
  if (seen.has(key)) return;
  seen.add(key);
  issues.push(issue);
}

export interface IssueSources {
  compile?: VerifyCompile | null;
  logErrors?: string[];
  testFailures?: { kind: IssueKind; count: number; message?: string }[];
}

// Collect a bounded, stable set of issues from the offline artefacts. Compile
// errors come from the Editor log digest; test failures come from the test
// counts of the mode that was run.
export function collectIssues(sources: IssueSources): VerifyIssue[] {
  const issues: VerifyIssue[] = [];
  const seen = new Set<string>();

  for (const raw of sources.logErrors ?? []) {
    const message = normalizeMessage(raw);
    if (message === '') continue;
    pushIssue(issues, seen, { kind: 'compile', id: message, message });
  }

  for (const failure of sources.testFailures ?? []) {
    if (failure.count <= 0) continue;
    pushIssue(issues, seen, {
      kind: failure.kind,
      id: 'failing-tests',
      message: failure.message ?? `${failure.count} failing test(s)`,
    });
  }

  return issues;
}

function isCompileUnavailable(compile: Partial<VerifyCompile> | null | undefined): boolean {
  if (!compile) return true;
  return compile.status === 'unavailable';
}

// `compilePending` is true when the compiler may not have produced fresh
// assemblies: the Library is empty, a script is newer than the newest assembly,
// or the Editor log records a silent no-op recompile.
export function compilePending(compile: Partial<VerifyCompile> | null | undefined): boolean {
  if (!compile || compile.status === 'unavailable') return false;
  if (compile.stale === true) return true;
  if (compile.noOpRecompile === true) return true;
  if (compile.assemblyCount === 0) return true;
  return false;
}

export function computeDelta(
  before: VerifySnapshot | null,
  after: VerifySnapshot | null,
  scan: DeltaScan = { ok: true }
): VerifyDelta {
  const reasons: string[] = [];
  const validateScanFailed = !scan.ok || after === null || isCompileUnavailable(after?.compile);
  const pending = !validateScanFailed && compilePending(after?.compile);

  if (before === null) reasons.push('no checkpoint captured; delta not computed');
  if (after === null) reasons.push('no post-mutation scan; delta not computed');
  if (!scan.ok) reasons.push(...(scan.errors ?? []), 'validate scan failed; delta not computed');
  if (after !== null && isCompileUnavailable(after.compile)) {
    reasons.push('compile state unavailable; validate scan could not observe the compiler');
  }
  if (pending) {
    reasons.push('compile pending: assemblies may be stale or the compiler no-op’d; delta not computed');
  }

  const computed = before !== null && after !== null && !validateScanFailed && !pending;
  if (!computed) {
    return {
      computed: false,
      newIssues: null,
      resolvedIssues: null,
      validateScanFailed,
      compilePending: pending,
      reasons,
    };
  }

  const beforeKeys = new Set(before.issues.map(issueKey));
  const afterKeys = new Set(after.issues.map(issueKey));
  return {
    computed: true,
    newIssues: after.issues.filter((issue) => !beforeKeys.has(issueKey(issue))),
    resolvedIssues: before.issues.filter((issue) => !afterKeys.has(issueKey(issue))),
    validateScanFailed: false,
    compilePending: false,
    reasons: [],
  };
}

// A delta that was never computed. Useful for checkpoint-only phases.
export function notComputedDelta(reason: string): VerifyDelta {
  return {
    computed: false,
    newIssues: null,
    resolvedIssues: null,
    validateScanFailed: false,
    compilePending: false,
    reasons: [reason],
  };
}

// Convenience re-export so callers can build fixtures without importing shared.
export { makeSnapshot };
