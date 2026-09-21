// version-drift — offline Editor/package drift plus a best-effort Unity CLI probe.
//
// Tickets 01–03. The Editor and package reads are offline; the CLI probe runs
// only when `unity` resolves. The ability writes *only* the baseline files under
// `project-data/version-baselines/`; anything needing judgement is surfaced as
// ACTION REQUIRED, never applied silently.
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { asArray, asRecord, str } from '../../../shared/json-helpers';
import { fileExists, readJson, readText, toPosix, writeJson } from '../../../shared/io';
import { editorVersionInfo, findExecutable, run, stripAnsi } from '../../../shared/toolchain';
import { baselineDir, baselineRelPath, makeResult } from './shared';
import type {
  CliProbe,
  CliVersionProbe,
  VersionDriftBase,
  VersionDriftChange,
  VersionDriftOptions,
  VersionDriftStatus,
} from './types';

const EDITOR_BASELINE = 'unity-editor-version.txt';
const PACKAGE_BASELINE = 'package-versions.json';
const CLI_VERSION_BASELINE = 'unity-cli-version.txt';
const CLI_COMMANDS_BASELINE = 'unity-cli-commands.json';
const LAST_RUN = 'last-run.json';
const CLI_COMMAND_DOC_PATTERN = /unity\s+command\b/i;
const CLI_DOC_SKIP_DIRS = new Set(['node_modules', '.git', 'scripts', 'project-data', 'dist', 'Library', 'Temp']);

export interface EditorSection {
  status: VersionDriftChange;
  current: string | null;
  baseline: string | null;
  revision: string | null;
  updated: string[];
  action: string | null;
}

export interface PackageBump {
  name: string;
  from: string;
  to: string;
}

export interface PackagesSection {
  status: VersionDriftChange;
  count: number | null;
  added: string[];
  removed: string[];
  bumped: PackageBump[];
  updated: string[];
  action: string | null;
}

export interface CliSection {
  status: VersionDriftChange;
  available: boolean;
  current: string | null;
  baseline: string | null;
  commandsAdded: string[];
  commandsRemoved: string[];
  commandCount: number | null;
  actionFiles: string[];
  updated: string[];
  action: string | null;
}

export interface CadenceSection {
  ifDue: boolean;
  maxAgeHours: number;
  skipped: boolean;
  lastRunUtc: string | null;
  nowUtc: string;
  nextDueUtc: string | null;
}

export interface VersionDriftResult extends VersionDriftBase {
  cadence: CadenceSection;
  editor: EditorSection;
  packages: PackagesSection;
  cli: CliSection;
  actions: string[];
  baselinesUpdated: string[];
  report: string;
}

// ---------------------------------------------------------------------------
// Default CLI probe (shells out to `unity`; never invokes bare `unity mcp`)
// ---------------------------------------------------------------------------

function nameOf(entry: unknown): string | null {
  if (typeof entry === 'string') return entry.trim() || null;
  const obj = asRecord(entry);
  if (!obj) return null;
  for (const key of ['name', 'id', 'path', 'command']) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

// The CLI JSON envelope is standardized but tolerant of shape: `data` may be an
// array of command objects, or an object carrying a `commands` array.
function commandNamesFrom(parsed: unknown): string[] | null {
  const root = asRecord(parsed);
  const container = root?.data ?? root?.result ?? root?.commands ?? parsed;
  const entries = Array.isArray(container) ? container : asArray(asRecord(container)?.commands);
  const names = entries.map(nameOf).filter((name): name is string => name !== null);
  const unique = Array.from(new Set(names)).sort();
  return unique.length > 0 ? unique : null;
}

export const defaultCliProbe: CliProbe = {
  version(command: string): CliVersionProbe {
    if (!findExecutable(command)) return { available: false, version: null };
    const res = run(command, ['--version'], { timeout: 10000 });
    if (!res.ok) return { available: true, version: null };
    const text = stripAnsi(res.stdout || res.stderr).split(/\r?\n/)[0]?.trim() ?? '';
    return { available: true, version: text || null };
  },
  commands(command: string): string[] | null {
    const res = run(
      command,
      ['command', '--format', 'json', '--no-banner', '--quiet', '--non-interactive'],
      { timeout: 30000 }
    );
    if (!res.ok || !res.stdout) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(res.stdout);
    } catch {
      return null;
    }
    return commandNamesFrom(parsed);
  },
};

// ---------------------------------------------------------------------------
// Baseline readers/writers
// ---------------------------------------------------------------------------

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readBaselineText(path: string): string | null {
  const text = readText(path);
  return text && text.trim() !== '' ? text.trim() : null;
}

function writeBaselineText(path: string, value: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value.endsWith('\n') ? value : `${value}\n`);
}

function readLastRun(path: string): string | null {
  return str(asRecord(readJson<unknown>(path)), 'lastRunUtc');
}

function readPackageBaseline(path: string): { present: boolean; packages: Record<string, string> | null } {
  if (!fileExists(path)) return { present: false, packages: null };
  const packages = asRecord(asRecord(readJson<unknown>(path))?.packages);
  if (!packages) return { present: true, packages: null };
  const out: Record<string, string> = {};
  for (const [name, version] of Object.entries(packages)) if (typeof version === 'string') out[name] = version;
  return { present: true, packages: out };
}

function readCommandsBaseline(path: string): { present: boolean; commands: string[] | null } {
  if (!fileExists(path)) return { present: false, commands: null };
  const raw = readJson<unknown>(path);
  const arr = asRecord(raw)?.commands ?? (Array.isArray(raw) ? raw : undefined);
  if (!Array.isArray(arr)) return { present: true, commands: null };
  return { present: true, commands: arr.filter((item): item is string => typeof item === 'string') };
}

function writeCommandsBaseline(options: VersionDriftOptions, commands: string[], cliVersion: string): void {
  writeJson(join(baselineDir(options), CLI_COMMANDS_BASELINE), {
    schemaVersion: 1,
    generatedAt: options.now,
    cliVersion,
    commands: [...commands].sort(),
  });
}

// ---------------------------------------------------------------------------
// Cadence
// ---------------------------------------------------------------------------

function computeCadence(options: VersionDriftOptions, lastRunUtc: string | null): CadenceSection {
  const nowMs = Date.parse(options.now);
  const lastMs = lastRunUtc ? Date.parse(lastRunUtc) : Number.NaN;
  const windowMs = options.maxAgeHours * 3_600_000;
  const hasValidLast = Number.isFinite(lastMs);
  // A last-run in the future (clock skew) is treated as fresh so we never
  // re-run in a tight loop; an unparseable timestamp is not fresh.
  const fresh = hasValidLast && Number.isFinite(nowMs) && nowMs - lastMs < windowMs;
  return {
    ifDue: options.ifDue,
    maxAgeHours: options.maxAgeHours,
    skipped: options.ifDue && fresh,
    lastRunUtc,
    nowUtc: options.now,
    nextDueUtc: hasValidLast ? new Date(lastMs + windowMs).toISOString() : null,
  };
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

function detectEditor(options: VersionDriftOptions, errors: string[]): EditorSection {
  const section: EditorSection = {
    status: 'unknown',
    current: null,
    baseline: null,
    revision: null,
    updated: [],
    action: null,
  };
  const info = editorVersionInfo(options.projectRoot);
  section.current = info.version;
  section.revision = info.revision;

  if (!info.version) {
    if (fileExists(join(options.projectRoot, 'ProjectSettings', 'ProjectVersion.txt'))) {
      section.status = 'unknown';
      errors.push('ProjectSettings/ProjectVersion.txt is present but has no m_EditorVersion line');
    } else {
      section.status = 'unavailable';
    }
    return section;
  }

  const path = join(baselineDir(options), EDITOR_BASELINE);
  const baseline = readBaselineText(path);
  section.baseline = baseline;
  if (baseline === null) {
    writeBaselineText(path, info.version);
    section.status = 'baseline_created';
    section.updated.push(baselineRelPath(EDITOR_BASELINE));
  } else if (baseline === info.version) {
    section.status = 'unchanged';
  } else {
    writeBaselineText(path, info.version);
    section.status = 'changed';
    section.updated.push(baselineRelPath(EDITOR_BASELINE));
    section.action = `Review the Unity ${info.version} upgrade guide for breaking changes (deprecations, API removals, behaviour changes) and the project's deprecation checks.`;
  }
  return section;
}

function detectPackages(options: VersionDriftOptions, errors: string[]): PackagesSection {
  const section: PackagesSection = {
    status: 'unknown',
    count: null,
    added: [],
    removed: [],
    bumped: [],
    updated: [],
    action: null,
  };
  const manifestPath = join(options.projectRoot, 'Packages', 'manifest.json');
  if (!fileExists(manifestPath)) {
    section.status = 'unavailable';
    return section;
  }
  const dependencies = asRecord(asRecord(readJson<unknown>(manifestPath))?.dependencies);
  if (!dependencies) {
    section.status = 'unknown';
    errors.push('Packages/manifest.json is malformed or has no dependencies object; baseline left untouched');
    return section;
  }

  const current: Record<string, string> = {};
  for (const [name, value] of Object.entries(dependencies)) current[name] = String(value);
  section.count = Object.keys(current).length;

  const path = join(baselineDir(options), PACKAGE_BASELINE);
  if (!fileExists(path)) {
    writeJson(path, { schemaVersion: 1, generatedAt: options.now, packages: current });
    section.status = 'baseline_created';
    section.updated.push(baselineRelPath(PACKAGE_BASELINE));
    return section;
  }

  const baseline = readPackageBaseline(path);
  if (baseline.packages === null) {
    section.status = 'unknown';
    errors.push(`version-baselines/${PACKAGE_BASELINE} is malformed; baseline left untouched`);
    return section;
  }

  const base = baseline.packages;
  section.added = Object.keys(current).filter((name) => !(name in base)).sort();
  section.removed = Object.keys(base).filter((name) => !(name in current)).sort();
  section.bumped = Object.keys(current)
    .filter((name) => name in base && base[name] !== current[name])
    .sort()
    .map((name) => ({ name, from: base[name], to: current[name] }));

  if (section.added.length === 0 && section.removed.length === 0 && section.bumped.length === 0) {
    section.status = 'unchanged';
    return section;
  }

  writeJson(path, { schemaVersion: 1, generatedAt: options.now, packages: current });
  section.status = 'changed';
  section.updated.push(baselineRelPath(PACKAGE_BASELINE));
  const pipelineChanged = [...section.added, ...section.removed, ...section.bumped.map((b) => b.name)].includes(
    'com.unity.pipeline'
  );
  if (pipelineChanged) {
    section.action =
      'Review the com.unity.pipeline changelog for breaking changes (detached jobs, eval timeout, /api/exec concurrency) before updating code that uses the Pipeline API.';
  }
  return section;
}

function cliActionText(section: CliSection, from: string, to: string): string {
  const added = section.commandsAdded.length > 0 ? section.commandsAdded.join(', ') : '(none)';
  const removed = section.commandsRemoved.length > 0 ? section.commandsRemoved.join(', ') : '(none)';
  const files = section.actionFiles.length > 0 ? ` Update: ${section.actionFiles.join(', ')}.` : '';
  return `Review CLI command catalog changes for ${from} → ${to} (new: ${added}; removed: ${removed}) and update context files/docs that enumerate Unity CLI commands.${files}`;
}

function detectCli(options: VersionDriftOptions, errors: string[]): CliSection {
  const section: CliSection = {
    status: 'unknown',
    available: false,
    current: null,
    baseline: null,
    commandsAdded: [],
    commandsRemoved: [],
    commandCount: null,
    actionFiles: [],
    updated: [],
    action: null,
  };
  const probe = options.cliProbe ?? defaultCliProbe;
  const probeResult = probe.version(options.cliCommand);
  section.available = probeResult.available;
  if (!probeResult.available) {
    section.status = 'unavailable';
    return section;
  }
  if (!probeResult.version) {
    section.status = 'unknown';
    errors.push(`could not read \`${options.cliCommand} --version\``);
    return section;
  }
  section.current = probeResult.version;

  const versionPath = join(baselineDir(options), CLI_VERSION_BASELINE);
  const baseline = readBaselineText(versionPath);
  section.baseline = baseline;

  if (baseline === null) {
    writeBaselineText(versionPath, probeResult.version);
    section.status = 'baseline_created';
    section.updated.push(baselineRelPath(CLI_VERSION_BASELINE));
    const commands = probe.commands(options.cliCommand);
    if (commands) {
      writeCommandsBaseline(options, commands, probeResult.version);
      section.commandCount = commands.length;
      section.updated.push(baselineRelPath(CLI_COMMANDS_BASELINE));
    } else {
      errors.push('could not capture the Unity command catalog; version baseline recorded');
    }
    return section;
  }

  if (baseline === probeResult.version) {
    section.status = 'unchanged';
    return section;
  }

  writeBaselineText(versionPath, probeResult.version);
  section.status = 'changed';
  section.updated.push(baselineRelPath(CLI_VERSION_BASELINE));

  const commands = probe.commands(options.cliCommand);
  if (!commands) {
    errors.push('Unity CLI version changed but the command catalog could not be captured; review the CLI release notes manually');
    section.action = `Review CLI command catalog changes for ${baseline} → ${probeResult.version} and update context files/docs that enumerate Unity CLI commands.`;
    return section;
  }

  const base = readCommandsBaseline(join(baselineDir(options), CLI_COMMANDS_BASELINE));
  const baselineCommands = base.commands ?? [];
  const currentSet = new Set(commands);
  const baseSet = new Set(baselineCommands);
  section.commandsAdded = commands.filter((command) => !baseSet.has(command)).sort();
  section.commandsRemoved = baselineCommands.filter((command) => !currentSet.has(command)).sort();
  section.commandCount = commands.length;
  writeCommandsBaseline(options, commands, probeResult.version);
  section.updated.push(baselineRelPath(CLI_COMMANDS_BASELINE));
  section.actionFiles = findCliCommandDocs(options.opencodeDir);
  section.action = cliActionText(section, baseline, probeResult.version);
  return section;
}

// Docs that enumerate CLI commands are surfaced, never auto-edited. A bounded,
// read-only scan of the opencode dir; unreadable dirs are skipped.
function findCliCommandDocs(root: string, limit = 25): string[] {
  const found: string[] = [];
  const walk = (dir: string, depth: number): void => {
    if (found.length >= limit || depth > 6) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (found.length >= limit) return;
      if (entry.isDirectory()) {
        if (!CLI_DOC_SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name), depth + 1);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const full = join(dir, entry.name);
      const text = readText(full);
      if (text && CLI_COMMAND_DOC_PATTERN.test(text)) found.push(toPosix(relative(root, full)));
    }
  };
  walk(root, 0);
  return found.sort();
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

function emptyEditor(): EditorSection {
  return { status: 'not_checked', current: null, baseline: null, revision: null, updated: [], action: null };
}

function emptyPackages(): PackagesSection {
  return { status: 'not_checked', count: null, added: [], removed: [], bumped: [], updated: [], action: null };
}

function emptyCli(): CliSection {
  return {
    status: 'not_checked',
    available: false,
    current: null,
    baseline: null,
    commandsAdded: [],
    commandsRemoved: [],
    commandCount: null,
    actionFiles: [],
    updated: [],
    action: null,
  };
}

function isObserved(status: VersionDriftChange): boolean {
  return status === 'unchanged' || status === 'changed' || status === 'baseline_created';
}

function overallStatus(editor: EditorSection, packages: PackagesSection, cli: CliSection): VersionDriftStatus {
  return isObserved(editor.status) || isObserved(packages.status) || isObserved(cli.status)
    ? 'observed_locally'
    : 'unavailable';
}

function summarize(
  status: VersionDriftStatus,
  editor: EditorSection,
  packages: PackagesSection,
  cli: CliSection
): string {
  if (status === 'unavailable') return 'No Unity project files found under the project root';
  const changes: string[] = [];
  if (editor.status === 'changed') changes.push(`Editor ${editor.baseline} → ${editor.current}`);
  if (packages.status === 'changed') {
    changes.push(`${packages.added.length + packages.removed.length + packages.bumped.length} package change(s)`);
  }
  if (cli.status === 'changed') changes.push(`CLI ${cli.baseline} → ${cli.current}`);
  if (changes.length === 0) return `No version drift (Editor ${editor.current ?? 'unknown'})`;
  return `Version drift detected: ${changes.join('; ')}`;
}

// ---------------------------------------------------------------------------
// Report rendering
// ---------------------------------------------------------------------------

function renderEditor(section: EditorSection): string[] {
  const lines: string[] = [];
  switch (section.status) {
    case 'unchanged':
      lines.push(`[Editor] No change (${section.current})`);
      break;
    case 'baseline_created':
      lines.push(`[Editor] Baseline created: ${section.current}`);
      break;
    case 'changed':
      lines.push(`[Editor] Version changed: ${section.baseline} → ${section.current}`);
      break;
    case 'unavailable':
      lines.push('[Editor] unavailable — no ProjectSettings/ProjectVersion.txt');
      break;
    default:
      lines.push('[Editor] unknown — ProjectVersion.txt present but unreadable');
      break;
  }
  for (const file of section.updated) lines.push(`  → Updated ${file}`);
  if (section.action) lines.push(`  → ACTION REQUIRED: ${section.action}`);
  return lines;
}

function renderPackages(section: PackagesSection): string[] {
  const lines: string[] = [];
  switch (section.status) {
    case 'unchanged':
      lines.push(`[Packages] No change (${section.count} package(s))`);
      break;
    case 'baseline_created':
      lines.push(`[Packages] Baseline created (${section.count} package(s))`);
      break;
    case 'changed': {
      const total = section.added.length + section.removed.length + section.bumped.length;
      lines.push(`[Packages] ${total} package(s) changed:`);
      for (const name of section.added) lines.push(`  - ${name}: (added)`);
      for (const name of section.removed) lines.push(`  - ${name}: (removed)`);
      for (const bump of section.bumped) lines.push(`  - ${bump.name}: ${bump.from} → ${bump.to}`);
      break;
    }
    case 'unavailable':
      lines.push('[Packages] unavailable — no Packages/manifest.json');
      break;
    default:
      lines.push('[Packages] unknown — Packages/manifest.json is malformed');
      break;
  }
  for (const file of section.updated) lines.push(`  → Updated ${file}`);
  if (section.action) lines.push(`  → ACTION REQUIRED: ${section.action}`);
  return lines;
}

function renderCli(section: CliSection): string[] {
  const lines: string[] = [];
  switch (section.status) {
    case 'unchanged':
      lines.push(`[CLI] No change (${section.current})`);
      break;
    case 'baseline_created':
      lines.push(`[CLI] Baseline created: ${section.current}`);
      break;
    case 'changed':
      lines.push(`[CLI] Version changed: ${section.baseline} → ${section.current}`);
      lines.push(
        `  - New commands detected: ${section.commandsAdded.length > 0 ? section.commandsAdded.join(', ') : '(none)'}`
      );
      lines.push(
        `  - Removed commands: ${section.commandsRemoved.length > 0 ? section.commandsRemoved.join(', ') : '(none)'}`
      );
      break;
    case 'unavailable':
      lines.push('[CLI] unavailable — no `unity` on PATH');
      break;
    default:
      lines.push('[CLI] unknown — `unity --version` did not return a version');
      break;
  }
  for (const file of section.updated) lines.push(`  → Updated ${file}`);
  if (section.action) lines.push(`  → ACTION REQUIRED: ${section.action}`);
  return lines;
}

function renderReport(result: VersionDriftResult): string {
  const lines = ['=== Session-Start Version Check ===', ''];
  if (result.cadence.skipped) {
    lines.push(`Not due — last run ${result.cadence.lastRunUtc} is within ${result.cadence.maxAgeHours}h.`);
    return lines.join('\n');
  }
  lines.push(...renderEditor(result.editor), ...renderPackages(result.packages), ...renderCli(result.cli));
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function runVersionDrift(options: VersionDriftOptions): VersionDriftResult {
  const errors: string[] = [];
  const dir = baselineDir(options);
  const lastRunUtc = readLastRun(join(dir, LAST_RUN));
  const cadence = computeCadence(options, lastRunUtc);

  if (cadence.skipped) {
    const skipped: VersionDriftResult = {
      ...makeResult(options.ability, 'skipped', `not due; last run ${lastRunUtc}`, errors),
      cadence,
      editor: emptyEditor(),
      packages: emptyPackages(),
      cli: emptyCli(),
      actions: [],
      baselinesUpdated: [],
      report: '',
    };
    skipped.report = renderReport(skipped);
    return skipped;
  }

  const editor = detectEditor(options, errors);
  const packages = detectPackages(options, errors);
  const cli = detectCli(options, errors);

  // The only cadence write; fail-soft so a read-only install still reports.
  try {
    writeJson(join(dir, LAST_RUN), { schemaVersion: 1, lastRunUtc: options.now });
  } catch (error) {
    errors.push(`could not record last-run: ${messageOf(error)}`);
  }

  const actions = [editor.action, packages.action, cli.action].filter((action): action is string => action !== null);
  const baselinesUpdated = [...editor.updated, ...packages.updated, ...cli.updated];
  const status = overallStatus(editor, packages, cli);
  const result: VersionDriftResult = {
    ...makeResult(options.ability, status, summarize(status, editor, packages, cli), errors),
    cadence,
    editor,
    packages,
    cli,
    actions,
    baselinesUpdated,
    report: '',
  };
  result.report = renderReport(result);
  return result;
}
