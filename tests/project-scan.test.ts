import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { discoverAssetFolder } from '../tools/unity/project-scan/src/asset-folder';
import { detectInputUsage, discoverProjectFiles } from '../tools/unity/project-scan/src/project-files';
import {
  loadFiletypes,
  loadPackageChoices,
  loadPatterns,
  loadUnderstoodPackages,
  contextPaths,
} from '../tools/shared/context-files';
import { PromptClient } from '../tools/shared/prompt-client';
import { runPackageChoices } from '../tools/unity/project-scan/src/package-choices';
import { runPatternsInterview } from '../tools/unity/project-scan/src/patterns-interview';
import { buildProjectJson } from '../tools/unity/project-scan/src/project-meta';
import { applySyntheticBuiltins } from '../tools/unity/project-scan/src/unity-packages';

const repoRoot = resolve(import.meta.dir, '..');
const contextDir = join(repoRoot, 'xdomains', 'context');
const bundle = join(repoRoot, 'xdomains', 'scripts', 'unity', 'scan-project.mjs');

function offlinePrompt(answers: Record<string, unknown> = {}): PromptClient {
  return new PromptClient({ promptScript: '', answers, nonInteractive: true });
}

function write(path: string, body: string): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, body);
}

let fixture: string;

beforeAll(() => {
  fixture = mkdtempSync(join(tmpdir(), 'oac-scan-test-'));
});

afterAll(() => {
  try {
    rmSync(fixture, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

describe('asset folder discovery', () => {
  test('uses a direct Assets folder', async () => {
    const root = join(fixture, 'direct');
    mkdirSync(join(root, 'Assets'), { recursive: true });
    const result = await discoverAssetFolder(root, offlinePrompt());
    expect(result.foundProject).toBe(true);
    expect(result.assetFolder).toBe(join(root, 'Assets'));
  });

  test('finds a single nested */Assets', async () => {
    const root = join(fixture, 'nested');
    mkdirSync(join(root, 'MyGame', 'Assets'), { recursive: true });
    const result = await discoverAssetFolder(root, offlinePrompt());
    expect(result.foundProject).toBe(true);
    expect(result.assetFolder).toBe(join(root, 'MyGame', 'Assets'));
  });

  test('ignores Assets inside excluded folders', async () => {
    const root = join(fixture, 'excluded');
    mkdirSync(join(root, 'Packages', 'SomePkg', 'Assets'), { recursive: true });
    const result = await discoverAssetFolder(root, offlinePrompt());
    expect(result.foundProject).toBe(false);
    expect(result.assetFolder).toBeNull();
  });
});

describe('project files', () => {
  test('maps filetypes, keeps asset-relative and root-relative paths, skips excludes', () => {
    const root = join(fixture, 'files');
    mkdirSync(join(root, 'Assets', 'Scripts'), { recursive: true });
    mkdirSync(join(root, 'Assets', 'Plugins'), { recursive: true });
    mkdirSync(join(root, 'Assets', 'Editor'), { recursive: true });
    writeFileSync(join(root, 'Assets', 'Scripts', 'Foo.cs'), 'using UnityEngine.InputSystem;\n');
    writeFileSync(join(root, 'Assets', 'Editor', 'Bar.cs'), 'using UnityEngine;\nInput.GetAxis("H");\n');
    writeFileSync(join(root, 'Assets', 'Plugins', 'Vendor.cs'), 'class Vendor {}\n');
    writeFileSync(join(root, 'Assets', 'Scripts', 'readme.md'), '# hi\n');

    const filetypes = loadFiletypes(contextPaths(contextDir).filetypes).filetypes;
    const result = discoverProjectFiles(root, join(root, 'Assets'), filetypes);

    expect(result.filetypeToFolder.cs.sort()).toEqual(['Editor', 'Scripts']);
    expect(result.folders['Assets/Scripts'].cs).toContain('Foo.cs');
    expect(result.folders['Assets/Scripts'].md).toEqual(['readme.md']);
    expect(JSON.stringify(result.folders)).not.toContain('Vendor.cs');
    expect(result.codeFiles.some((f) => f.endsWith('Bar.cs'))).toBe(false);
  });

  test('detects new and legacy input usage', () => {
    const root = join(fixture, 'input');
    mkdirSync(join(root, 'Assets'), { recursive: true });
    const newFile = join(root, 'Assets', 'New.cs');
    const legacyFile = join(root, 'Assets', 'Legacy.cs');
    writeFileSync(newFile, 'using UnityEngine.InputSystem;\n');
    writeFileSync(legacyFile, 'using UnityEngine;\nvar x = Input.GetAxis("H");\n');
    const usage = detectInputUsage([newFile, legacyFile]);
    expect(usage.usesInputSystem).toBe(true);
    expect(usage.usesLegacyInput).toBe(true);
  });

  test('does not count UnityEngine.InputSystem as legacy', () => {
    const root = join(fixture, 'input-only-new');
    mkdirSync(root, { recursive: true });
    const file = join(root, 'New.cs');
    writeFileSync(file, 'using UnityEngine.InputSystem;\n');
    const usage = detectInputUsage([file]);
    expect(usage.usesInputSystem).toBe(true);
    expect(usage.usesLegacyInput).toBe(false);
  });
});

describe('package choices', () => {
  test('auto-collects single matches and defers stage-4 rows', async () => {
    const choices = loadPackageChoices(contextPaths(contextDir).packageChoices);
    const understood = loadUnderstoodPackages(contextPaths(contextDir).understoodPackages);
    const installed = new Set([
      'com.unity.builtin.camera',
      'com.unity.cinemachine',
      'com.unity.modules.ui',
      'com.unity.ugui',
    ]);
    const result = await runPackageChoices(choices, understood, installed, 'Demo', offlinePrompt());
    // camera has two present -> asked; non-interactive picks the first option
    expect(result.packageChoices.camera).toBeTruthy();
    // ui is deferred
    expect(result.deferredChoices.ui).toContain('com.unity.ugui');
    expect(result.packageChoices.ui).toBeUndefined();
  });

  test('synthetic builtins add input manager and camera', () => {
    const map: Record<string, string> = {};
    applySyntheticBuiltins(map, true);
    expect(map['com.unity.builtin.input_manager']).toBe('builtin');
    expect(map['com.unity.builtin.camera']).toBe('builtin');
  });
});

describe('patterns interview', () => {
  test('asks non-deferred categories and skips test-methodology', async () => {
    const patterns = loadPatterns(contextPaths(contextDir).patterns);
    const result = await runPatternsInterview(patterns, offlinePrompt());
    expect(result.patterns['test-methodology']).toBeUndefined();
    expect(result.patterns['dependency-resolution']).toBeTruthy();
    expect(Array.isArray(result.patterns['object-creation'])).toBe(true);
  });
});

describe('project meta', () => {
  test('builds the wrapper shape', () => {
    const meta = buildProjectJson({
      name: 'Demo',
      path: 'C:/demo',
      info: { version: '6000.5.7f1', renderPipeline: 'URP' },
      unityVer: '6000.5.7f1',
      env: { editorInstallPath: 'C:/Unity' },
      native: null,
      subProjects: {},
    }) as { schemaVersion: number; project: Record<string, unknown> };
    expect(meta.schemaVersion).toBe(1);
    expect(meta.project.name).toBe('Demo');
    expect(meta.project.renderPipeline).toBe('URP');
    expect(meta.project.subProjects).toEqual({});
  });
});

describe('context data integrity', () => {
  const paths = contextPaths(contextDir);
  const snakeKeys = [
    'when_to_use',
    'llm_rule',
    'flag_id',
    'flag_ids',
    'conflicts_with',
    'pairs_well_with',
    'mutually_exclusive',
    'package_name',
    'pretty_name',
    'category_legend',
    'package_names',
  ];

  test('all context JSON parses and has no snake_case keys', () => {
    for (const path of [paths.filetypes, paths.packageChoices, paths.understoodPackages, paths.patterns]) {
      const text = readFileSync(path, 'utf8');
      JSON.parse(text);
      for (const key of snakeKeys) {
        expect(text).not.toContain(`"${key}"`);
      }
    }
  });

  test('filetypes map is complete', () => {
    const filetypes = loadFiletypes(paths.filetypes).filetypes;
    expect(filetypes.cs).toBe('C#');
    expect(filetypes.inputactions).toBe('ActionMap');
    expect(filetypes.shader).toBe('Shader');
  });

  test('deferToStage4 is set on ui, editor_ui and test-methodology', () => {
    const choices = loadPackageChoices(paths.packageChoices);
    const deferred = choices.choices.filter((c) => c.deferToStage4).map((c) => c.category).sort();
    expect(deferred).toEqual(['editor_ui', 'ui']);
    const patterns = loadPatterns(paths.patterns);
    const tm = patterns.categories.find((c) => c.id === 'test-methodology');
    expect(tm?.deferToStage4).toBe(true);
  });
});

describe('end-to-end scan (non-interactive)', () => {
  test('writes project data and reports the project', () => {
    const root = join(fixture, 'e2e');
    mkdirSync(join(root, '.opencode'), { recursive: true });
    write(join(root, 'Assets', 'Scripts', 'Foo.cs'), 'using UnityEngine.InputSystem;\n');
    write(
      join(root, 'Packages', 'manifest.json'),
      JSON.stringify({ dependencies: { 'com.unity.ugui': '2.0.0', 'com.unity.inputsystem': '1.20.0' } })
    );
    write(join(root, 'ProjectSettings', 'ProjectVersion.txt'), 'm_EditorVersion: 6000.5.7f1\n');
    write(join(root, 'ProjectSettings', 'ProjectSettings.asset'), 'PlayerSettings:\n  activeInputHandler: 1\n');

    const opencodeDir = join(root, '.opencode');
    const res = spawnSync(
      process.execPath,
      [
        bundle,
        '--project-root',
        root,
        '--opencode-dir',
        opencodeDir,
        '--context-dir',
        contextDir,
        '--interim-dir',
        join(opencodeDir, 'xdomains', 'context', 'project'),
        '--non-interactive',
      ],
      { encoding: 'utf8' }
    );
    expect(res.status).toBe(0);

    const scanResult = JSON.parse(readFileSync(join(opencodeDir, 'project-data', 'scan-result.json'), 'utf8'));
    expect(scanResult.foundProject).toBe(true);
    expect(scanResult.unityVer).toBe('6000.5.7f1');
    expect(scanResult.inputFlags.usesInputSystem).toBe(true);
    expect(scanResult.warnings).toEqual([]);

    const projectJson = JSON.parse(readFileSync(join(opencodeDir, 'xdomains', 'context', 'project', 'project.json'), 'utf8'));
    expect(projectJson.project.name).toBe('e2e');
    expect(projectJson.project.version).toBe('6000.5.7f1');
  });
});
