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

describe('attribution file', () => {
  test('exists and is non-empty', () => {
    expect(existsSync(attributionPath)).toBe(true);
    expect(attribution.trim().length).toBeGreaterThan(0);
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

  test('carries the required license texts', () => {
    expect(attribution).toContain('Permission is hereby granted, free of charge');
    expect(attribution).toContain('This is free and unencumbered software released into the public domain');
  });

  test('names the analysed upstream repositories and flags the CC-BY-NC-ND reference', () => {
    for (const repo of [
      'unity-skills',
      'claude-unity-game-studio',
      'UnityCLI.AgenticExtensions',
      'Unity-Open-MCP',
      'AIBridge',
      'unity-coding-skills',
      'Unity-Developer-Tools',
    ]) {
      expect(attribution).toContain(repo);
    }
    expect(attribution).toContain('CC-BY-NC-ND');
  });
});
