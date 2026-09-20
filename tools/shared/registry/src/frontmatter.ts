import { readFileSync } from 'node:fs';

export type FrontmatterValue =
  | string
  | number
  | boolean
  | null
  | FrontmatterValue[]
  | { [key: string]: FrontmatterValue };

export type Frontmatter = Record<string, FrontmatterValue>;

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

// Numeric/scalar coercion follows `JSON.parse` semantics, so this parser accepts
// forms such as `1e3` and `-0` that the narrower `primitive.yaml` subset parser
// (tools/shared/yaml.ts) rejects. The divergence is intentional, not a bug.
function tryParseJson(input: string): unknown | undefined {
  try {
    return JSON.parse(input);
  } catch {
    return undefined;
  }
}

function normalizeQuotes(input: string): string {
  let out = '';
  let inDouble = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') {
      inDouble = !inDouble;
      out += ch;
      continue;
    }
    if (ch === "'" && !inDouble) {
      let j = i + 1;
      let inner = '';
      while (j < input.length && input[j] !== "'") {
        inner += input[j];
        j++;
      }
      out += '"' + inner.replace(/"/g, '\\"') + '"';
      i = j;
      continue;
    }
    out += ch;
  }
  return out;
}

const JSON_LITERALS = new Set(['true', 'false', 'null']);

function quoteBareWords(input: string): string {
  return input
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_-]*)(\s*:)/g, '$1"$2"$3')
    .replace(/(:\s*)([A-Za-z_][A-Za-z0-9_-]*)(?=\s*[,}\]])/g, (match: string, prefix: string, word: string) =>
      JSON_LITERALS.has(word) ? match : `${prefix}"${word}"`,
    );
}

function splitTopLevel(input: string, delimiter: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inSingle) {
      current += ch;
      if (ch === "'") inSingle = false;
      continue;
    }
    if (inDouble) {
      current += ch;
      if (ch === '"') inDouble = false;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      current += ch;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      current += ch;
      continue;
    }
    if (ch === '[' || ch === '{' || ch === '(') depth++;
    if (ch === ']' || ch === '}' || ch === ')') depth--;
    if (ch === delimiter && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim() !== '') parts.push(current);
  return parts;
}

function parseFlowArray(raw: string): FrontmatterValue[] {
  const inner = raw.slice(1, -1).trim();
  if (inner === '') return [];
  const json = tryParseJson(normalizeQuotes(raw));
  if (Array.isArray(json)) return json as FrontmatterValue[];
  return splitTopLevel(inner, ',').map((item) => parseInlineValue(item.trim()));
}

function parseFlowObject(raw: string): FrontmatterValue {
  const normalized = normalizeQuotes(raw);
  const direct = tryParseJson(normalized);
  if (direct !== undefined && direct !== null && typeof direct === 'object' && !Array.isArray(direct)) {
    return direct as { [key: string]: FrontmatterValue };
  }
  const lenient = tryParseJson(quoteBareWords(normalized));
  if (lenient !== undefined && lenient !== null && typeof lenient === 'object' && !Array.isArray(lenient)) {
    return lenient as { [key: string]: FrontmatterValue };
  }
  return raw;
}

function parseInlineValue(rest: string): FrontmatterValue {
  const trimmed = rest.trim();
  if (trimmed.startsWith('[')) return parseFlowArray(trimmed);
  if (trimmed.startsWith('{')) return parseFlowObject(trimmed);
  const scalar = tryParseJson(trimmed);
  if (scalar !== undefined && (typeof scalar !== 'object' || scalar === null)) {
    return scalar as FrontmatterValue;
  }
  return stripQuotes(trimmed);
}

function readBlock(lines: string[], start: number): { value: FrontmatterValue; nextIndex: number } {
  const collected: string[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') j++;
      if (j < lines.length && /^\s/.test(lines[j])) {
        i++;
        continue;
      }
      break;
    }
    if (!/^\s/.test(line)) break;
    collected.push(line);
    i++;
  }

  // Comment lines are ignored when deciding the block kind and when building
  // the object/array. Block sequences and objects must be indented relative to
  // their key: a `- item` or `k: v` at the key's own column is not part of the
  // block. Limitation: blocks are shallow — no nested blocks, and a block that
  // is neither a sequence nor a flat mapping falls back to its raw string lines
  // (flow syntax inside a single line still parses).
  const trimmed = collected
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
  if (trimmed.length > 0 && trimmed.every((line) => line.startsWith('-'))) {
    return { value: trimmed.map((line) => parseInlineValue(line.replace(/^-\s*/, ''))), nextIndex: i };
  }
  if (trimmed.length > 0 && trimmed.every((line) => /^[A-Za-z0-9_-]+:\s/.test(line) && !line.startsWith('-'))) {
    const obj: { [key: string]: FrontmatterValue } = {};
    for (const line of trimmed) {
      const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
      if (!m) continue;
      obj[m[1]] = m[2] === '' ? '' : parseInlineValue(m[2]);
    }
    return { value: obj, nextIndex: i };
  }
  return { value: trimmed, nextIndex: i };
}

export function parseFrontmatter(content: string): Frontmatter {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!match) return {};
  const fm: Frontmatter = {};
  const lines = match[1].split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      i++;
      continue;
    }
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!m) {
      i++;
      continue;
    }
    const key = m[1];
    const rest = m[2];
    if (rest !== '') {
      fm[key] = parseInlineValue(rest);
      i++;
      continue;
    }
    const block = readBlock(lines, i + 1);
    fm[key] = block.value;
    i = block.nextIndex;
  }
  return fm;
}

export function readFrontmatter(path: string): Frontmatter {
  try {
    return parseFrontmatter(readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
}

export function frontmatterString(fm: Frontmatter, key: string): string | undefined {
  const value = fm[key];
  return typeof value === 'string' ? value : undefined;
}

// An absent key or a non-array value yields `undefined`. A mixed array keeps
// its string entries and drops the rest, so `[unity-read-project, 3]` returns
// `['unity-read-project']` rather than silently discarding the valid ids.
export function frontmatterStringArray(fm: Frontmatter, key: string): string[] | undefined {
  const value = fm[key];
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === 'string');
}
