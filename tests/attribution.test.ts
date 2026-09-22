import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { classifyLicense } from '../tools/unity/primitives/src/license-gate';
import { parsePrimitiveYaml } from '../tools/unity/primitives/src/contract';

const repoRoot = resolve(import.meta.dir, '..');
const attributionPath = join(repoRoot, 'docs', 'Attribution.md');
const primitivesDir = join(repoRoot, 'xdomains', 'game-dev', 'unity-3d', 'primitives');

const attribution = existsSync(attributionPath) ? readFileSync(attributionPath, 'utf8') : '';

const primitiveIds = readdirSync(primitivesDir)
  .filter((name) => statSync(join(primitivesDir, name)).isDirectory())
  .sort();

const primitiveLicenses = primitiveIds.map((id) => {
  const yamlPath = join(primitivesDir, id, 'primitive.yaml');
  return { id, license: parsePrimitiveYaml(readFileSync(yamlPath, 'utf8')).license };
});

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

// The imported source files (the `.cs` files under each primitive directory).
const importedCodeFiles = primitiveIds.flatMap((id) => walkFiles(join(primitivesDir, id)).filter((file) => file.endsWith('.cs')));

// A per-file notice is a `Derived from …` line (added for files with no upstream
// header) or any retained upstream copyright/license header.
const NOTICE = /Derived from |Copyright|Licensed under|License|SPDX-License-Identifier|Permission is hereby granted/;

function markdownSection(markdown: string, heading: string): string {
  const start = markdown.indexOf(heading);
  if (start === -1) return '';
  const rest = markdown.slice(start + heading.length);
  const next = rest.indexOf('\n## ');
  return next === -1 ? rest : rest.slice(0, next);
}

// Markdown table rows as trimmed cells, dropping the separator row.
function tableRows(section: string): string[][] {
  return section
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith('|'))
    .map((line) =>
      line
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => cell.trim())
    )
    .filter((cells) => !cells.every((cell) => /^-+$/.test(cell) || cell === ''));
}

const LICENSES = ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'Unlicense', 'CC-BY-NC-ND-4.0'];

const importedSection = markdownSection(attribution, '## Imported primitives');
const declaredCount = Number(/\((\d+)\)/.exec(importedSection)?.[1] ?? -1);
const declaredIds = [...importedSection.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].map((match) => match[1]).sort();

describe('attribution file', () => {
  test('exists and is non-empty', () => {
    expect(existsSync(attributionPath)).toBe(true);
    expect(attribution.trim().length).toBeGreaterThan(0);
  });

  test('declared import count and ids equal the primitives on disk', () => {
    expect(primitiveIds.length).toBeGreaterThan(0);
    expect(declaredCount).toBe(primitiveIds.length);
    expect(declaredIds).toEqual(primitiveIds);
  });

  test('every imported code file carries a notice', () => {
    expect(importedCodeFiles.length).toBeGreaterThan(0);
    const missing = importedCodeFiles.filter((file) => !NOTICE.test(readFileSync(file, 'utf8')));
    expect(missing).toEqual([]);
  });

  test('records every imported primitive id (parity with the primitives on disk)', () => {
    expect(primitiveIds.length).toBeGreaterThan(0);
    for (const id of primitiveIds) {
      expect(attribution).toContain(`\`${id}\``);
    }
  });

  test('records every imported primitive license, and none is copyleft', () => {
    for (const { id, license } of primitiveLicenses) {
      expect(license, `${id} must declare a license`).toBeTruthy();
      expect(classifyLicense(license), `${id} must not be copyleft`).not.toBe('copyleft');
      expect(attribution, `${id} license ${license} must appear in Attribution.md`).toContain(license);
    }
  });

  test('carries the required license text/notice for every redistributed license', () => {
    expect(attribution).toContain('Permission is hereby granted, free of charge');
    expect(attribution).toContain('This is free and unencumbered software released into the public domain');
    expect(attribution).toContain('Licensed under the Apache License, Version 2.0');
  });

  test('names the analysed upstream repositories and flags the CC-BY-NC-ND reference', () => {
    for (const repo of [
      'unity-skills',
      'claude-unity-game-studio',
      'UnityCLI.AgenticExtensions',
      'Unity-Open-MCP',
      'AIBridge',
      'unity-coding-skills',
      'MattSkills',
      'Unity-Developer-Tools',
    ]) {
      expect(attribution).toContain(repo);
    }
    expect(attribution).toContain('CC-BY-NC-ND');
  });

  test('every analysed repository lists a holder, license and use (LR1/LR3)', () => {
    const section = markdownSection(attribution, '## External repositories analysed');
    const rows = tableRows(section).filter((cells) => cells[0] !== 'Repository');
    expect(rows.length).toBeGreaterThanOrEqual(8);
    for (const cells of rows) {
      const [repository, holder, license, use] = cells;
      expect(repository.startsWith('['), `${repository} must link to the upstream repo`).toBe(true);
      expect(holder.length, `${repository} is missing a copyright holder`).toBeGreaterThan(0);
      expect(license.length, `${repository} is missing a license`).toBeGreaterThan(0);
      expect(use.length, `${repository} is missing a use note`).toBeGreaterThan(0);
      expect(LICENSES, `${repository} has an unrecognised license "${license}"`).toContain(license);
    }
  });

  test('every imported primitive lists a holder, license and use', () => {
    const section = markdownSection(attribution, '## Imported primitives');
    const rows = tableRows(section).filter((cells) => cells[0] !== 'Primitive id');
    expect(rows.length).toBe(primitiveIds.length);
    for (const cells of rows) {
      const [id, sourceRepo, license, holder, use] = cells;
      expect(sourceRepo.startsWith('https://github.com/'), `${id} is missing a source repo`).toBe(true);
      expect(LICENSES).toContain(license);
      expect(holder.length, `${id} is missing a holder`).toBeGreaterThan(0);
      expect((use ?? '').length, `${id} is missing a use note`).toBeGreaterThan(0);
    }
  });
});
