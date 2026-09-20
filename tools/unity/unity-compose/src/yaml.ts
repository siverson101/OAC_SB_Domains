// A tiny YAML subset parser for `primitive.yaml` contracts.
//
// OAC ships with no new dependencies (Phase 2 rule), so this module parses only
// the subset the primitive registry uses: nested mappings, sequences of scalars
// or single-level maps, inline arrays/objects, quoted and plain scalars, and
// `#` comments. It is deliberately small and fail-soft — anything it does not
// understand is returned as a plain string.
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

function parseMapping(lines: YamlLine[], start: number, indent: number): { value: YamlValue; next: number } {
  const obj: { [key: string]: YamlValue } = {};
  let i = start;
  while (i < lines.length && lines[i].indent === indent && !isSequenceLine(lines[i].content)) {
    const line = lines[i];
    const match = /^([^:]+):\s*(.*)$/.exec(line.content);
    if (!match) break;
    const key = unquote(match[1]);
    const rest = match[2];
    if (rest.trim() === '') {
      if (i + 1 < lines.length && lines[i + 1].indent > indent) {
        const child = parseBlock(lines, i + 1, lines[i + 1].indent);
        obj[key] = child.value;
        i = child.next;
      } else {
        obj[key] = null;
        i++;
      }
    } else {
      obj[key] = parseScalar(rest);
      i++;
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
    const match = /^([^:]+):\s*(.*)$/.exec(rest);
    if (match) {
      const obj: { [key: string]: YamlValue } = {};
      const key = unquote(match[1]);
      const value = match[2];
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
        const contMatch = /^([^:]+):\s*(.*)$/.exec(cont.content);
        if (!contMatch) break;
        const contKey = unquote(contMatch[1]);
        const contValue = contMatch[2];
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
    arr.push(parseScalar(rest));
    i++;
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
