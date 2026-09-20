import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  assetIntelligence,
  offlineProjectInspection,
  platformInfo,
  projectStatus,
  unityApiLookup,
} from '../tools/unity/unity-sense/src/abilities';
import { codeNavigation } from '../tools/unity/unity-sense/src/code-navigation';
import { SENSE_ABILITIES, type SenseOptions } from '../tools/unity/unity-sense/src/types';
import { parseFrontmatter } from '../tools/shared/registry/src/frontmatter';
import { validateContract } from '../tools/shared/registry/src/contract';

const repoRoot = resolve(import.meta.dir, '..');
const commandDir = join(repoRoot, 'xdomains', 'game-dev', 'unity-3d', 'command');
const schemaPath = join(repoRoot, 'xdomains', 'context', 'capability-contract.schema.json');
const bundle = join(repoRoot, 'xdomains', 'scripts', 'unity', 'unity-sense.mjs');

function write(path: string, body: string): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, body);
}

let fixture: string;
let projectRoot: string;
let assetFolder: string;
let opencodeDir: string;
let options: SenseOptions;

beforeAll(() => {
  fixture = mkdtempSync(join(tmpdir(), 'oac-unity-sense-'));
  projectRoot = join(fixture, 'project');
  assetFolder = join(projectRoot, 'Assets');
  opencodeDir = join(projectRoot, '.opencode');
  const dataDir = join(opencodeDir, 'project-data');

  write(
    join(assetFolder, '_Project', 'Scripts', 'Game.asmdef'),
    JSON.stringify({ name: 'Game', references: [] })
  );
  write(
    join(assetFolder, '_Project', 'Scripts', 'PlayerController.cs'),
    [
      'namespace Game.Player',
      '{',
      '    public class PlayerController : MonoBehaviour',
      '    {',
      '        public float speed = 5f;',
      '        private Rigidbody body;',
      '        public void Move() { }',
      '    }',
      '}',
      '',
    ].join('\n')
  );
  write(
    join(assetFolder, '_Project', 'Tests', 'Game.Tests.asmdef'),
    JSON.stringify({ name: 'Game.Tests', references: ['Game'], testAssemblies: true })
  );
  write(
    join(assetFolder, '_Project', 'Tests', 'PlayerControllerTests.cs'),
    ['public class PlayerControllerTests', '{', '    public void Player_Moves() { }', '}'].join('\n')
  );

  write(
    join(dataDir, 'scan-result.json'),
    JSON.stringify({
      projectName: 'SenseFixture',
      foundProject: true,
      assetFolder,
      unityVer: '6000.5.7f1',
      unityCliVer: '1.2.3',
      pipelineVer: '1.0.0',
    })
  );
  write(
    join(dataDir, 'unity-project.json'),
    JSON.stringify({
      projectName: 'SenseFixture',
      projectPath: projectRoot,
      unityVersion: '6000.5.7f1',
      cliVersion: '1.2.3',
      pipelineVersion: '1.0.0',
      foundProject: true,
      assetFolder,
    })
  );
  write(
    join(dataDir, 'gate-state.json'),
    JSON.stringify({
      gateResult: 'passed',
      hardFailures: 0,
      reviewRequired: 1,
      fingerprint: 'abc123',
      lastVerificationUtc: '2026-09-19T00:00:00.000Z',
      routing: { route: 'offline' },
    })
  );
  write(
    join(dataDir, 'compile-state.json'),
    JSON.stringify({
      status: 'observed_locally',
      stale: false,
      noOpRecompile: null,
      assemblyCount: 2,
      newestScript: { path: 'Assets/_Project/Scripts/PlayerController.cs' },
    })
  );
  write(
    join(dataDir, 'project-structure.json'),
    JSON.stringify({
      counts: { runtimeScripts: 2, scenes: 1, prefabs: 3, sprites: 4 },
      thirdPartyFolders: ['Assets/Plugins'],
    })
  );
  write(
    join(dataDir, 'unity-package-list.json'),
    JSON.stringify({
      status: 'observed_locally',
      packages: [{ name: 'com.unity.inputsystem' }, { name: 'com.unity.textmeshpro' }],
    })
  );
  write(join(dataDir, 'project-files.json'), JSON.stringify({ assetFolder: 'Assets', filetypeToFolder: {} }));
  write(join(dataDir, 'project-pref.json'), JSON.stringify({ usesInputSystem: true, usesLegacyInput: false }));
  write(
    join(dataDir, 'project-settings.json'),
    JSON.stringify({
      status: 'observed_locally',
      editorVersion: '6000.5.7f1',
      productName: 'SenseFixture',
      targetPlatform: 'StandaloneWindows64',
      activeInputHandlerName: 'Input System Package (New)',
      il2cpp: true,
      colorSpace: 'Linear',
      scriptingBackend: { Standalone: 'IL2CPP' },
    })
  );
  write(
    join(dataDir, 'asmdef-map.json'),
    JSON.stringify({ assemblyCount: 2, testAssemblyCount: 1, assemblies: [{ name: 'Game' }, { name: 'Game.Tests' }] })
  );
  write(join(dataDir, 'log-digest.json'), JSON.stringify({ status: 'observed_locally', errorCount: 1, warningCount: 2 }));
  write(join(dataDir, 'test-inventory.json'), JSON.stringify({ testAssemblyCount: 1, latestResult: { result: 'Passed' } }));
  write(join(dataDir, 'deprecation-scan.json'), JSON.stringify({ findingCount: 3, byPattern: { FindObjectOfType: 3 } }));

  options = {
    projectRoot,
    opencodeDir,
    ability: 'project-status',
    json: true,
    list: false,
    assetFolder,
  };
});

afterAll(() => {
  try {
    rmSync(fixture, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

describe('project-status', () => {
  test('aggregates identity, compile and gate state', () => {
    const result = projectStatus(options);
    expect(result.family).toBe('sense');
    expect(result.mode).toBe('offline');
    expect(result.status).toBe('observed_locally');
    expect(result.identity.projectName).toBe('SenseFixture');
    expect(result.identity.unityVersion).toBe('6000.5.7f1');
    expect(result.compile.assemblyCount).toBe(2);
    expect(result.gate.gateResult).toBe('passed');
    expect(result.gate.route).toBe('offline');
    expect(result.structure.totalAssets).toBe(10);
    expect(result.packages.count).toBe(2);
  });

  test('is fail-soft with no project-data', () => {
    const result = projectStatus({ ...options, opencodeDir: join(fixture, 'empty', '.opencode') });
    expect(result.status).toBe('unavailable');
    expect(result.identity.projectName).toBeNull();
  });
});

describe('asset-intelligence', () => {
  test('deduces asset counts, packages, input and platform signals', () => {
    const result = assetIntelligence(options);
    expect(result.status).toBe('observed_locally');
    expect(result.totalAssets).toBe(10);
    expect(result.packages.names).toContain('com.unity.inputsystem');
    expect(result.input.activeInputHandlerName).toBe('Input System Package (New)');
    expect(result.platform.il2cpp).toBe(true);
    expect(result.assemblies.testAssemblyCount).toBe(1);
    expect(result.thirdPartyFolders).toContain('Assets/Plugins');
    expect(result.signals.some((signal) => signal.includes('Input System'))).toBe(true);
  });
});

describe('offline-project-inspection', () => {
  test('digests the six Phase 2a readers', () => {
    const result = offlineProjectInspection(options);
    expect(result.status).toBe('observed_locally');
    expect(result.compile.newestScript).toBe('Assets/_Project/Scripts/PlayerController.cs');
    expect(result.logs.errorCount).toBe(1);
    expect(result.settings.targetPlatform).toBe('StandaloneWindows64');
    expect(result.assemblies.testAssemblyCount).toBe(1);
    expect(result.tests.latestResult).toBe('Passed');
    expect(result.deprecations.findingCount).toBe(3);
  });
});

describe('unity-api-lookup', () => {
  test('finds a symbol and its replacement in the shipped table', () => {
    const result = unityApiLookup({ ...options, ability: 'unity-api-lookup', query: 'FindObjectOfType' });
    expect(result.status).toBe('observed_locally');
    expect(result.table.source).toBe('bundle');
    expect(result.table.entryCount).toBeGreaterThan(0);
    expect(result.matchCount).toBe(1);
    expect(result.matches[0].replacement).toBe('Object.FindFirstObjectByType');
  });

  test('reports unknown for an unmatched query', () => {
    const result = unityApiLookup({ ...options, ability: 'unity-api-lookup', query: 'NoSuchUnitySymbol' });
    expect(result.status).toBe('unknown');
    expect(result.matchCount).toBe(0);
  });

  test('reports unavailable when the table is missing', () => {
    const result = unityApiLookup({ ...options, ability: 'unity-api-lookup', tableDir: join(fixture, 'missing.json') });
    expect(result.status).toBe('unavailable');
    expect(result.table.source).toBe('missing');
  });
});

describe('platform-info', () => {
  test('resolves a platform and the project target defines', () => {
    const result = platformInfo({ ...options, ability: 'platform-info', query: 'Android' });
    expect(result.status).toBe('observed_locally');
    expect(result.platforms.length).toBe(1);
    expect(result.platforms[0].defines).toContain('UNITY_ANDROID');
    expect(result.project.targetPlatform).toBe('StandaloneWindows64');
    expect(result.activeDefines).toContain('UNITY_STANDALONE_WIN');
  });

  test('matches version defines', () => {
    const result = platformInfo({ ...options, ability: 'platform-info', query: 'UNITY_6000_0_OR_NEWER' });
    expect(result.versionDefines.length).toBe(1);
    expect(result.versionDefines[0].since).toBe('6000.0');
  });
});

describe('code-navigation', () => {
  test('finds declarations with file:line and owning assembly, offline', () => {
    const result = codeNavigation({ ...options, ability: 'code-navigation', query: 'PlayerController' });
    expect(result.status).toBe('observed_locally');
    expect(result.assetFolderSource).toBe('option');
    expect(result.scannedFiles).toBe(2);
    expect(result.assemblies.count).toBe(2);
    expect(result.assemblies.testCount).toBe(1);

    const type = result.matches.find((match) => match.kind === 'type' && match.symbol === 'PlayerController');
    expect(type).toBeDefined();
    expect(type?.file).toBe('Assets/_Project/Scripts/PlayerController.cs');
    expect(type?.line).toBe(3);
    expect(type?.assembly).toBe('Game');

    const testType = result.matches.find((match) => match.symbol === 'PlayerControllerTests');
    expect(testType?.assembly).toBe('Game.Tests');
  });

  test('reports unknown when the Assets folder is missing', () => {
    const result = codeNavigation({ ...options, ability: 'code-navigation', assetFolder: join(fixture, 'nope', 'Assets') });
    expect(result.status).toBe('unknown');
    expect(result.matchCount).toBe(0);
  });
});

describe('Sense command contracts', () => {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));

  test('declares exactly the six abilities', () => {
    expect(SENSE_ABILITIES).toEqual([
      'project-status',
      'asset-intelligence',
      'offline-project-inspection',
      'unity-api-lookup',
      'platform-info',
      'code-navigation',
    ]);
  });

  for (const ability of SENSE_ABILITIES) {
    test(`${ability} has a valid offline Sense contract`, () => {
      const fm = parseFrontmatter(readFileSync(join(commandDir, `${ability}.md`), 'utf8'));
      expect(fm.family).toBe('sense');
      expect(fm.mode).toBe('offline');
      expect(fm.id).toBe(ability);
      const result = validateContract(fm as Record<string, unknown>, schema);
      expect(result.errors).toEqual([]);
    });
  }
});

describe('unity-sense bundle', () => {
  test('lists the six abilities', () => {
    const res = spawnSync(process.execPath, [bundle, '--list'], { encoding: 'utf8' });
    expect(res.status).toBe(0);
    expect(res.stdout.trim().split(/\r?\n/)).toEqual(SENSE_ABILITIES);
  });

  test('emits JSON for an offline read', () => {
    const res = spawnSync(
      process.execPath,
      [bundle, '--project-root', projectRoot, '--opencode-dir', opencodeDir, '--ability', 'project-status', '--json'],
      { encoding: 'utf8' }
    );
    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout);
    expect(parsed.ability).toBe('project-status');
    expect(parsed.mode).toBe('offline');
    expect(parsed.identity.projectName).toBe('SenseFixture');
  });
});
