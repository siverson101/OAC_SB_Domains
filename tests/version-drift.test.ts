import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { ENVELOPE_KEYS } from '../tools/shared/result-envelope';
import { parseFrontmatter } from '../tools/shared/registry/src/frontmatter';
import { runVersionDrift } from '../tools/unity/unity-version-drift/src/abilities';
import type { CliProbe, VersionDriftOptions } from '../tools/unity/unity-version-drift/src/types';

interface Fixture {
  root: string;
  projectRoot: string;
  opencodeDir: string;
  baselineDir: string;
}

const fixtures: Fixture[] = [];

function makeFixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), 'oac-version-drift-'));
  const projectRoot = join(root, 'project');
  const opencodeDir = join(projectRoot, '.opencode');
  const baselineDir = join(opencodeDir, 'project-data', 'version-baselines');
  mkdirSync(join(projectRoot, 'ProjectSettings'), { recursive: true });
  mkdirSync(join(projectRoot, 'Packages'), { recursive: true });
  mkdirSync(baselineDir, { recursive: true });
  writeFileSync(
    join(projectRoot, 'ProjectSettings', 'ProjectVersion.txt'),
    'm_EditorVersion: 6000.1.2f1\nm_EditorVersionWithRevision: 6000.1.2f1 (abc123)\n'
  );
  writeFileSync(
    join(projectRoot, 'Packages', 'manifest.json'),
    JSON.stringify({ dependencies: { 'com.unity.pipeline': '0.4.2', 'com.unity.textmeshpro': '3.0.6' } })
  );
  const fixture = { root, projectRoot, opencodeDir, baselineDir };
  fixtures.push(fixture);
  return fixture;
}

afterEach(() => {
  while (fixtures.length > 0) {
    const fixture = fixtures.pop();
    if (fixture) rmSync(fixture.root, { recursive: true, force: true });
  }
});

const T0 = '2026-09-21T00:00:00.000Z';

function options(fixture: Fixture, overrides: Partial<VersionDriftOptions> = {}): VersionDriftOptions {
  return {
    projectRoot: fixture.projectRoot,
    opencodeDir: fixture.opencodeDir,
    ability: 'version-drift',
    json: true,
    list: false,
    ifDue: false,
    maxAgeHours: 24,
    now: T0,
    cliCommand: 'definitely-not-a-real-cli-xyz',
    ...overrides,
  };
}

function writeText(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function writeBaselines(
  fixture: Fixture,
  baselines: { editor?: string; packages?: Record<string, string>; cliVersion?: string; cliCommands?: string[] }
): void {
  if (baselines.editor !== undefined) {
    writeText(join(fixture.baselineDir, 'unity-editor-version.txt'), `${baselines.editor}\n`);
  }
  if (baselines.packages !== undefined) {
    writeFileSync(
      join(fixture.baselineDir, 'package-versions.json'),
      JSON.stringify({ schemaVersion: 1, packages: baselines.packages })
    );
  }
  if (baselines.cliVersion !== undefined) {
    writeText(join(fixture.baselineDir, 'unity-cli-version.txt'), `${baselines.cliVersion}\n`);
  }
  if (baselines.cliCommands !== undefined) {
    writeFileSync(
      join(fixture.baselineDir, 'unity-cli-commands.json'),
      JSON.stringify({ schemaVersion: 1, commands: baselines.cliCommands })
    );
  }
}

const CURRENT_PACKAGES = { 'com.unity.pipeline': '0.4.2', 'com.unity.textmeshpro': '3.0.6' };

function unchangedBaselines(fixture: Fixture): void {
  writeBaselines(fixture, { editor: '6000.1.2f1', packages: CURRENT_PACKAGES });
}

describe('version-drift: offline detection', () => {
  test('unchanged Editor and packages report no change', () => {
    const fixture = makeFixture();
    unchangedBaselines(fixture);

    const result = runVersionDrift(options(fixture));

    expect(result.status).toBe('observed_locally');
    expect(result.editor.status).toBe('unchanged');
    expect(result.packages.status).toBe('unchanged');
    expect(result.cli.status).toBe('unavailable');
    expect(result.actions).toEqual([]);
    expect(result.baselinesUpdated).toEqual([]);
    expect(result.report).toContain('=== Session-Start Version Check ===');
    expect(result.report).toContain('[Editor] No change (6000.1.2f1)');
    expect(result.report).toContain('[CLI] unavailable');
    expect(existsSync(join(fixture.baselineDir, 'last-run.json'))).toBe(true);
  });

  test('an Editor bump surfaces an ACTION REQUIRED and updates the baseline', () => {
    const fixture = makeFixture();
    unchangedBaselines(fixture);
    writeFileSync(
      join(fixture.projectRoot, 'ProjectSettings', 'ProjectVersion.txt'),
      'm_EditorVersion: 6000.1.3f1\nm_EditorVersionWithRevision: 6000.1.3f1 (def456)\n'
    );

    const result = runVersionDrift(options(fixture));

    expect(result.editor.status).toBe('changed');
    expect(result.editor.baseline).toBe('6000.1.2f1');
    expect(result.editor.current).toBe('6000.1.3f1');
    expect(result.editor.action).toContain('upgrade guide');
    expect(result.actions.length).toBeGreaterThan(0);
    expect(result.baselinesUpdated).toContain('version-baselines/unity-editor-version.txt');
    expect(readFileSync(join(fixture.baselineDir, 'unity-editor-version.txt'), 'utf8').trim()).toBe('6000.1.3f1');
  });

  test('package add/remove/bump are reported and the snapshot is updated', () => {
    const fixture = makeFixture();
    writeBaselines(fixture, {
      editor: '6000.1.2f1',
      packages: { 'com.unity.pipeline': '0.4.2', 'com.unity.oldpkg': '1.0.0' },
    });
    writeFileSync(
      join(fixture.projectRoot, 'Packages', 'manifest.json'),
      JSON.stringify({
        dependencies: { 'com.unity.pipeline': '0.5.0-exp.1', 'com.unity.textmeshpro': '3.0.6' },
      })
    );

    const result = runVersionDrift(options(fixture));

    expect(result.packages.status).toBe('changed');
    expect(result.packages.added).toEqual(['com.unity.textmeshpro']);
    expect(result.packages.removed).toEqual(['com.unity.oldpkg']);
    expect(result.packages.bumped).toEqual([{ name: 'com.unity.pipeline', from: '0.4.2', to: '0.5.0-exp.1' }]);
    expect(result.packages.action).toContain('com.unity.pipeline');
    const snapshot = JSON.parse(readFileSync(join(fixture.baselineDir, 'package-versions.json'), 'utf8'));
    expect(snapshot.packages['com.unity.pipeline']).toBe('0.5.0-exp.1');
    expect(snapshot.packages['com.unity.oldpkg']).toBeUndefined();
  });

  test('absent baselines are created without an action', () => {
    const fixture = makeFixture();

    const result = runVersionDrift(options(fixture));

    expect(result.editor.status).toBe('baseline_created');
    expect(result.packages.status).toBe('baseline_created');
    expect(result.actions).toEqual([]);
    expect(result.baselinesUpdated).toContain('version-baselines/unity-editor-version.txt');
    expect(result.baselinesUpdated).toContain('version-baselines/package-versions.json');
    expect(existsSync(join(fixture.baselineDir, 'unity-editor-version.txt'))).toBe(true);
    expect(existsSync(join(fixture.baselineDir, 'package-versions.json'))).toBe(true);
  });

  test('a malformed manifest fails soft and leaves the baseline untouched', () => {
    const fixture = makeFixture();
    writeBaselines(fixture, { editor: '6000.1.2f1', packages: CURRENT_PACKAGES });
    writeFileSync(join(fixture.projectRoot, 'Packages', 'manifest.json'), '{ not json');

    const result = runVersionDrift(options(fixture));

    expect(result.packages.status).toBe('unknown');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.editor.status).toBe('unchanged');
    // The pre-existing baseline is not overwritten by a malformed read.
    const snapshot = JSON.parse(readFileSync(join(fixture.baselineDir, 'package-versions.json'), 'utf8'));
    expect(snapshot.packages).toEqual(CURRENT_PACKAGES);
  });

  test('present-but-malformed project files report unknown, not "no project files"', () => {
    const fixture = makeFixture();
    writeFileSync(join(fixture.projectRoot, 'ProjectSettings', 'ProjectVersion.txt'), 'not a version file\n');
    writeFileSync(join(fixture.projectRoot, 'Packages', 'manifest.json'), '{ not json');

    const result = runVersionDrift(options(fixture));

    expect(result.status).toBe('unknown');
    expect(result.summary).toContain('Version state unknown');
    expect(result.summary).not.toContain('No Unity project files found');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.report).toContain('[Editor] unknown');
    expect(result.report).toContain('[Packages] unknown');
  });

  test('genuinely absent project files report the no-project-files wording', () => {
    const fixture = makeFixture();
    rmSync(join(fixture.projectRoot, 'ProjectSettings', 'ProjectVersion.txt'));
    rmSync(join(fixture.projectRoot, 'Packages', 'manifest.json'));

    const result = runVersionDrift(options(fixture));

    expect(result.status).toBe('unavailable');
    expect(result.summary).toBe('No Unity project files found under the project root');
  });
});

describe('version-drift: CLI drift', () => {
  test('an absent CLI reports unavailable without throwing', () => {
    const fixture = makeFixture();
    unchangedBaselines(fixture);

    const result = runVersionDrift(options(fixture));

    expect(result.cli.status).toBe('unavailable');
    expect(result.cli.available).toBe(false);
    expect(result.errors).toEqual([]);
    expect(result.route).toBe('offline');
  });

  test('a CLI version change diffs the command catalog and surfaces docs', () => {
    const fixture = makeFixture();
    unchangedBaselines(fixture);
    writeBaselines(fixture, { cliVersion: '0.1.0-beta.3', cliCommands: ['compile', 'test'] });
    writeText(
      join(fixture.opencodeDir, 'context', 'unity-3d', 'commands.md'),
      '# Commands\n\nRun `unity command run_tests` to test.\n'
    );

    const probe: CliProbe = {
      version: () => ({ available: true, version: '0.1.0-beta.4' }),
      commands: () => ['compile', 'doctor', 'run'],
    };
    const result = runVersionDrift(options(fixture, { cliCommand: 'unity', cliProbe: probe }));

    expect(result.route).toBe('batch');
    expect(result.cli.status).toBe('changed');
    expect(result.cli.commandsAdded).toEqual(['doctor', 'run']);
    expect(result.cli.commandsRemoved).toEqual(['test']);
    expect(result.cli.actionFiles).toContain('context/unity-3d/commands.md');
    expect(result.cli.action).toContain('doctor');
    expect(result.report).toContain('→ Updated context files: context/unity-3d/commands.md');
    expect(readFileSync(join(fixture.baselineDir, 'unity-cli-version.txt'), 'utf8').trim()).toBe('0.1.0-beta.4');
    const catalog = JSON.parse(readFileSync(join(fixture.baselineDir, 'unity-cli-commands.json'), 'utf8'));
    expect(catalog.commands).toEqual(['compile', 'doctor', 'run']);
  });

  test('an unchanged CLI captures a missing command catalog', () => {
    const fixture = makeFixture();
    unchangedBaselines(fixture);
    writeBaselines(fixture, { cliVersion: '0.1.0-beta.4' });

    const probe: CliProbe = {
      version: () => ({ available: true, version: '0.1.0-beta.4' }),
      commands: () => ['compile', 'run'],
    };
    const result = runVersionDrift(options(fixture, { cliCommand: 'unity', cliProbe: probe }));

    expect(result.cli.status).toBe('unchanged');
    expect(result.cli.commandCount).toBe(2);
    expect(result.baselinesUpdated).toContain('version-baselines/unity-cli-commands.json');
    const catalog = JSON.parse(readFileSync(join(fixture.baselineDir, 'unity-cli-commands.json'), 'utf8'));
    expect(catalog.commands).toEqual(['compile', 'run']);
  });

  test('an unchanged CLI captures no catalog', () => {
    const fixture = makeFixture();
    unchangedBaselines(fixture);
    writeBaselines(fixture, { cliVersion: '0.1.0-beta.4', cliCommands: ['compile'] });

    let commandsCalled = false;
    const probe: CliProbe = {
      version: () => ({ available: true, version: '0.1.0-beta.4' }),
      commands: () => {
        commandsCalled = true;
        return ['compile'];
      },
    };
    const result = runVersionDrift(options(fixture, { cliCommand: 'unity', cliProbe: probe }));

    expect(result.cli.status).toBe('unchanged');
    expect(commandsCalled).toBe(false);
  });

  test('malformed CLI catalog output fails soft', () => {
    const fixture = makeFixture();
    unchangedBaselines(fixture);
    writeBaselines(fixture, { cliVersion: '0.1.0-beta.3', cliCommands: ['compile'] });

    const probe: CliProbe = {
      version: () => ({ available: true, version: '0.1.0-beta.4' }),
      commands: () => null,
    };
    const result = runVersionDrift(options(fixture, { cliCommand: 'unity', cliProbe: probe }));

    expect(result.cli.status).toBe('changed');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.cli.action).toBeDefined();
  });
});

describe('version-drift: output contract', () => {
  test('the runtime emits only envelope keys plus declared outputs', () => {
    const fixture = makeFixture();
    unchangedBaselines(fixture);
    const commandPath = join(resolve(import.meta.dir, '..'), 'xdomains', 'game-dev', 'unity-3d', 'command', 'version-drift.md');
    const fm = parseFrontmatter(readFileSync(commandPath, 'utf8'));
    const outputs = (fm.outputs ?? {}) as Record<string, unknown>;
    const allowed = new Set<string>([...ENVELOPE_KEYS, ...Object.keys(outputs)]);

    const result = runVersionDrift(options(fixture));
    for (const key of Object.keys(result)) expect(allowed.has(key)).toBe(true);
    expect(fm.family).toBe('sense');
    expect(fm.mode).toBe('both');
  });
});

describe('version-drift: cadence', () => {
  test('--if-due skips a fresh run and runs once the window lapses', () => {
    const fixture = makeFixture();
    unchangedBaselines(fixture);

    // First run (default) always runs and records the timestamp.
    const first = runVersionDrift(options(fixture));
    expect(first.cadence.skipped).toBe(false);
    expect(first.status).toBe('observed_locally');
    const lastRun = JSON.parse(readFileSync(join(fixture.baselineDir, 'last-run.json'), 'utf8'));
    expect(lastRun.lastRunUtc).toBe(T0);

    // Within the 24h window, --if-due skips and does not move the timestamp.
    const fresh = runVersionDrift(
      options(fixture, { ifDue: true, now: '2026-09-21T01:00:00.000Z' })
    );
    expect(fresh.cadence.skipped).toBe(true);
    expect(fresh.status).toBe('skipped');
    expect(fresh.editor.status).toBe('not_checked');
    expect(fresh.report).toContain('Not due');
    expect(JSON.parse(readFileSync(join(fixture.baselineDir, 'last-run.json'), 'utf8')).lastRunUtc).toBe(T0);

    // A default run ignores the window and always runs.
    const forced = runVersionDrift(
      options(fixture, { ifDue: false, now: '2026-09-21T02:00:00.000Z' })
    );
    expect(forced.cadence.skipped).toBe(false);
    expect(forced.status).toBe('observed_locally');

    // Past the window (24h after the last default run), --if-due runs again.
    const due = runVersionDrift(
      options(fixture, { ifDue: true, now: '2026-09-22T03:00:00.000Z' })
    );
    expect(due.cadence.skipped).toBe(false);
    expect(due.status).toBe('observed_locally');
    expect(JSON.parse(readFileSync(join(fixture.baselineDir, 'last-run.json'), 'utf8')).lastRunUtc).toBe(
      '2026-09-22T03:00:00.000Z'
    );
  });

  test('a future last-run bases nextDueUtc on now, not the skewed stamp', () => {
    const fixture = makeFixture();
    unchangedBaselines(fixture);
    writeText(
      join(fixture.baselineDir, 'last-run.json'),
      JSON.stringify({ schemaVersion: 1, lastRunUtc: '2026-09-23T00:00:00.000Z' })
    );

    const now = '2026-09-21T00:00:00.000Z';
    const result = runVersionDrift(options(fixture, { now }));

    expect(result.cadence.nextDueUtc).toBe('2026-09-22T00:00:00.000Z');
    expect(Date.parse(result.cadence.nextDueUtc as string)).toBeGreaterThan(Date.parse(now));
  });
});
