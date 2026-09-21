// test-deduplication — detect and (optionally) remove duplicate tests
// (Phase 5 Step 5.4).
//
// A **true duplicate** shares both the same condition and the same assertion
// (canonicalised whitespace/case). Same condition + different assertion, or a
// different condition, is never a duplicate. A **parameterizable group** shares
// the same assertion and conditions that differ only by literal arguments in the
// same equivalence partition; it is proposed as one parameterized merge whose
// body never contains `if`/`switch`. Coverage always wins: when in doubt, both
// tests are kept, and the more accurately named test is kept on removal.
//
// Default is a dry-run (propose only, write nothing). `--apply` removes true
// duplicates from `--tests <dir>` source files and records a
// removals/merges artifact at `.opencode/test-dedup/<feature>.json`.
// Parameterizable merges are recorded as proposals only: rewriting a source
// method into a parameterized one without a C# parser risks dropping coverage.
// Offline and fail-soft; never needs the Editor.
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { dirExists, nowIso, readJson, readText, toPosix, writeJson } from '../../../shared/io';
import { isValidSlug } from '../../../shared/slug';
import { canonicalizeText } from '../../../shared/text';
import { notComputedDelta } from './delta';
import { asRecord, makeResult, str, type VerifyBase, type VerifyOptions } from './shared';
import { VERIFY_MODES } from './types';

export const TEST_DEDUP_DIR = 'test-dedup';
export const TEST_DEDUP_SCHEMA_VERSION = 1;

export interface TestDescriptor {
  name: string;
  condition: string;
  assertion: string;
  file: string | null;
}

export interface Removal {
  name: string;
  keptName: string;
  file: string | null;
  condition: string;
  assertion: string;
  reason: string;
  // True only when this removal was actually applied to a source file. A
  // `--tests-json` descriptor has no source to edit, so its removals stay
  // proposed even under `--apply`.
  applied: boolean;
}

export interface MergeCase {
  name: string;
  arguments: string[];
}

export interface Merge {
  keptName: string;
  removedNames: string[];
  assertion: string;
  cases: MergeCase[];
  body: string;
  reason: string;
}

export interface DedupPlan {
  removals: Removal[];
  merges: Merge[];
}

export interface DedupArtifact {
  schemaVersion: number;
  generatedAt: string;
  feature: string;
  applied: boolean;
  sources: { testsDir: string | null; testsJson: string | null };
  totalTests: number;
  removals: Removal[];
  merges: Merge[];
  summary: string;
}

export interface TestDeduplicationResult extends VerifyBase {
  action: 'propose' | 'apply';
  feature: string | null;
  artifactPath: string;
  written: boolean;
  applied: boolean;
  totalTests: number;
  removals: Removal[];
  merges: Merge[];
  removedFromFiles: string[];
}

// A fresh global regex per call keeps `lastIndex` from leaking between uses.
// A numeric literal is bounded by non-identifier characters so a digit inside an
// identifier (`Vector3`, `p1`) is preserved: blanking it would collapse distinct
// subjects into the same equivalence partition. A leading `-` is left as an
// operator, so `-1` and `-2` blank to `-#`.
function literalPattern(): RegExp {
  return /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|(?<![A-Za-z0-9_])\d+(?:\.\d+)?[fFmMdDlL]?(?![A-Za-z0-9_])|\btrue\b|\bfalse\b|\bnull\b/g;
}

export function conditionTemplate(condition: string): string {
  return canonicalizeText(condition).replace(literalPattern(), '#');
}

export function conditionLiterals(condition: string): string[] {
  return canonicalizeText(condition).match(literalPattern()) ?? [];
}

function substituteLiterals(text: string, params: string[]): string {
  let index = 0;
  return text.replace(literalPattern(), (match) => (index < params.length ? params[index++] : match));
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'test', 'tests', 'var', 'new', 'assert', 'areequal', 'isequal',
  'returns', 'return', 'should', 'when', 'given', 'then', 'that', 'this', 'result', 'value',
  'expected', 'actual', 'true', 'false', 'null',
]);

function tokens(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .map((token) => token.toLowerCase())
    .filter((token) => token.length > 0);
}

function significantTokens(condition: string, assertion: string): Set<string> {
  const out = new Set<string>();
  for (const token of [...tokens(condition), ...tokens(assertion)]) {
    if (token.length >= 3 && !STOPWORDS.has(token)) out.add(token);
  }
  return out;
}

function nameScore(name: string, condition: string, assertion: string): number {
  const significant = significantTokens(condition, assertion);
  return tokens(name).filter((token) => significant.has(token)).length;
}

// Keep the more accurately named test: the name sharing the most tokens with the
// test content wins; ties go to the longer name, then lexicographically.
export function chooseKeeper(group: TestDescriptor[]): TestDescriptor {
  return [...group].sort((a, b) => {
    const scoreA = nameScore(a.name, a.condition, a.assertion);
    const scoreB = nameScore(b.name, b.condition, b.assertion);
    if (scoreA !== scoreB) return scoreB - scoreA;
    if (a.name.length !== b.name.length) return b.name.length - a.name.length;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  })[0];
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const groupKey = key(item);
    const list = map.get(groupKey);
    if (list) list.push(item);
    else map.set(groupKey, [item]);
  }
  return map;
}

function renderParameterizedBody(keeper: TestDescriptor, group: TestDescriptor[]): string {
  const params = conditionLiterals(keeper.condition).map((_, index) => `p${index}`);
  const lines: string[] = [];
  for (const test of group) lines.push(`[TestCase(${conditionLiterals(test.condition).join(', ')})]`);
  lines.push(`public void ${keeper.name}(${params.map((name) => `object ${name}`).join(', ')})`);
  lines.push('{');
  lines.push(`    ${substituteLiterals(keeper.condition.trim(), params)}`);
  lines.push(`    ${keeper.assertion.trim()}`);
  lines.push('}');
  return lines.join('\n');
}

export function planDeduplication(tests: TestDescriptor[]): DedupPlan {
  const removals: Removal[] = [];
  const merges: Merge[] = [];

  for (const assertionGroup of groupBy(tests, (test) => canonicalizeText(test.assertion)).values()) {
    if (assertionGroup.length < 2) continue;

    for (const templateGroup of groupBy(assertionGroup, (test) => conditionTemplate(test.condition)).values()) {
      const representatives: TestDescriptor[] = [];
      for (const exactGroup of groupBy(templateGroup, (test) => canonicalizeText(test.condition)).values()) {
        const keeper = chooseKeeper(exactGroup);
        representatives.push(keeper);
        for (const test of exactGroup) {
          if (test === keeper) continue;
          removals.push({
            name: test.name,
            keptName: keeper.name,
            file: test.file,
            condition: test.condition,
            assertion: test.assertion,
            reason: 'identical condition and identical assertion',
            applied: false,
          });
        }
      }

      if (representatives.length < 2) continue;
      if (conditionLiterals(representatives[0].condition).length === 0) continue;
      const template = conditionTemplate(representatives[0].condition);
      if (/\b(if|switch)\b/.test(template)) continue;

      const keeper = chooseKeeper(representatives);
      merges.push({
        keptName: keeper.name,
        removedNames: representatives.filter((test) => test !== keeper).map((test) => test.name),
        assertion: keeper.assertion,
        cases: representatives.map((test) => ({ name: test.name, arguments: conditionLiterals(test.condition) })),
        body: renderParameterizedBody(keeper, representatives),
        reason: 'same assertion; conditions differ only by literal arguments in the same equivalence partition',
      });
    }
  }

  return { removals, merges };
}

// ---------------------------------------------------------------------------
// C# test scanning (offline; deliberately small so the decision logic stays
// unit-testable without a full C# parser)
// ---------------------------------------------------------------------------

export interface CsTestMethod {
  name: string;
  start: number;
  end: number;
  condition: string;
  assertion: string;
}

const ATTR_HEAD_SOURCE =
  '\\[(?:Test|UnityTest|TestCase|TestCaseSource)\\b[^\\]]*\\](?:\\s*\\[[^\\]]*\\])*\\s*' +
  '(?:(?:public|private|protected|internal|static|async|sealed|override|virtual)\\s+)*' +
  '(?:void|IEnumerator|Task<[^>]+>|Task)\\s+([A-Za-z_]\\w*)\\s*\\([^)]*\\)\\s*\\{';

function skipString(text: string, index: number): number {
  const quote = text[index];
  if (text[index - 1] === '@') {
    for (let i = index + 1; i < text.length; i++) {
      if (text[i] === '"') {
        if (text[i + 1] === '"') {
          i++;
          continue;
        }
        return i;
      }
    }
    return text.length;
  }
  for (let i = index + 1; i < text.length; i++) {
    if (text[i] === '\\') {
      i++;
      continue;
    }
    if (text[i] === quote) return i;
  }
  return text.length;
}

function matchBrace(text: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === "'") {
      i = skipString(text, i);
      continue;
    }
    if (ch === '/' && text[i + 1] === '/') {
      const newline = text.indexOf('\n', i);
      i = newline === -1 ? text.length : newline;
      continue;
    }
    if (ch === '/' && text[i + 1] === '*') {
      const close = text.indexOf('*/', i + 2);
      i = close === -1 ? text.length : close + 1;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return text.length;
}

function splitBody(body: string): { condition: string; assertion: string } {
  const conditionLines: string[] = [];
  const assertionLines: string[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '') continue;
    if (/\bAssert\./.test(line)) assertionLines.push(line);
    else conditionLines.push(line);
  }
  return { condition: conditionLines.join('\n'), assertion: assertionLines.join('\n') };
}

function lineStart(text: string, index: number): number {
  const newline = text.lastIndexOf('\n', index - 1);
  return newline === -1 ? 0 : newline + 1;
}

export function extractTestMethods(text: string): CsTestMethod[] {
  const out: CsTestMethod[] = [];
  const head = new RegExp(ATTR_HEAD_SOURCE, 'g');
  let match: RegExpExecArray | null;
  while ((match = head.exec(text)) !== null) {
    const open = head.lastIndex - 1;
    const close = matchBrace(text, open);
    const { condition, assertion } = splitBody(text.slice(open + 1, close));
    out.push({ name: match[1], start: lineStart(text, match.index), end: close + 1, condition, assertion });
    head.lastIndex = close + 1;
  }
  return out;
}

function walkCsFiles(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let directory = false;
    try {
      directory = statSync(full).isDirectory();
    } catch {
      continue;
    }
    if (directory) walkCsFiles(full, out);
    else if (entry.endsWith('.cs')) out.push(full);
  }
  return out;
}

export function scanCsTests(dir: string): TestDescriptor[] {
  const out: TestDescriptor[] = [];
  for (const file of walkCsFiles(dir).sort()) {
    const text = readText(file);
    if (text === null) continue;
    for (const method of extractTestMethods(text)) {
      out.push({ name: method.name, condition: method.condition, assertion: method.assertion, file: toPosix(file) });
    }
  }
  return out;
}

// Remove only the removals whose recorded file is this file: a bare method name
// is never removed across every file, so a same-named test in another suite is
// untouched.
export function removeTestMethods(text: string, removals: Removal[], file: string): { text: string; removed: string[] } {
  const target = toPosix(file);
  const names = new Set(
    removals.filter((removal) => removal.file !== null && toPosix(removal.file) === target).map((removal) => removal.name)
  );
  const methods = extractTestMethods(text).filter((method) => names.has(method.name));
  const removed: string[] = [];
  let out = text;
  for (const method of [...methods].sort((a, b) => b.start - a.start)) {
    let end = method.end;
    while (end < out.length && (out[end] === '\r' || out[end] === '\n')) end++;
    out = out.slice(0, method.start) + out.slice(end);
    removed.push(method.name);
  }
  return { text: out, removed };
}

// ---------------------------------------------------------------------------
// input parsing
// ---------------------------------------------------------------------------

export function parseDescriptors(value: unknown): { descriptors: TestDescriptor[]; errors: string[] } {
  const raw = Array.isArray(value) ? value : asRecord(value)?.tests;
  const list = Array.isArray(raw) ? raw : [];
  const descriptors: TestDescriptor[] = [];
  const errors: string[] = [];
  for (const item of list) {
    const record = asRecord(item);
    const name = str(record, 'name');
    const condition = str(record, 'condition');
    const assertion = str(record, 'assertion');
    if (!record || !name || condition === null || assertion === null) {
      errors.push(`ignored malformed test descriptor: ${JSON.stringify(item)}`);
      continue;
    }
    descriptors.push({ name, condition, assertion, file: str(record, 'file') });
  }
  return { descriptors, errors };
}

export function dedupDir(options: VerifyOptions): string {
  return join(options.opencodeDir, TEST_DEDUP_DIR);
}

export function dedupArtifactPath(options: VerifyOptions, slug: string): string {
  return join(dedupDir(options), `${slug}.json`);
}

export function runTestDeduplication(options: VerifyOptions): TestDeduplicationResult {
  const slug = (options.feature ?? '').trim();
  const apply = options.apply === true;
  const artifactPath = slug ? toPosix(dedupArtifactPath(options, slug)) : toPosix(dedupDir(options));

  const refuse = (message: string): TestDeduplicationResult => {
    const base = makeResult(options.ability, 'refused', message, [message], 'offline');
    base.mode = VERIFY_MODES[options.ability];
    base.delta = notComputedDelta('test-deduplication refused; no dedup plan computed');
    return {
      ...base,
      action: apply ? 'apply' : 'propose',
      feature: slug || null,
      artifactPath,
      written: false,
      applied: false,
      totalTests: 0,
      removals: [],
      merges: [],
      removedFromFiles: [],
    };
  };

  if (!slug) return refuse('a --feature <slug> is required');
  if (!isValidSlug(slug)) return refuse(`invalid feature slug "${slug}"; use kebab-case (a-z, 0-9, -)`);

  const testsDir = (options.testsDir ?? '').trim() || null;
  const testsJson = (options.testsJson ?? '').trim() || null;
  if (!testsDir && !testsJson) return refuse('one of --tests <dir> or --tests-json <file> is required');

  const descriptors: TestDescriptor[] = [];
  const errors: string[] = [];
  let source: DedupArtifact['sources'] = { testsDir: null, testsJson: null };

  if (testsJson) {
    const jsonPath = resolve(options.projectRoot, testsJson);
    const json = readJson<unknown>(jsonPath);
    if (json === null) return refuse(`test descriptor JSON not found: ${testsJson}`);
    const parsed = parseDescriptors(json);
    descriptors.push(...parsed.descriptors);
    errors.push(...parsed.errors);
    source = { ...source, testsJson: toPosix(jsonPath) };
  }

  if (testsDir) {
    const dirPath = resolve(options.projectRoot, testsDir);
    if (!dirExists(dirPath)) return refuse(`tests directory not found: ${testsDir}`);
    descriptors.push(...scanCsTests(dirPath));
    source = { ...source, testsDir: toPosix(dirPath) };
  }

  const plan = planDeduplication(descriptors);
  const clean = plan.removals.length === 0 && plan.merges.length === 0;

  const removedFromFiles: string[] = [];
  const appliedKeys = new Set<string>();
  if (apply && !clean && testsDir) {
    for (const file of walkCsFiles(resolve(options.projectRoot, testsDir))) {
      const text = readText(file);
      if (text === null) continue;
      const result = removeTestMethods(text, plan.removals, file);
      if (result.removed.length > 0) {
        writeFileSync(file, result.text);
        removedFromFiles.push(toPosix(file));
        for (const name of result.removed) appliedKeys.add(`${toPosix(file)}::${name}`);
      }
    }
  }

  const removals: Removal[] = plan.removals.map((removal) => ({
    ...removal,
    applied: removal.file !== null && appliedKeys.has(`${toPosix(removal.file)}::${removal.name}`),
  }));
  const appliedCount = removals.filter((removal) => removal.applied).length;
  const proposedCount = removals.length - appliedCount;

  const mergePart = `${plan.merges.length} parameterizable group(s) proposed for merge`;
  const summary = clean
    ? 'no duplicates found'
    : appliedCount > 0
      ? `${appliedCount} duplicate(s) removed${
          proposedCount > 0 ? `, ${proposedCount} proposed (not applied)` : ''
        }, ${mergePart}`
      : `${removals.length} duplicate(s) proposed, ${mergePart}`;

  // Record the artifact in dry-run too: proposals are the output of a dry-run.
  // Only `--apply` ever edits test files, and only source-file removals are
  // marked applied.
  const shouldWriteArtifact = apply || !clean;
  if (shouldWriteArtifact) {
    const artifact: DedupArtifact = {
      schemaVersion: TEST_DEDUP_SCHEMA_VERSION,
      generatedAt: nowIso(),
      feature: slug,
      applied: appliedCount > 0,
      sources: source,
      totalTests: descriptors.length,
      removals,
      merges: plan.merges,
      summary,
    };
    writeJson(dedupArtifactPath(options, slug), artifact);
  }

  const base = makeResult(options.ability, clean ? 'passed' : 'observed_locally', summary, errors, 'offline', false, {
    mutates: appliedCount > 0,
    dryRunFirst: true,
    writesState: true,
  });
  base.mode = VERIFY_MODES[options.ability];
  base.delta = notComputedDelta('test-deduplication reads test descriptors; no mutation delta computed');
  return {
    ...base,
    action: apply ? 'apply' : 'propose',
    feature: slug,
    artifactPath,
    written: shouldWriteArtifact,
    applied: appliedCount > 0,
    totalTests: descriptors.length,
    removals,
    merges: plan.merges,
    removedFromFiles,
  };
}
