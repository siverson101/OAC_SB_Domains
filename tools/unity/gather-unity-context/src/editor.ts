import { run } from '../../../shared/toolchain';
import { runCli } from './producers';

export interface EditorInstance {
  project?: string;
  pid?: number;
  port?: number;
  state?: string;
  version?: string;
}

function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function findLiveInstance(projectRoot: string, cliCommand: string): EditorInstance | null {
  const env = runCli(cliCommand, [
    'status',
    '--json',
    '--no-banner',
    '--quiet',
    '--non-interactive',
    '--project-path',
    projectRoot,
  ]);
  const instances = (env.data as { instances?: EditorInstance[] } | null)?.instances ?? [];
  return instances.find((i) => (i.project ?? '').toLowerCase() === projectRoot.toLowerCase()) ?? null;
}

export function startEditor(projectRoot: string, cliCommand: string, timeoutMs = 300000): EditorInstance | null {
  // `unity open` launches the Editor and returns; `--args -automated` asks it to open
  // without blocking on interactive dialogs.
  run(
    cliCommand,
    ['open', projectRoot, '--args', '-automated', '--no-banner', '--quiet', '--non-interactive'],
    { timeout: 120000 }
  );

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const instance = findLiveInstance(projectRoot, cliCommand);
    if (instance && instance.state === 'ready') return instance;
    sleep(3000);
  }
  return findLiveInstance(projectRoot, cliCommand);
}

export function stopEditor(instance: EditorInstance): boolean {
  const pid = instance.pid;
  if (!pid) return false;
  if (process.platform === 'win32') {
    return run('taskkill', ['/PID', String(pid), '/F', '/T']).ok;
  }
  return run('kill', [String(pid)]).ok;
}
