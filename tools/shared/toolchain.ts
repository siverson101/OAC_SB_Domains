import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { readJson, readText } from './io';
import type { ProjectInfo, UnityEnv } from './types';

export interface CommandResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  status: number | null;
}

export function run(cmd: string, args: string[], opts: { cwd?: string; timeout?: number } = {}): CommandResult {
  const res = spawnSync(cmd, args, {
    cwd: opts.cwd,
    encoding: 'utf8',
    timeout: opts.timeout ?? 20000,
    windowsHide: true,
  });
  return {
    ok: res.status === 0,
    stdout: (res.stdout ?? '').trim(),
    stderr: (res.stderr ?? '').trim(),
    status: res.status,
  };
}

export function findExecutable(name: string): string | null {
  const finder = process.platform === 'win32' ? 'where' : 'which';
  const res = run(finder, [name]);
  if (!res.ok || !res.stdout) return null;
  return res.stdout.split(/\r?\n/)[0]?.trim() || null;
}

export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

export function unityVersionFromFile(projectRoot: string): string | null {
  const text = readText(join(projectRoot, 'ProjectSettings', 'ProjectVersion.txt'));
  if (!text) return null;
  const match = text.match(/m_EditorVersion:\s*(\S+)/);
  return match ? match[1] : null;
}

export function activeInputHandler(projectRoot: string): number | null {
  const text = readText(join(projectRoot, 'ProjectSettings', 'ProjectSettings.asset'));
  if (!text) return null;
  const match = text.match(/^\s*activeInputHandler:\s*(\d+)\s*$/m);
  return match ? Number(match[1]) : null;
}

export interface ToolchainProbe {
  cliPath: string | null;
  cliVer: string | null;
  env: UnityEnv | null;
  info: ProjectInfo | null;
  unityVer: string | null;
}

function parseData<T>(text: string): T | null {
  try {
    const parsed = JSON.parse(text) as { data?: T };
    return parsed?.data ?? null;
  } catch {
    return null;
  }
}

export function probeUnityCli(projectRoot: string, cliCommand = 'unity'): Pick<ToolchainProbe, 'cliPath' | 'cliVer' | 'env' | 'info'> {
  const cliPath = findExecutable(cliCommand) ?? (cliCommand !== 'unity' ? cliCommand : null);
  let cliVer: string | null = null;
  let env: UnityEnv | null = null;
  let info: ProjectInfo | null = null;

  const ver = run(cliCommand, ['--version']);
  if (ver.ok) cliVer = stripAnsi(ver.stdout || ver.stderr) || null;

  const envRes = run(cliCommand, ['env', '--json', '--no-banner', '--quiet']);
  if (envRes.ok) env = parseData<UnityEnv>(envRes.stdout);

  const infoRes = run(
    cliCommand,
    ['projects', 'info', projectRoot, '--json', '--no-banner', '--quiet', '--non-interactive'],
    { timeout: 30000 }
  );
  if (infoRes.ok) info = parseData<ProjectInfo>(infoRes.stdout);

  return { cliPath, cliVer, env, info };
}

export function probeToolchain(projectRoot: string, cliCommand = 'unity'): ToolchainProbe {
  const cli = probeUnityCli(projectRoot, cliCommand);
  const unityVer = cli.info?.version ?? unityVersionFromFile(projectRoot);
  return { ...cli, unityVer };
}

export function readProjectInfoFallback(projectRoot: string): ProjectInfo | null {
  const version = unityVersionFromFile(projectRoot);
  if (!version) return null;
  return { path: projectRoot, version };
}
