import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  produceAsmdefMap,
  produceCompileState,
  produceDeprecationScan,
  produceLogDigest,
  produceProjectSettings,
  produceTestInventory,
  type OfflineInput,
} from '../tools/unity/gather-unity-context/src/offline';

const repoRoot = resolve(import.meta.dir, '..');
const shippedPatterns = join(repoRoot, 'xdomains', 'context', 'unity', 'deprecated-patterns.json');

function write(path: string, body: string): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, body);
}

function touch(path: string, isoDate: string): void {
  const date = new Date(isoDate);
  utimesSync(path, date, date);
}

let fixture: string;
let input: OfflineInput;

beforeAll(() => {
  fixture = mkdtempSync(join(tmpdir(), 'oac-gather-offline-'));
  const root = join(fixture, 'project');

  write(join(root, 'Assets', '_Project', 'Scripts', 'Game.cs'), 'public class Game {}');
  write(
    join(root, 'Assets', '_Project', 'Scripts', 'AssemblyInfo.cs'),
    '[assembly: System.Runtime.CompilerServices.InternalsVisibleTo("Game.Tests")]'
  );
  write(
    join(root, 'Assets', '_Project', 'Scripts', 'Game.asmdef'),
    JSON.stringify({ name: 'Game', references: ['UnityEngine.UI'], includePlatforms: [] })
  );
  write(join(root, 'Assets', '_Project', 'Scripts', 'Game.asmdef.meta'), 'guid: 00000000000000000000000000000001\n');
  write(
    join(root, 'Assets', '_Project', 'Tests', 'Game.Tests.asmdef'),
    JSON.stringify({
      name: 'Game.Tests',
      references: ['Game', 'GUID:00000000000000000000000000000001'],
      includePlatforms: [],
      testAssemblies: true,
    })
  );
  write(join(root, 'Assets', '_Project', 'Tests', 'GameTests.cs'), 'public class GameTests {}');
  write(
    join(root, 'Assets', '_Project', 'Legacy.cs'),
    [
      'public class Legacy {',
      '  void Start() {',
      '    var a = FindObjectOfType<Camera>();',
      '    var b = Object.FindObjectOfType<Light>();',
      '    var c = FindObjectsOfType<Camera>();',
      '  }',
      '}',
    ].join('\n')
  );

  write(
    join(root, 'ProjectSettings', 'ProjectSettings.asset'),
    [
      'productName: FixtureGame',
      'companyName: FixtureCo',
      '  m_ActiveColorSpace: 1',
      '  activeInputHandler: 2',
      '  scriptingBackend:',
      '    Standalone: 1',
      '  m_BuildTargetGraphicsAPIs:',
      '  - m_BuildTarget: WindowsStandaloneSupport',
      '    m_APIs: 020000000b000000',
      '    m_Automatic: 0',
      '',
    ].join('\n')
  );
  write(join(root, 'ProjectSettings', 'EditorUserBuildSettings.asset'), '  m_ActiveBuildTarget: StandaloneWindows64\n');
  write(
    join(root, 'ProjectSettings', 'ProjectVersion.txt'),
    'm_EditorVersion: 6000.1.3f1\nm_EditorVersionWithRevision: 6000.1.3f1 (f34db9734971)\n'
  );

  const dll = join(root, 'Library', 'ScriptAssemblies', 'Assembly-CSharp.dll');
  write(dll, 'dll');
  for (const script of [
    dll,
    join(root, 'Assets', '_Project', 'Scripts', 'Game.cs'),
    join(root, 'Assets', '_Project', 'Scripts', 'AssemblyInfo.cs'),
    join(root, 'Assets', '_Project', 'Tests', 'GameTests.cs'),
    join(root, 'Assets', '_Project', 'Legacy.cs'),
  ]) {
    touch(script, '2026-01-01T00:00:00.000Z');
  }

  write(
    join(root, '.opencode', '.scratch', 'unity', 'EditMode-results.xml'),
    '<test-run id="2" total="12" passed="10" failed="1" skipped="1" inconclusive="0" result="Failed">'
  );
  write(
    join(root, '.opencode', '.scratch', 'unity', 'visual-verification.json'),
    JSON.stringify({
      status: 'passed',
      summary: { total: 1, passed: 1 },
      results: [{ name: 'shows the menu', status: 'passed', screenshot: 'screenshots/step-1.png' }],
    })
  );
  write(join(root, '.opencode', '.scratch', 'unity', 'screenshots', 'step-1.png'), 'png');

  input = { projectRoot: root, assetFolder: join(root, 'Assets'), opencodeDir: join(root, '.opencode') };
});

afterAll(() => {
  try {
    rmSync(fixture, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

describe('compile-state producer', () => {
  test('reports no-op as not determinable when sources are not newer than assemblies', () => {
    const log = join(fixture, 'compile-Editor.log');
    write(log, ['Begin MonoManager ReloadAssembly', 'Finished compiling graph'].join('\n'));
    const result = produceCompileState(input, [log]);
    expect(result.status).toBe('observed_locally');
    expect(result.route).toBe('offline');
    expect(result.assemblyCount).toBe(1);
    expect(result.newestAssembly?.name).toBe('Assembly-CSharp.dll');
    expect(result.stale).toBe(false);
    expect(result.noOpRecompile).toBeNull();
  });

  test('reports a no-op recompile only with positive evidence', () => {
    const log = join(fixture, 'compile-Editor.log');
    const script = join(input.projectRoot, 'Assets', '_Project', 'Legacy.cs');
    touch(script, '2026-02-01T00:00:00.000Z');
    const result = produceCompileState(input, [log]);
    expect(result.stale).toBe(true);
    expect(result.noOpRecompile).toBe(true);
    touch(script, '2026-01-01T00:00:00.000Z');
  });

  test('reports no-op as not determinable without compile evidence', () => {
    const script = join(input.projectRoot, 'Assets', '_Project', 'Legacy.cs');
    touch(script, '2026-02-01T00:00:00.000Z');
    const result = produceCompileState(input, [join(fixture, 'missing-Editor.log')]);
    expect(result.stale).toBe(true);
    expect(result.noOpRecompile).toBeNull();
    touch(script, '2026-01-01T00:00:00.000Z');
  });

  test('reports stale as not determinable without script evidence', () => {
    const root = join(fixture, 'compile-no-scripts');
    write(join(root, 'Library', 'ScriptAssemblies', 'Game.dll'), 'dll');
    const result = produceCompileState(
      { projectRoot: root, assetFolder: join(root, 'Assets') },
      [join(fixture, 'missing-Editor.log')]
    );
    expect(result.status).toBe('observed_locally');
    expect(result.newestAssembly?.name).toBe('Game.dll');
    expect(result.newestScript).toBeNull();
    expect(result.stale).toBeNull();
    expect(result.staleReason).toContain('script');
  });

  test('reports unavailable without a Library folder', () => {
    const result = produceCompileState({ projectRoot: fixture, assetFolder: join(fixture, 'missing') });
    expect(result.status).toBe('unavailable');
    expect(result.assemblyCount).toBe(0);
    expect(result.stale).toBeNull();
    expect(result.noOpRecompile).toBeNull();
  });
});

describe('log-digest producer', () => {
  test('counts errors and warnings from Editor logs', () => {
    const log = join(fixture, 'Editor.log');
    write(
      log,
      [
        'Initialize engine version: 6000.5.7f1',
        'Assets/Foo.cs(3,7): error CS0103: The name does not exist',
        'Assets/Foo.cs(9,7): warning CS0168: The variable is declared but never used',
        '[Error] A fatal thing happened',
      ].join('\n')
    );
    const result = produceLogDigest(input, [log]);
    expect(result.status).toBe('observed_locally');
    expect(result.logCount).toBe(1);
    expect(result.errorCount).toBe(2);
    expect(result.warningCount).toBe(1);
    expect(result.recentMessages.some((m) => m.level === 'error')).toBe(true);
  });

  test('reports unavailable when no log exists', () => {
    const result = produceLogDigest(input, [join(fixture, 'does-not-exist.log')]);
    expect(result.status).toBe('unavailable');
    expect(result.logCount).toBe(0);
    expect(result.errorCount).toBe(0);
  });
});

describe('project-settings producer', () => {
  test('parses backend, color space, graphics API and input handler', () => {
    const result = produceProjectSettings(input);
    expect(result.status).toBe('observed_locally');
    expect(result.editorVersion).toBe('6000.1.3f1');
    expect(result.editorVersionWithRevision).toBe('f34db9734971');
    expect(result.productName).toBe('FixtureGame');
    expect(result.companyName).toBe('FixtureCo');
    expect(result.il2cpp).toBe(true);
    expect(result.scriptingBackend.Standalone).toBe('IL2CPP');
    expect(result.colorSpace).toBe('Linear');
    expect(result.targetPlatform).toBe('StandaloneWindows64');
    expect(result.targetPlatformSource).toBe('EditorUserBuildSettings.asset');
    expect(result.graphicsApis).toContain('Direct3D11');
    expect(result.graphicsApis).toContain('OpenGLES3');
    expect(result.activeInputHandler).toBe(2);
    expect(result.activeInputHandlerName).toBe('Both');
    expect(result.persistentDataPath).toContain('FixtureCo');
  });

  test('reports unavailable without ProjectSettings.asset', () => {
    const result = produceProjectSettings({ projectRoot: fixture, assetFolder: join(fixture, 'Assets') });
    expect(result.status).toBe('unavailable');
    expect(result.scriptingBackend).toEqual({});
  });
});

describe('asmdef-map producer', () => {
  test('builds nodes, tests, internals-visible-to and resolved edges', () => {
    const result = produceAsmdefMap(input);
    expect(result.status).toBe('observed_locally');
    expect(result.assemblyCount).toBe(2);
    expect(result.testAssemblyCount).toBe(1);

    const game = result.assemblies.find((node) => node.name === 'Game');
    expect(game?.internalsVisibleTo).toContain('Game.Tests');
    expect(game?.targets.play).toBe(true);

    const tests = result.assemblies.find((node) => node.name === 'Game.Tests');
    expect(tests?.isTest).toBe(true);

    const guidEdge = result.edges.find((edge) => edge.reference.startsWith('GUID:'));
    expect(guidEdge?.to).toBe('Game');
    expect(guidEdge?.resolved).toBe(true);
    expect(result.edges.some((edge) => edge.reference === 'UnityEngine.UI' && !edge.resolved)).toBe(true);
  });

  test('derives EditMode for editor-only test asmdefs and PlayMode otherwise', () => {
    const root = join(fixture, 'asmdef-targets');
    write(
      join(root, 'Assets', 'Editor', 'EditorTests.asmdef'),
      JSON.stringify({ name: 'EditorTests', includePlatforms: ['Editor'], testAssemblies: true })
    );
    write(
      join(root, 'Assets', 'Runtime', 'RuntimeTests.asmdef'),
      JSON.stringify({ name: 'RuntimeTests', includePlatforms: [], testAssemblies: true })
    );
    const result = produceAsmdefMap({ projectRoot: root, assetFolder: join(root, 'Assets') });

    const editorTests = result.assemblies.find((node) => node.name === 'EditorTests');
    expect(editorTests?.isTest).toBe(true);
    expect(editorTests?.targets).toEqual({ edit: true, play: false });

    const runtimeTests = result.assemblies.find((node) => node.name === 'RuntimeTests');
    expect(runtimeTests?.isTest).toBe(true);
    expect(runtimeTests?.targets).toEqual({ edit: false, play: true });
  });
});

describe('test-inventory producer', () => {
  test('collects test assemblies, results and visual verification', () => {
    const result = produceTestInventory(input);
    expect(result.status).toBe('observed_locally');
    expect(result.testAssemblyCount).toBe(1);
    expect(result.latestResult?.counts.total).toBe(12);
    expect(result.latestResult?.counts.failed).toBe(1);
    expect(result.latestResult?.result).toBe('Failed');
    expect(result.visualVerification.found).toBe(true);
    expect(result.visualVerification.screenshots.length).toBe(1);
    expect(result.visualVerification.results.length).toBe(1);
    expect(result.visualVerification.results[0].status).toBe('passed');
    expect(result.visualVerification.results[0].cases.length).toBe(1);
    expect(result.visualVerification.results[0].screenshots).toContain('screenshots/step-1.png');
  });
});

describe('deprecation-scan producer', () => {
  test('reports unavailable when the patterns table is missing', () => {
    const result = produceDeprecationScan(
      { ...input, assetFolder: join(input.assetFolder, '_Project') },
      join(fixture, 'missing-deprecated-patterns.json')
    );
    expect(result.status).toBe('unavailable');
    expect(result.patternsSource).toBe('missing');
    expect(result.patternsLoaded).toBe(0);
    expect(result.findingCount).toBe(0);
  });

  test('loads the shipped deprecated-patterns table', () => {
    const result = produceDeprecationScan(
      { ...input, assetFolder: join(input.assetFolder, '_Project') },
      shippedPatterns
    );
    expect(result.status).toBe('observed_locally');
    expect(result.patternsSource).toBe('bundle');
    expect(result.patternsLoaded).toBeGreaterThanOrEqual(3);
    expect(result.byPattern.FindObjectOfType).toBe(1);
    expect(result.byPattern['Object.FindObjectOfType']).toBe(1);
    expect(result.byPattern.FindObjectsOfType).toBe(1);
    expect(result.findingCount).toBe(3);
  });
});
