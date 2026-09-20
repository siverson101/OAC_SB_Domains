// A deliberately tiny SUBSET parser for `primitive.yaml` contracts only.
//
// This is NOT a general YAML parser and must not be used as one. OAC ships with
// no new dependencies (Phase 2 rule), so this module parses only the subset the
// primitive registry uses: nested mappings, sequences of scalars or single-level
// maps, inline arrays/objects, quoted and plain scalars, and `#` comments. It is
// fail-soft — anything it does not understand is returned as a plain string.
//
// Known sharp edges (unsupported by design):
//   - comments are only recognised at the start of a line or when `#` is
//     preceded by whitespace; `a#b` is kept as the literal `a#b`;
//   - no hex/octal numeric literals; only decimal integers and `-?\d+\.\d+`
//     floats are coerced, and `~` is only recognised as the bare null token;
//   - keys containing `:` inside quotes are unsupported (the key/value split is
//     the first `:` on the line).
export type YamlValue = string | number | boolean | null | YamlValue[] | { [key: string]: YamlValue };

interface YamlLine {
  indent: number;
  content: string;
}

function stripComment(raw: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (ch === '#' && !inSingle && !inDouble) {
      if (i === 0 || /\s/.test(raw[i - 1])) return raw.slice(0, i);
    }
  }
  return raw;
}

function unquote(text: string): string {
  const trimmed = text.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function splitTopLevel(input: string, delimiter: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  let inSingle = false;
  let inDouble = false;
  for (const ch of input) {
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
    if (ch === '[' || ch === '{') depth++;
    if (ch === ']' || ch === '}') depth--;
    if (ch === delimiter && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts;
}

function parseInlineArray(raw: string): YamlValue[] {
  const inner = raw.slice(1, -1).trim();
  if (inner === '') return [];
  return splitTopLevel(inner, ',')
    .map((item) => parseScalar(item))
    .filter((value) => !(typeof value === 'string' && value.trim() === ''));
}

function parseInlineObject(raw: string): { [key: string]: YamlValue } {
  const inner = raw.slice(1, -1).trim();
  const obj: { [key: string]: YamlValue } = {};
  if (inner === '') return obj;
  for (const part of splitTopLevel(inner, ',')) {
    const idx = part.indexOf(':');
    if (idx === -1) continue;
    const key = unquote(part.slice(0, idx));
    obj[key] = parseScalar(part.slice(idx + 1));
  }
  return obj;
}

export function parseScalar(raw: string): YamlValue {
  const text = unquote(stripComment(raw));
  if (text === '') return '';
  if (text === 'null' || text === '~') return null;
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (/^-?\d+$/.test(text)) return Number(text);
  if (/^-?\d+\.\d+$/.test(text)) return Number(text);
  if (text.startsWith('[') && text.endsWith(']')) return parseInlineArray(text);
  if (text.startsWith('{') && text.endsWith('}')) return parseInlineObject(text);
  return text;
}

function isSequenceLine(content: string): boolean {
  return content === '-' || content.startsWith('- ');
}

// A more-indented line that is neither a sequence item nor a mapping entry is a
// folded continuation of the preceding plain scalar (YAML plain-scalar folding).
function isContinuationLine(line: YamlLine | undefined, indent: number): boolean {
  return Boolean(
    line &&
      line.indent > indent &&
      !isSequenceLine(line.content) &&
      !/^[A-Za-z_][A-Za-z0-9_.-]*:(\s|$)/.test(line.content)
  );
}

function foldContinuations(lines: YamlLine[], start: number, indent: number, value: YamlValue): { value: YamlValue; next: number } {
  if (typeof value !== 'string') return { value, next: start };
  let folded = value;
  let i = start;
  while (isContinuationLine(lines[i], indent)) {
    folded = `${folded} ${lines[i].content}`;
    i++;
  }
  return { value: folded, next: i };
}

function parseMapping(lines: YamlLine[], start: number, indent: number): { value: YamlValue; next: number } {
  const obj: { [key: string]: YamlValue } = {};
  let i = start;
  while (i < lines.length) {
    if (lines[i].indent < indent) break;
    // Skip nested lines the block could not interpret (e.g. a quoted key) so
    // scanning can continue at the next sibling key.
    if (lines[i].indent > indent) {
      i++;
      continue;
    }
    // A sequence at this indent ends the mapping; the caller owns it.
    if (isSequenceLine(lines[i].content)) break;
    const match = /^([A-Za-z_][A-Za-z0-9_.-]*):(?:\s+(.*)|)$/.exec(lines[i].content);
    if (!match) {
      i++;
      continue;
    }
    const key = unquote(match[1]);
    const rest = match[2] ?? '';
    if (rest.trim() === '') {
      const next = lines[i + 1];
      // A nested block, or a block sequence at the same indentation as its key.
      if (next && (next.indent > indent || (next.indent === indent && isSequenceLine(next.content)))) {
        const child = parseBlock(lines, i + 1, next.indent);
        obj[key] = child.value;
        i = child.next;
      } else {
        obj[key] = null;
        i++;
      }
    } else {
      const folded = foldContinuations(lines, i + 1, indent, parseScalar(rest));
      obj[key] = folded.value;
      i = folded.next;
    }
  }
  return { value: obj, next: i };
}

function parseSequence(lines: YamlLine[], start: number, indent: number): { value: YamlValue; next: number } {
  const arr: YamlValue[] = [];
  let i = start;
  while (i < lines.length && lines[i].indent === indent && isSequenceLine(lines[i].content)) {
    const line = lines[i];
    const rest = line.content === '-' ? '' : line.content.slice(2);
    if (rest.trim() === '') {
      if (i + 1 < lines.length && lines[i + 1].indent > indent) {
        const child = parseBlock(lines, i + 1, lines[i + 1].indent);
        arr.push(child.value);
        i = child.next;
      } else {
        arr.push(null);
        i++;
      }
      continue;
    }
    // A sequence item is a mapping only when it starts with a simple `key:`
    // (`- key: value`); prose containing a colon (`- see 0:05`) stays a scalar.
    const match = /^([A-Za-z_][A-Za-z0-9_.-]*):(?:\s+(.*)|)$/.exec(rest);
    if (match) {
      const obj: { [key: string]: YamlValue } = {};
      const key = unquote(match[1]);
      const value = match[2] ?? '';
      if (value.trim() === '') {
        if (i + 1 < lines.length && lines[i + 1].indent > indent) {
          const child = parseBlock(lines, i + 1, lines[i + 1].indent);
          obj[key] = child.value;
          i = child.next;
        } else {
          obj[key] = null;
          i++;
        }
      } else {
        obj[key] = parseScalar(value);
        i++;
      }
      while (i < lines.length && lines[i].indent > indent && !isSequenceLine(lines[i].content)) {
        const cont = lines[i];
        const contMatch = /^([A-Za-z_][A-Za-z0-9_.-]*):(?:\s+(.*)|)$/.exec(cont.content);
        if (!contMatch) break;
        const contKey = unquote(contMatch[1]);
        const contValue = contMatch[2] ?? '';
        if (contValue.trim() === '') {
          if (i + 1 < lines.length && lines[i + 1].indent > cont.indent) {
            const child = parseBlock(lines, i + 1, lines[i + 1].indent);
            obj[contKey] = child.value;
            i = child.next;
          } else {
            obj[contKey] = null;
            i++;
          }
        } else {
          obj[contKey] = parseScalar(contValue);
          i++;
        }
      }
      arr.push(obj);
      continue;
    }
    // A scalar sequence item keeps only its first line; any more-indented
    // continuation is consumed (not folded) so later keys still parse.
    const value = parseScalar(rest);
    let j = i + 1;
    while (j < lines.length && lines[j].indent > indent && !isSequenceLine(lines[j].content)) j++;
    arr.push(value);
    i = j;
  }
  return { value: arr, next: i };
}

function parseBlock(lines: YamlLine[], start: number, indent: number): { value: YamlValue; next: number } {
  if (start >= lines.length) return { value: null, next: start };
  if (isSequenceLine(lines[start].content)) return parseSequence(lines, start, indent);
  return parseMapping(lines, start, indent);
}

export function parseYaml(text: string): YamlValue {
  const lines: YamlLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const content = stripComment(raw).trim();
    if (content === '' || content === '---') continue;
    lines.push({ indent: raw.length - raw.trimStart().length, content });
  }
  if (lines.length === 0) return null;
  return parseBlock(lines, 0, lines[0].indent).value;
}
