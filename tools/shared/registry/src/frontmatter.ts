import { readFileSync } from 'node:fs';

export type Frontmatter = Record<string, string>;

export function parseFrontmatter(content: string): Frontmatter {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!match) return {};
  const fm: Frontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    fm[m[1]] = value;
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
