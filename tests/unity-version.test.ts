import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  checkVersionCompatibility,
  dispatchKeyFor,
  featureFlagsFor,
  parseUnityVersion,
  type UnityDispatchKey,
  type VersionMatrix,
} from '../tools/shared/unity-version';
import { versionMatrix } from '../tools/unity/unity-sense/src/abilities';
import type { SenseOptions } from '../tools/unity/unity-sense/src/types';

const repoRoot = resolve(import.meta.dir, '..');
const matrixPath = join(repoRoot, 'xdomains', 'context', 'unity', 'version-matrix.json');
const manifestPath = join(repoRoot, 'xdomains', 'game-dev', 'unity-3d', 'context', 'unity-3d', 'knowledge', 'manifest.json');
const domainPath = join(repoRoot, 'xdomains', 'game-dev', 'unity-3d', 'sb-domain.json');

const matrix = JSON.parse(readFileSync(matrixPath, 'utf8')) as VersionMatrix;

describe('parseUnityVersion', () => {
  test('parses a well-formed editor version', () => {
    const parsed = parseUnityVersion('6000.5.7f1');
    expect(parsed.valid).toBe(true);
    expect(parsed.raw).toBe('6000.5.7f1');
    expect(parsed.major).toBe(6000);
    expect(parsed.minor).toBe(5);
    expect(parsed.patch).toBe(7);
    expect(parsed.stream).toBe('f1');
    expect(parsed.dispatchKey).toBe('6.5');
  });

  test('accepts a version without a stream suffix', () => {
    const parsed = parseUnityVersion('6000.3.12');
    expect(parsed.valid).toBe(true);
    expect(parsed.stream).toBeNull();
    expect(parsed.dispatchKey).toBe('6.3');
  });

  test('fails soft on an absent version', () => {
    const parsed = parseUnityVersion(null);
    expect(parsed.valid).toBe(false);
    expect(parsed.raw).toBeNull();
    expect(parsed.dispatchKey).toBeNull();
    expect(parsed.reason).toContain('no Unity editor version');
  });

  test('fails soft on a malformed version', () => {
    const parsed = parseUnityVersion('not-a-version');
    expect(parsed.valid).toBe(false);
    expect(parsed.major).toBeNull();
    expect(parsed.dispatchKey).toBeNull();
    expect(parsed.reason).toContain('malformed');
  });

  test('parses an older editor line but leaves it unmapped', () => {
    const parsed = parseUnityVersion('2022.3.10f1');
    expect(parsed.valid).toBe(true);
    expect(parsed.dispatchKey).toBeNull();
    expect(parsed.reason).toContain('older than');
  });
});

describe('dispatchKeyFor', () => {
  const cases: [number, number, UnityDispatchKey | null][] = [
    [6000, 0, '6.0'],
    [6000, 3, '6.3'],
    [6000, 5, '6.5'],
    [6000, 6, 'LTS+'],
    [7000, 0, 'LTS+'],
    [6000, 2, null],
    [2022, 3, null],
    [0, 0, null],
  ];
  for (const [major, minor, expected] of cases) {
    test(`${major}.${minor} -> ${expected ?? 'unknown'}`, () => {
      expect(dispatchKeyFor(major, minor)).toBe(expected);
    });
  }
});

describe('version matrix', () => {
  test('declares every supported version', () => {
    expect(matrix.versions).toEqual(['6.0', '6.3', '6.5', 'LTS+']);
    expect(matrix.primaryVersion).toBe('6.3');
    expect(matrix.newerDispatchKey).toBe('LTS+');
    expect(matrix.verifyNote?.toLowerCase()).toContain('verify');
  });

  test('every version exposes a boolean flag for every feature', () => {
    for (const version of matrix.versions) {
      const flags = featureFlagsFor(matrix, version);
      expect(flags.length, version).toBe(matrix.features.length);
      for (const flag of flags) expect(typeof flag.enabled).toBe('boolean');
    }
  });

  test('every feature flag map covers exactly the supported versions', () => {
    for (const feature of matrix.features) {
      expect(Object.keys(feature.versions).sort(), feature.id).toEqual(matrix.versions.slice().sort());
    }
  });

  test('agrees with the knowledge manifest and the domain compatibility range', () => {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      unityVersions: string[];
      dispatch: { overlays: Record<string, string> };
    };
    expect(manifest.unityVersions).toEqual(matrix.versions);
    const overlayKeys = Object.keys(manifest.dispatch.overlays).sort();
    const dispatchKeys = [...Object.values(matrix.dispatch ?? {}), matrix.newerDispatchKey ?? ''].sort();
    expect(dispatchKeys).toEqual(overlayKeys);
    expect(matrix.newerDispatchKey).toBe('LTS+');

    const domain = JSON.parse(readFileSync(domainPath, 'utf8')) as {
      compatibility: { unity_versions: string[] };
    };
    expect(domain.compatibility.unity_versions).toEqual(matrix.versions);
  });

  test('flags the version-gated seams per version', () => {
    const flags = (version: string): Record<string, boolean> =>
      Object.fromEntries(featureFlagsFor(matrix, version).map((flag) => [flag.id, flag.enabled]));
    const v60 = flags('6.0');
    const v63 = flags('6.3');
    const v65 = flags('6.5');
    const lts = flags('LTS+');

    expect(v60['urp-default-pipeline']).toBe(true);
    expect(v63['built-in-render-pipeline']).toBe(true);
    expect(v65['built-in-render-pipeline']).toBe(false);
    expect(lts['built-in-render-pipeline']).toBe(false);
    expect(v60['ui-toolkit-default-runtime-ui']).toBe(false);
    expect(v63['ui-toolkit-default-runtime-ui']).toBe(true);
    expect(v60['lighting-auto-generate']).toBe(false);
    expect(v60['dx12-default-graphics-api']).toBe(false);
    expect(v63['dx12-default-graphics-api']).toBe(true);
    expect(v63['rigidbody-set-density']).toBe(true);
    expect(v60['hdrp-maintenance-mode']).toBe(false);
    expect(v63['hdrp-maintenance-mode']).toBe(true);
  });

  test('records the deprecation/removal metadata for the gated seams', () => {
    const feature = (id: string) => matrix.features.find((entry) => entry.id === id);
    expect(feature('built-in-render-pipeline')?.deprecatedSince).toBe('6.5');
    expect(feature('lighting-auto-generate')?.removedSince).toBe('6.0');
    expect(feature('rigidbody-set-density')?.deprecatedSince).toBe('6.1');
    expect(feature('cluster-light-loop-keyword')?.deprecatedSince).toBe('6.1');
  });

  test('a missing or unmapped key yields no flags', () => {
    expect(featureFlagsFor(matrix, null)).toEqual([]);
    expect(featureFlagsFor(matrix, 'nope')).toEqual([]);
    expect(featureFlagsFor(null, '6.5')).toEqual([]);
  });
});

describe('checkVersionCompatibility', () => {
  test('compatible when the detected key is declared', () => {
    const result = checkVersionCompatibility({ unity: ['6.0', '6.3', '6.5', 'LTS+'] }, '6.5');
    expect(result.status).toBe('compatible');
    expect(result.detectedKey).toBe('6.5');
  });

  test('accepts a raw editor version for the detected side', () => {
    expect(checkVersionCompatibility(['6.5'], '6000.5.7f1').status).toBe('compatible');
  });

  test('incompatible when the declared range excludes the detected key', () => {
    const result = checkVersionCompatibility(['6.0', '6.3'], '6.5');
    expect(result.status).toBe('incompatible');
    expect(result.reason).toContain('6.5');
  });

  test('unknown when nothing is declared', () => {
    expect(checkVersionCompatibility([], '6.5').status).toBe('unknown');
    expect(checkVersionCompatibility(undefined, '6.5').status).toBe('unknown');
    expect(checkVersionCompatibility({}, '6.5').status).toBe('unknown');
  });

  test('unknown when no version is detected', () => {
    expect(checkVersionCompatibility(['6.5'], null).status).toBe('unknown');
    expect(checkVersionCompatibility(['6.5'], 'not-a-version').status).toBe('unknown');
  });

  test('treats a newer LTS+ as unknown, not incompatible', () => {
    expect(checkVersionCompatibility(['6.0', '6.3', '6.5'], 'LTS+').status).toBe('unknown');
  });
});

describe('version-matrix ability', () => {
  let fixture: string;
  let options: SenseOptions;

  beforeAll(() => {
    fixture = mkdtempSync(join(tmpdir(), 'oac-version-matrix-'));
    const projectRoot = join(fixture, 'project');
    const opencodeDir = join(projectRoot, '.opencode');
    mkdirSync(join(projectRoot, 'ProjectSettings'), { recursive: true });
    writeFileSync(
      join(projectRoot, 'ProjectSettings', 'ProjectVersion.txt'),
      'm_EditorVersion: 6000.5.7f1\n'
    );

    const commandDir = join(fixture, 'command');
    mkdirSync(commandDir, { recursive: true });
    writeFileSync(
      join(commandDir, 'compatible.md'),
      ['---', 'id: compatible', 'versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }', '---', ''].join('\n')
    );
    writeFileSync(
      join(commandDir, 'incompatible.md'),
      ['---', 'id: incompatible', 'versionCompatibility: { unity: ["6.0", "6.3"] }', '---', ''].join('\n')
    );
    writeFileSync(join(commandDir, 'nodecl.md'), ['---', 'id: nodecl', '---', ''].join('\n'));

    options = {
      projectRoot,
      opencodeDir,
      ability: 'version-matrix',
      json: true,
      list: false,
      commandDir,
      tableDir: matrixPath,
    };
  });

  afterAll(() => {
    try {
      rmSync(fixture, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  test('reports the detected version, dispatch key and feature flags', () => {
    const result = versionMatrix(options);
    expect(result.family).toBe('sense');
    expect(result.mode).toBe('offline');
    expect(result.status).toBe('observed_locally');
    expect(result.detected.raw).toBe('6000.5.7f1');
    expect(result.detected.dispatchKey).toBe('6.5');
    expect(result.matrix.source).toBe('bundle');
    expect(result.matrix.featureCount).toBe(matrix.features.length);
    expect(result.matrix.features.find((flag) => flag.id === 'built-in-render-pipeline')?.enabled).toBe(false);
  });

  test('reports capability compatibility and never throws', () => {
    const result = versionMatrix(options);
    expect(result.compatibility.checked).toBe(2);
    expect(result.compatibility.compatible).toContain('compatible');
    expect(result.compatibility.incompatible).toContain('incompatible');
    expect(result.compatibility.unknown).toEqual([]);
    const bad = result.compatibility.capabilities.find((capability) => capability.id === 'incompatible');
    expect(bad?.status).toBe('incompatible');
    expect(bad?.reason).toContain('6.5');
  });

  test('fails soft when no version is detected', () => {
    const result = versionMatrix({
      ...options,
      projectRoot: join(fixture, 'empty'),
      opencodeDir: join(fixture, 'empty', '.opencode'),
    });
    expect(result.status).toBe('unknown');
    expect(result.detected.dispatchKey).toBeNull();
    expect(result.detected.raw).toBeNull();
  });

  test('reports unavailable when the matrix is missing', () => {
    const result = versionMatrix({ ...options, tableDir: join(fixture, 'missing.json') });
    expect(result.status).toBe('unavailable');
    expect(result.matrix.source).toBe('missing');
    expect(result.errors).toContain('version-matrix.json not found');
  });
});
