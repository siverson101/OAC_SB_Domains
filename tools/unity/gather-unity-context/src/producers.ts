import { nowIso } from '../../../shared/io';
import { run } from '../../../shared/toolchain';
import { selectRoute } from '../../../shared/tool-routing';
import type { CliEnvelope } from './types';

const CLI_FLAGS = ['--json', '--no-banner', '--quiet', '--non-interactive'];

export function runCli(cliCommand: string, args: string[], timeout = 30000): CliEnvelope {
  const res = run(cliCommand, args, { timeout });
  let parsed: { success?: boolean; command?: string; data?: unknown; errors?: unknown; warnings?: unknown } | null = null;
  try {
    parsed = JSON.parse(res.stdout);
  } catch {
    parsed = null;
  }
  return {
    success: parsed?.success === true && res.ok,
    command: parsed?.command,
    route: selectRoute({ bridge: null, cliAvailable: parsed != null }).route,
    data: (parsed?.data as never) ?? null,
    errors: (parsed?.errors as { code?: string; message?: string }[]) ?? (res.ok ? [] : [{ message: res.stderr || res.stdout || `exit ${res.status}` }]),
    warnings: (parsed?.warnings as string[]) ?? [],
    raw: res.stdout || res.stderr,
  };
}

export function inventoryCommands(projectRoot: string, cliCommand: string): Record<string, unknown> {
  const env = runCli(cliCommand, ['command', ...CLI_FLAGS, '--project-path', projectRoot, '--detail', 'full']);
  const commands = Array.isArray(env.data)
    ? (env.data as Record<string, unknown>[])
    : ((env.data as { commands?: Record<string, unknown>[] } | null)?.commands ?? []);
  const status = env.success ? 'observed_locally' : 'unavailable';
  return {
    commandList: {
      schemaVersion: 1,
      generatedAt: nowIso(),
      status,
      count: commands.length,
      commands,
      errors: env.errors,
    },
    commandSchema: {
      schemaVersion: 1,
      generatedAt: nowIso(),
      status,
      help: commands.map((c) => ({ name: c.name, description: c.description, tag: c.tag })),
      errors: env.errors,
    },
  };
}

export function inspectPipeline(cliCommand: string): Record<string, unknown> {
  const env = runCli(cliCommand, ['pipeline', 'list', ...CLI_FLAGS]);
  return {
    schemaVersion: 1,
    generatedAt: nowIso(),
    status: env.success ? 'observed_locally' : 'unavailable',
    summary: (env.data as { summary?: unknown } | null)?.summary ?? null,
    instances: (env.data as { instances?: unknown } | null)?.instances ?? [],
    latestVersion: (env.data as { latestVersion?: unknown } | null)?.latestVersion ?? null,
    errors: env.errors,
  };
}

export function inspectMcp(projectRoot: string, cliCommand: string): Record<string, unknown> {
  // `unity mcp` starts a stdio server, so never invoke it bare. `configure --list`
  // reports the supported clients and their config paths without side effects.
  void projectRoot;
  const env = runCli(cliCommand, ['mcp', 'configure', '--list', ...CLI_FLAGS]);
  const clients = Array.isArray(env.data) ? (env.data as { key?: string; status?: string }[]) : [];
  const configured = clients
    .filter((c) => c.status && c.status !== 'file-not-found' && c.status !== 'no-file')
    .map((c) => c.key);
  return {
    schemaVersion: 1,
    generatedAt: nowIso(),
    status: env.success ? 'observed_locally' : 'unavailable',
    supportedClients: clients.length,
    configuredClients: configured,
    clients,
    errors: env.errors,
  };
}
