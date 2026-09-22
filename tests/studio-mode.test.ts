import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dir, '..');
const unity3dDir = join(repoRoot, 'xdomains', 'game-dev', 'unity-3d');
const script = join(unity3dDir, 'scripts', 'unity-studio-mode.js');

function freshOpencode(): string {
  const dir = mkdtempSync(join(tmpdir(), 'oac-studio-mode-'));
  mkdirSync(join(dir, 'config'), { recursive: true });
  writeFileSync(join(dir, 'config', 'agent-metadata.json'), '{\n  "agents": {}\n}\n');
  writeFileSync(
    join(dir, 'unity-studio.json'),
    JSON.stringify({ schemaVersion: 1, studioMode: 'lean', reviewIntensity: 'full' })
  );
  return dir;
}

function swap(dir: string, mode?: string) {
  const args = [script, '--opencode-dir', dir];
  if (mode !== undefined) args.push('--mode', mode);
  return spawnSync(process.execPath, args, { encoding: 'utf8' });
}

function backupDirs(dir: string): string[] {
  const root = join(dir, 'backups', 'unity-studio-mode');
  return existsSync(root) ? readdirSync(root).map((name) => join(root, name)) : [];
}

function metadataAgentIds(dir: string): string[] {
  const metadata = JSON.parse(readFileSync(join(dir, 'config', 'agent-metadata.json'), 'utf8')) as {
    agents?: Record<string, unknown>;
  };
  return Object.keys(metadata.agents ?? {}).sort();
}

describe('unity-studio-mode swap', () => {
  test('round-trips lean -> full -> lean preserving shared assets', () => {
    const dir = freshOpencode();
    try {
      const first = swap(dir, 'lean');
      expect(first.status).toBe(0);
      expect(existsSync(join(dir, 'agent', 'unity-3d-orchestrator.md'))).toBe(true);
      expect(existsSync(join(dir, 'agent', 'subagents', 'unity', 'implementer.md'))).toBe(true);

      const leanMetadata = metadataAgentIds(dir);
      expect(leanMetadata).toContain('unity-3d-orchestrator');
      expect(leanMetadata).toContain('implementer');
      expect(leanMetadata).not.toContain('full-studio-orchestrator');

      mkdirSync(join(dir, 'project-data'), { recursive: true });
      writeFileSync(join(dir, 'project-data', 'sentinel.json'), '{"keep":true}\n');
      const recipeBefore = readFileSync(join(dir, 'recipes', 'unity-change-loop.json'), 'utf8');
      const commandBefore = readFileSync(join(dir, 'command', 'unity-implement.md'), 'utf8');
      const contextBefore = readFileSync(join(dir, 'context', 'unity-3d', 'navigation.md'), 'utf8');
      const abilityCommandBefore = readFileSync(join(dir, 'command', 'version-matrix.md'), 'utf8');

      const toFull = swap(dir, 'full');
      expect(toFull.status).toBe(0);
      expect(existsSync(join(dir, 'agent', 'full-studio', 'full-studio-orchestrator.md'))).toBe(true);
      expect(existsSync(join(dir, 'agent', 'unity-3d-orchestrator.md'))).toBe(false);
      expect(existsSync(join(dir, 'agent', 'subagents'))).toBe(false);
      expect(JSON.parse(readFileSync(join(dir, 'unity-studio.json'), 'utf8')).studioMode).toBe('full');

      const fullMetadata = metadataAgentIds(dir);
      expect(fullMetadata).toContain('full-studio-orchestrator');
      expect(fullMetadata).not.toContain('unity-3d-orchestrator');
      expect(fullMetadata).not.toContain('implementer');

      const leanBackup = backupDirs(dir).find((backup) =>
        existsSync(join(backup, 'agent', 'unity-3d-orchestrator.md'))
      );
      expect(leanBackup).toBeDefined();
      expect(JSON.parse(readFileSync(join(leanBackup!, 'unity-studio.json'), 'utf8')).studioMode).toBe('lean');

      const fullRegistry = JSON.parse(readFileSync(join(dir, 'registry.json'), 'utf8'));
      expect(fullRegistry.studioConfig.studioMode).toBe('full');
      expect(fullRegistry.counts.agents).toBe(1);
      expect(fullRegistry.counts.subagents).toBe(17);

      expect(readFileSync(join(dir, 'project-data', 'sentinel.json'), 'utf8')).toBe('{"keep":true}\n');
      expect(readFileSync(join(dir, 'recipes', 'unity-change-loop.json'), 'utf8')).toBe(recipeBefore);
      expect(readFileSync(join(dir, 'command', 'unity-implement.md'), 'utf8')).toBe(commandBefore);

      const back = swap(dir, 'lean');
      expect(back.status).toBe(0);
      expect(existsSync(join(dir, 'agent', 'unity-3d-orchestrator.md'))).toBe(true);
      expect(existsSync(join(dir, 'agent', 'full-studio'))).toBe(false);
      expect(JSON.parse(readFileSync(join(dir, 'unity-studio.json'), 'utf8')).studioMode).toBe('lean');
      expect(JSON.parse(readFileSync(join(dir, 'unity-studio.json'), 'utf8')).reviewIntensity).toBe('full');

      const fullBackup = backupDirs(dir).find((backup) =>
        existsSync(join(backup, 'agent', 'full-studio', 'full-studio-orchestrator.md'))
      );
      expect(fullBackup).toBeDefined();

      expect(readFileSync(join(dir, 'project-data', 'sentinel.json'), 'utf8')).toBe('{"keep":true}\n');
      expect(readFileSync(join(dir, 'command', 'unity-implement.md'), 'utf8')).toBe(commandBefore);
      expect(readFileSync(join(dir, 'context', 'unity-3d', 'navigation.md'), 'utf8')).toBe(contextBefore);
      expect(readFileSync(join(dir, 'command', 'version-matrix.md'), 'utf8')).toBe(abilityCommandBefore);

      const commandFiles = readdirSync(join(dir, 'command'));
      expect(commandFiles.some((file) => file.startsWith('unity-3d_'))).toBe(false);
      expect(commandFiles).toContain('unity-studio-mode.md');
      expect(commandFiles).toContain('coordination-board.md');

      const backMetadata = metadataAgentIds(dir);
      expect(backMetadata).toContain('unity-3d-orchestrator');
      expect(backMetadata).toContain('implementer');
      expect(backMetadata).not.toContain('full-studio-orchestrator');

      const leanRegistry = JSON.parse(readFileSync(join(dir, 'registry.json'), 'utf8'));
      expect(leanRegistry.studioConfig.studioMode).toBe('lean');
      expect(leanRegistry.counts.agents).toBe(1);
      expect(leanRegistry.counts.subagents).toBe(7);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('installing the same mode is a clean re-apply', () => {
    const dir = freshOpencode();
    try {
      expect(swap(dir, 'lean').status).toBe(0);
      const res = swap(dir, 'lean');
      expect(res.status).toBe(0);
      expect(res.stdout).toContain('reapplied');

      expect(readdirSync(join(dir, 'agent')).some((file) => file.startsWith('unity-3d_'))).toBe(false);
      expect(readdirSync(join(dir, 'command')).some((file) => file.startsWith('unity-3d_'))).toBe(false);
      expect(JSON.parse(readFileSync(join(dir, 'unity-studio.json'), 'utf8')).studioMode).toBe('lean');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('an unknown mode refuses loudly and writes nothing', () => {
    const dir = freshOpencode();
    try {
      const res = swap(dir, 'wide');
      expect(res.status).toBe(2);
      expect(res.stderr).toContain('Unknown studio mode');
      expect(existsSync(join(dir, 'agent'))).toBe(false);
      expect(existsSync(join(dir, 'command'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('an absent mode refuses loudly and writes nothing', () => {
    const dir = freshOpencode();
    try {
      const res = spawnSync(process.execPath, [script, '--opencode-dir', dir], { encoding: 'utf8' });
      expect(res.status).toBe(2);
      expect(res.stderr).toContain('no studio mode given');
      expect(existsSync(join(dir, 'agent'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('a bare --mode refuses loudly and writes nothing', () => {
    const dir = freshOpencode();
    try {
      const res = spawnSync(process.execPath, [script, '--opencode-dir', dir, '--mode'], { encoding: 'utf8' });
      expect(res.status).toBe(2);
      expect(res.stderr).toContain('requires a value');
      expect(existsSync(join(dir, 'agent'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('the ability and script are declared in the manifest', () => {
    const manifest = JSON.parse(readFileSync(join(unity3dDir, 'sb-domain.json'), 'utf8')) as {
      abilities?: string[];
      scripts?: string[];
    };
    expect(manifest.abilities).toContain('unity-studio-mode');
    expect(manifest.scripts).toContain('scripts/unity-studio-mode.js');
    expect(existsSync(join(unity3dDir, 'command', 'unity-studio-mode.md'))).toBe(true);
  });
});
