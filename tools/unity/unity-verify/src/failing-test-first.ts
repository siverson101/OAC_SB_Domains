// failing-test-first — enforce the red step (Phase 5 Step 5.3).
//
// Before implementation, the named test must FAIL and the failure message must
// contain the expected reason. A test that passes (the behaviour already
// exists) or fails for an unrelated reason (a compile error, a different
// assertion) does not evidence the red step, so it is `STATUS: NG` and aborts.
//
// Gated by `toggles.tdd` in `.opencode/unity-studio.json` (fail-soft: an absent
// config means off). With TDD off the ability refuses clearly — TDD off still
// requires tests, just not written first. Offline and read-only: the observed
// failure comes from `--failure-message` and/or a `--test-results` XML path.
import { join, resolve } from 'node:path';
import { readText } from '../../../shared/io';
import { loadStudioConfig } from '../../studio-config/src/config';
import { notComputedDelta } from './delta';
import { makeResult } from './shared';
import { VERIFY_MODES, type VerifyBase, type VerifyOptions } from './types';

export const TEST_RESULTS = ['Passed', 'Failed', 'Skipped', 'Inconclusive'] as const;
export type TestCaseResult = (typeof TEST_RESULTS)[number] | 'Unknown';

export interface TestCaseOutcome {
  name: string;
  result: TestCaseResult;
  message: string | null;
}

export type RedStepVerdict = 'OK' | 'NG';

export type RedStepReason =
  | 'expected-failure'
  | 'unexpected-pass'
  | 'unrelated-failure'
  | 'test-not-run'
  | 'test-not-found';

export interface RedStepObservation {
  // `null` when only a `--failure-message` was supplied: the caller asserts the
  // test failed but the pass/fail outcome was not read from a results file.
  result: TestCaseResult | null;
  message: string | null;
}

export interface RedStepDecision {
  verdict: RedStepVerdict;
  reason: RedStepReason;
  detail: string;
}

export interface FailingTestFirstResult extends VerifyBase {
  redStep: RedStepVerdict | null;
  test: string | null;
  expectedReason: string | null;
  observedResult: TestCaseResult | null;
  observedMessage: string | null;
  reason: RedStepReason | null;
  tddEnabled: boolean;
}

function decodeXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function attribute(attrs: string, name: string): string | null {
  const match = new RegExp(`\\b${name}="([^"]*)"`).exec(attrs);
  return match ? decodeXml(match[1]) : null;
}

function normalizeResult(value: string | null): TestCaseResult {
  const lower = (value ?? '').toLowerCase();
  if (lower === 'passed') return 'Passed';
  if (lower === 'failed' || lower === 'error') return 'Failed';
  if (lower === 'skipped' || lower === 'ignored') return 'Skipped';
  if (lower === 'inconclusive') return 'Inconclusive';
  return 'Unknown';
}

function firstMessage(body: string): string | null {
  const match = /<message>([\s\S]*?)<\/message>/.exec(body);
  if (!match) return null;
  const text = decodeXml(match[1]).trim();
  return text === '' ? null : text;
}

// Parse the `<test-case>` elements of an NUnit3 TestResults.xml. Only the name,
// result and failure message are read; the parser is deliberately small so the
// red-step decision can be unit-tested without a Unity install.
export function parseTestCases(xml: string): TestCaseOutcome[] {
  const out: TestCaseOutcome[] = [];
  const tag = /<test-case\b([^>]*?)(\/?)>/g;
  let match: RegExpExecArray | null;
  while ((match = tag.exec(xml)) !== null) {
    const name = attribute(match[1], 'name') ?? '';
    const result = normalizeResult(attribute(match[1], 'result'));
    let message: string | null = null;
    if (match[2] !== '/') {
      const close = xml.indexOf('</test-case>', tag.lastIndex);
      if (close !== -1) {
        message = firstMessage(xml.slice(tag.lastIndex, close));
        tag.lastIndex = close + '</test-case>'.length;
      }
    }
    out.push({ name, result, message });
  }
  return out;
}

export function findTestCase(cases: TestCaseOutcome[], name: string): TestCaseOutcome | null {
  return cases.find((testCase) => testCase.name === name) ?? null;
}

function containsReason(message: string | null, expectedReason: string): boolean {
  return (message ?? '').toLowerCase().includes(expectedReason.toLowerCase());
}

export interface RedStepInput {
  test: string;
  expectedReason: string;
  observation: RedStepObservation;
}

// The pure decision. `OK` only when the named test failed and the failure
// message contains the expected reason; every other outcome is `NG`, naming
// whether the test passed unexpectedly, failed for a different reason, or did
// not fail at all.
export function decideRedStep(input: RedStepInput): RedStepDecision {
  const { test, expectedReason, observation } = input;

  if (observation.result === null) {
    return containsReason(observation.message, expectedReason)
      ? {
          verdict: 'OK',
          reason: 'expected-failure',
          detail: `"${test}" failed for the expected reason ("${expectedReason}")`,
        }
      : {
          verdict: 'NG',
          reason: 'unrelated-failure',
          detail: `"${test}" failed for a different reason than expected ("${expectedReason}"); abort`,
        };
  }

  if (observation.result === 'Passed') {
    return {
      verdict: 'NG',
      reason: 'unexpected-pass',
      detail: `"${test}" passed unexpectedly; the red step requires a failing test — abort`,
    };
  }

  if (observation.result === 'Failed') {
    return containsReason(observation.message, expectedReason)
      ? {
          verdict: 'OK',
          reason: 'expected-failure',
          detail: `"${test}" failed for the expected reason ("${expectedReason}")`,
        }
      : {
          verdict: 'NG',
          reason: 'unrelated-failure',
          detail: `"${test}" failed for a different reason than expected ("${expectedReason}"); abort`,
        };
  }

  return {
    verdict: 'NG',
    reason: 'test-not-run',
    detail: `"${test}" did not fail (result: ${observation.result}); the red step requires a failing test — abort`,
  };
}

export function loadTddToggle(options: { opencodeDir: string }): boolean {
  const load = loadStudioConfig(join(options.opencodeDir, 'unity-studio.json'));
  return load.config.toggles.tdd === true;
}

export interface ResolvedTdd {
  enabled: boolean;
  error: string | null;
}

// An explicit `--tdd on|off` overrides the config; an unknown value is a bad
// input and refuses loudly rather than falling back silently.
export function resolveTdd(options: Pick<VerifyOptions, 'opencodeDir' | 'tdd'>): ResolvedTdd {
  const raw = (options.tdd ?? '').trim().toLowerCase();
  if (raw === '') return { enabled: loadTddToggle(options), error: null };
  if (raw === 'on') return { enabled: true, error: null };
  if (raw === 'off') return { enabled: false, error: null };
  return { enabled: false, error: `invalid --tdd "${options.tdd}"; expected on|off` };
}

export function runFailingTestFirst(options: VerifyOptions): FailingTestFirstResult {
  const test = (options.test ?? '').trim() || null;
  const expectedReason = (options.expectedReason ?? '').trim() || null;
  const failureMessage = (options.failureMessage ?? '').trim() || null;
  const resultsPath = (options.testResults ?? '').trim() || null;
  const tdd = resolveTdd(options);

  const refuse = (message: string): FailingTestFirstResult => {
    const base = makeResult(options.ability, 'refused', message, [message], 'offline');
    base.mode = VERIFY_MODES[options.ability];
    base.delta = notComputedDelta('failing-test-first refused; no red-step verdict computed');
    return {
      ...base,
      redStep: null,
      test,
      expectedReason,
      observedResult: null,
      observedMessage: null,
      reason: null,
      tddEnabled: tdd.enabled,
    };
  };

  if (tdd.error) return refuse(tdd.error);
  if (!tdd.enabled) {
    return refuse(
      'TDD is off (.opencode/unity-studio.json toggles.tdd=false); failing-test-first is TDD-gated. Enable the toggle to enforce the red step — TDD off still requires tests, just not first.'
    );
  }
  if (!test) return refuse('a --test <full name> is required');
  if (!expectedReason) return refuse('an --expected-reason <substring> is required');

  let observation: RedStepObservation;
  if (resultsPath) {
    const xml = readText(resolve(options.projectRoot, resultsPath));
    if (xml === null) return refuse(`test results not found: ${resultsPath}`);
    const testCase = findTestCase(parseTestCases(xml), test);
    if (!testCase) {
      const decision: RedStepDecision = {
        verdict: 'NG',
        reason: 'test-not-found',
        detail: `"${test}" was not found in ${resultsPath}; the red step requires the named test to run and fail — abort`,
      };
      return finalize(options, test, expectedReason, tdd.enabled, { result: null, message: null }, decision);
    }
    observation = { result: testCase.result, message: testCase.message ?? failureMessage };
  } else if (failureMessage) {
    observation = { result: null, message: failureMessage };
  } else {
    return refuse('an observed failure is required (--failure-message and/or --test-results)');
  }

  const decision = decideRedStep({ test, expectedReason, observation });
  return finalize(options, test, expectedReason, tdd.enabled, observation, decision);
}

function finalize(
  options: VerifyOptions,
  test: string,
  expectedReason: string,
  tddEnabled: boolean,
  observation: RedStepObservation,
  decision: RedStepDecision
): FailingTestFirstResult {
  const ok = decision.verdict === 'OK';
  const summary = `STATUS: ${decision.verdict} — ${decision.detail}`;
  const base = makeResult(options.ability, ok ? 'passed' : 'failed', summary, ok ? [] : [decision.detail], 'offline');
  base.mode = VERIFY_MODES[options.ability];
  base.delta = notComputedDelta('failing-test-first reads test results; no mutation delta computed');
  return {
    ...base,
    redStep: decision.verdict,
    test,
    expectedReason,
    observedResult: observation.result,
    observedMessage: observation.message,
    reason: decision.reason,
    tddEnabled,
  };
}
