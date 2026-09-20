import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseNUnit } from '../tools/unity/gather-unity-context/src/gate';
import { fingerprintInputs, fingerprintOf } from '../tools/unity/gather-unity-context/src/fingerprint';
import { discoverProjectStructure } from '../tools/unity/gather-unity-context/src/structure';
import { PromptClient } from '../tools/shared/prompt-client';

const repoRoot = resolve(import.meta.dir, '..');
const bundle = join(repoRoot, 'xdomains', 'scripts', 'unity', 'gather-unity-context.mjs');

function offlinePrompt(): PromptClient {
  return new PromptClient({ promptScript: '', answers: {}, nonInteractive: true });
}

function write(path: string, body: string): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, body);
}

let fixture: string;

beforeAll(() => {
  fixture = mkdtempSync(join(tmpdir(), 'oac-gather-test-'));
});

afterAll(() => {
  try {
    rmSync(fixture, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

describe('nunit parsing', () => {
  test('reads counts and result from a test-run element', () => {
    const xml = '<test-run id="2" total="12" passed="10" failed="1" skipped="1" inconclusive="0" result="Failed">';
    const counts = parseNUnit(xml);
    expect(counts.total).toBe(12);
    expect(counts.failed).toBe(1);
    expect(counts.result).toBe('Failed');
  });

  test('returns unknown for missing xml', () => {
    expect(parseNUnit('').result).toBe('Unknown');
  });
});

describe('project structure', () => {
  test('classifies assets and detects a dominant base folder', async () => {
    const root = join(fixture, 'structure');
    write(join(root, 'Assets', '_Project', 'Scripts', 'Game.cs'), 'class Game {}');
    write(join(root, 'Assets', '_Project', 'Scripts', 'Game.asmdef'), '{}');
    write(join(root, 'Assets', '_Project', 'Scenes', 'Main.unity'), 'scene');
    write(join(root, 'Assets', '_Project', 'Scenes', 'Player.prefab'), 'prefab');
    write(join(root, 'Assets', '_Project', 'UI', 'Main.uxml'), 'uxml');
    write(join(root, 'Assets', '_Project', 'UI', 'Main.uss'), 'uss');
    write(join(root, 'Assets', '_Project', 'Art', 'hero.png'), 'png');
    write(join(root, 'Assets', '_Project', 'Audio', 'hit.wav'), 'wav');
    write(join(root, 'Assets', '_Project', 'Player.inputactions'), 'input');
    write(join(root, 'Assets', 'Editor', 'Tool.cs'), 'class Tool {}');
    write(join(root, 'Assets', 'Plugins', 'native.dll'), 'dll');

    const result = await discoverProjectStructure({
      projectRoot: root,
      assetFolder: join(root, 'Assets'),
      projectName: 'structure',
      prompts: offlinePrompt(),
    });

    expect(result.counts.scenes).toBe(1);
    expect(result.counts.prefabs).toBe(1);
    expect(result.counts.asmdefs).toBe(1);
    expect(result.counts.uxml).toBe(1);
    expect(result.counts.uss).toBe(1);
    expect(result.counts.actionMaps).toBe(1);
    expect(result.counts.editorScripts).toBe(1);
    expect(result.counts.runtimeScripts).toBe(1);
    expect(result.baseFolder).toBe('Assets/_Project');
    expect(result.baseFolderConfident).toBe(true);
    expect(result.thirdPartyFolders).toContain('Assets/Plugins');
    expect(result.categories.runtimeScripts).toContain('Assets/_Project/Scripts/Game.cs');
  });
});

describe('fingerprint', () => {
  test('is deterministic and changes with inputs', () => {
    const root = join(fixture, 'fingerprint');
    write(join(root, 'ProjectSettings', 'ProjectVersion.txt'), 'm_EditorVersion: 6000.5.7f1\n');
    write(join(root, 'Packages', 'manifest.json'), '{"dependencies":{}}');
    const a = fingerprintOf(fingerprintInputs(root, 'fp'));
    const b = fingerprintOf(fingerprintInputs(root, 'fp'));
    expect(a).toBe(b);

    write(join(root, 'ProjectSettings', 'ProjectVersion.txt'), 'm_EditorVersion: 6000.6.0f1\n');
    const c = fingerprintOf(fingerprintInputs(root, 'fp'));
    expect(c).not.toBe(a);
  });
});

describe('end-to-end gather (non-interactive)', () => {
  test('writes the Unity context files', () => {
    const root = join(fixture, 'e2e');
    mkdirSync(join(root, '.opencode', 'project-data'), { recursive: true });
    write(join(root, 'Assets', '_Project', 'Scripts', 'Game.cs'), 'class Game {}');
    write(join(root, 'Assets', '_Project', 'Scenes', 'Main.unity'), 'scene');
    write(join(root, 'ProjectSettings', 'ProjectVersion.txt'), 'm_EditorVersion: 6000.5.7f1\n');
    write(join(root, 'Packages', 'manifest.json'), '{"dependencies":{}}');
    write(
      join(root, '.opencode', 'project-data', 'scan-result.json'),
      JSON.stringify({ projectName: 'e2e', foundProject: true, assetFolder: join(root, 'Assets') })
    );

    const opencodeDir = join(root, '.opencode');
    const res = spawnSync(
      process.execPath,
      [bundle, '--project-root', root, '--opencode-dir', opencodeDir, '--non-interactive'],
      { encoding: 'utf8' }
    );
    expect(res.status).toBe(0);

    const dataDir = join(opencodeDir, 'project-data');
    for (const file of [
      'project-structure.json',
      'unity-command-list.json',
      'unity-command-schema.json',
      'unity-pipeline-status.json',
      'unity-mcp-status.json',
      'unity-verification-report.json',
      'gate-state.json',
    ]) {
      expect(readFileSync(join(dataDir, file), 'utf8').length).toBeGreaterThan(0);
    }

    const gateState = JSON.parse(readFileSync(join(dataDir, 'gate-state.json'), 'utf8'));
    expect(gateState.gateResult).toBe('not_run');
    expect(gateState.fingerprint).toBeTruthy();

    const structure = JSON.parse(readFileSync(join(dataDir, 'project-structure.json'), 'utf8'));
    expect(structure.baseFolder).toBe('Assets/_Project');
  });
});
