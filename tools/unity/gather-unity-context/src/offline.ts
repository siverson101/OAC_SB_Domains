// Offline, read-only, Editor-free context producers (Phase 2 Step 2.2).
//
// Every producer reads on-disk artefacts only and is fail-soft: a missing file,
// folder, or Editor never throws; the producer reports `unavailable`/`unknown`
// instead. Each result is versioned and records the route it was served by
// (always `offline`) through the ticket-01 routing helpers.
import { readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirExists, fileExists, nowIso, readJson, readText, toPosix, unique } from '../../../shared/io';
import { activeInputHandler, editorVersionInfo } from '../../../shared/toolchain';
import { selectRoute, type Route } from '../../../shared/tool-routing';
import { parseNUnit, type TestCounts } from './gate';

export type OfflineStatus =
  | 'observed_locally'
  | 'documented_by_unity'
  | 'available_but_unverified'
  | 'unavailable'
  | 'unknown';

export interface OfflineInput {
  projectRoot: string;
  assetFolder: string;
  opencodeDir?: string;
}

export interface OfflineBase {
  schemaVersion: number;
  generatedAt: string;
  status: OfflineStatus;
  route: Route;
  errors: string[];
}

// Route selection: the offline readers never use a live channel, so with no CLI
// the only possible route is `offline`. Recording it here is the evidence trail
// for the producer.
const OFFLINE_ROUTE: Route = selectRoute({ live: null, cliAvailable: false }).route;

function makeBase(status: OfflineStatus, errors: string[] = []): OfflineBase {
  return { schemaVersion: 1, generatedAt: nowIso(), status, route: OFFLINE_ROUTE, errors };
}

function errMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function statInfo(path: string): { mtimeUtc: string; sizeBytes: number } | null {
  try {
    const st = statSync(path);
    return { mtimeUtc: new Date(st.mtimeMs).toISOString(), sizeBytes: st.size };
  } catch {
    return null;
  }
}

// Heavy generated folders that never hold authoring context.
const WALK_EXCLUDES = new Set([
  'library',
  'temp',
  'obj',
  'logs',
  'build',
  'builds',
  'usersettings',
  'node_modules',
  '.git',
  '.vs',
  '.idea',
  'bin',
]);

function walkFiles(root: string, match: (name: string, full: string) => boolean, maxDepth = 16): string[] {
  const out: string[] = [];
  const walk = (dir: string, depth: number): void => {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (WALK_EXCLUDES.has(entry.name.toLowerCase())) continue;
        walk(full, depth + 1);
        continue;
      }
      if (entry.isFile() && match(entry.name, full)) out.push(full);
    }
  };
  walk(root, 0);
  return out;
}

// ---------------------------------------------------------------------------
// 1. compile-state
// ---------------------------------------------------------------------------

export interface AssemblyInfo {
  name: string;
  path: string;
  mtimeUtc: string;
  sizeBytes: number;
}

export interface EditorLogAuthorship {
  logPath: string;
  mtimeUtc: string | null;
  editorVersion: string | null;
  lastCompileLine: string | null;
}

export interface CompileState extends OfflineBase {
  libraryPresent: boolean;
  scriptAssembliesDir: string;
  assemblyCount: number;
  assemblies: AssemblyInfo[];
  newestAssembly: { name: string; mtimeUtc: string } | null;
  newestScript: { path: string; mtimeUtc: string } | null;
  stale: boolean | null;
  // Why `stale` is not determinable (null). Null when there is enough evidence
  // to answer, so a `null` stale is never mistaken for "fresh".
  staleReason: string | null;
  noOpRecompile: boolean | null;
  editorLogAuthorship: EditorLogAuthorship | null;
}

export function editorLogPaths(): string[] {
  const home = homedir();
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || join(home, 'AppData', 'Local');
    return [
      join(local, 'Unity', 'Editor', 'Editor.log'),
      join(local, 'Unity', 'Editor', 'Editor-prev.log'),
    ];
  }
  if (process.platform === 'darwin') {
    return [
      join(home, 'Library', 'Logs', 'Unity', 'Editor.log'),
      join(home, 'Library', 'Logs', 'Unity', 'Editor-prev.log'),
    ];
  }
  return [
    join(home, '.config', 'unity3d', 'Editor.log'),
    join(home, '.config', 'unity3d', 'Editor-prev.log'),
  ];
}

function readEditorLogAuthorship(logPaths: string[]): EditorLogAuthorship | null {
  for (const logPath of logPaths) {
    const info = statInfo(logPath);
    const text = readText(logPath);
    if (!info && !text) continue;
    const versionMatch =
      text?.match(/Initialize engine version:\s*([^\s(]+)/) ?? text?.match(/(\d{4}\.\d+\.\d+[abfp]\d+)/);
    const compileLines = (text ?? '')
      .split(/\r?\n/)
      .filter((line) =>
        /script compilation|finished compiling|compilation took|begin monomanager reloadassembly/i.test(line)
      );
    return {
      logPath: toPosix(logPath),
      mtimeUtc: info?.mtimeUtc ?? null,
      editorVersion: versionMatch ? versionMatch[1] : null,
      lastCompileLine: compileLines.length > 0 ? compileLines[compileLines.length - 1].trim() : null,
    };
  }
  return null;
}

export function produceCompileState(input: OfflineInput, logPaths: string[] = editorLogPaths()): CompileState {
  const errors: string[] = [];
  const assembliesDir = join(input.projectRoot, 'Library', 'ScriptAssemblies');
  const libraryPresent = dirExists(assembliesDir);

  const assemblies: AssemblyInfo[] = [];
  if (libraryPresent) {
    let names: string[] = [];
    try {
      names = readdirSync(assembliesDir);
    } catch (error) {
      errors.push(errMessage(error));
    }
    for (const name of names) {
      if (!name.toLowerCase().endsWith('.dll')) continue;
      const full = join(assembliesDir, name);
      const info = statInfo(full);
      if (!info) continue;
      assemblies.push({ name, path: toPosix(relative(input.projectRoot, full)), ...info });
    }
  }
  assemblies.sort((a, b) => b.mtimeUtc.localeCompare(a.mtimeUtc));
  const newestAssembly = assemblies[0] ? { name: assemblies[0].name, mtimeUtc: assemblies[0].mtimeUtc } : null;

  let newestScript: { path: string; mtimeUtc: string } | null = null;
  for (const full of walkFiles(input.assetFolder, (name) => name.toLowerCase().endsWith('.cs'))) {
    const info = statInfo(full);
    if (!info) continue;
    if (!newestScript || info.mtimeUtc > newestScript.mtimeUtc) {
      newestScript = { path: toPosix(relative(input.projectRoot, full)), mtimeUtc: info.mtimeUtc };
    }
  }

  const editorLogAuthorship = readEditorLogAuthorship(logPaths);
  const recentCompile = editorLogAuthorship?.lastCompileLine != null;

  // stale: a script was edited after the last assembly was produced.
  // noOpRecompile: only true with positive evidence that a recent compile
  // produced no new assembly (assemblies exist, a script is newer, and the
  // Editor log records a compile); otherwise it is not determinable.
  let stale: boolean | null = null;
  let staleReason: string | null = null;
  let noOpRecompile: boolean | null = null;
  if (newestAssembly && newestScript) {
    stale = newestScript.mtimeUtc > newestAssembly.mtimeUtc;
    if (stale) {
      noOpRecompile = recentCompile ? true : null;
      // Stale, but the Editor log carries no compile line: the no-op cannot be
      // confirmed, so the state explains itself rather than leaving both fields
      // null and looking "fresh".
      if (!recentCompile) staleReason = 'stale; no compile evidence in Editor.log';
    }
  } else if (!newestAssembly && newestScript) {
    stale = true;
  } else if (newestAssembly && !newestScript) {
    // Assemblies exist but there is no script evidence, so freshness cannot be
    // determined: report null with a reason instead of a false "fresh".
    staleReason = 'no .cs script evidence under Assets; staleness not determinable';
  } else {
    staleReason = 'no assemblies and no script evidence; staleness not determinable';
  }

  const status: OfflineStatus = libraryPresent ? 'observed_locally' : 'unavailable';
  return {
    ...makeBase(status, errors),
    libraryPresent,
    scriptAssembliesDir: 'Library/ScriptAssemblies',
    assemblyCount: assemblies.length,
    assemblies,
    newestAssembly,
    newestScript,
    stale,
    staleReason,
    noOpRecompile,
    editorLogAuthorship,
  };
}

// ---------------------------------------------------------------------------
// 2. log-digest
// ---------------------------------------------------------------------------

export interface LogMessage {
  level: 'error' | 'warning';
  line: number;
  text: string;
}

export interface LogEntry {
  path: string;
  exists: boolean;
  mtimeUtc: string | null;
  sizeBytes: number | null;
  lineCount: number;
  errorCount: number;
  warningCount: number;
  recentErrors: LogMessage[];
  recentWarnings: LogMessage[];
}

export interface LogDigest extends OfflineBase {
  logCount: number;
  errorCount: number;
  warningCount: number;
  logs: LogEntry[];
  recentMessages: LogMessage[];
}

function classifyLogLine(line: string): 'error' | 'warning' | null {
  if (/\berror\s+(CS|BC|IDE)\d+/i.test(line)) return 'error';
  if (/\[error\]/i.test(line)) return 'error';
  if (/\berror\b\s*[:=]/i.test(line)) return 'error';
  if (/\bexception\b/i.test(line) && !/\bcaught\b/i.test(line)) return 'error';
  if (/\bwarning\s+(CS|BC|IDE)\d+/i.test(line)) return 'warning';
  if (/\[warning\]/i.test(line)) return 'warning';
  if (/\bwarning\b\s*[:=]/i.test(line)) return 'warning';
  return null;
}

function pushCapped(list: LogMessage[], item: LogMessage, cap: number): void {
  list.push(item);
  if (list.length > cap) list.shift();
}

function digestLogFile(logPath: string): LogEntry | null {
  const info = statInfo(logPath);
  const text = readText(logPath);
  if (!info && !text) return null;
  const lines = text ? text.split(/\r?\n/) : [];
  let errorCount = 0;
  let warningCount = 0;
  const recentErrors: LogMessage[] = [];
  const recentWarnings: LogMessage[] = [];
  lines.forEach((line, index) => {
    const kind = classifyLogLine(line);
    if (!kind) return;
    const message: LogMessage = { level: kind, line: index + 1, text: line.trim() };
    if (kind === 'error') {
      errorCount++;
      pushCapped(recentErrors, message, 10);
    } else {
      warningCount++;
      pushCapped(recentWarnings, message, 10);
    }
  });
  return {
    path: toPosix(logPath),
    exists: info != null,
    mtimeUtc: info?.mtimeUtc ?? null,
    sizeBytes: info?.sizeBytes ?? null,
    lineCount: lines.length,
    errorCount,
    warningCount,
    recentErrors,
    recentWarnings,
  };
}

export function produceLogDigest(input: OfflineInput, logPaths: string[] = editorLogPaths()): LogDigest {
  void input;
  const errors: string[] = [];
  const logs: LogEntry[] = [];
  for (const logPath of logPaths) {
    const entry = digestLogFile(logPath);
    if (entry) logs.push(entry);
  }
  const errorCount = logs.reduce((sum, log) => sum + log.errorCount, 0);
  const warningCount = logs.reduce((sum, log) => sum + log.warningCount, 0);
  const recentMessages = logs
    .flatMap((log) => [...log.recentErrors, ...log.recentWarnings])
    .slice(-20);
  const status: OfflineStatus = logs.length > 0 ? 'observed_locally' : 'unavailable';
  return { ...makeBase(status, errors), logCount: logs.length, errorCount, warningCount, logs, recentMessages };
}

// ---------------------------------------------------------------------------
// 3. project-settings
// ---------------------------------------------------------------------------

export interface ProjectSettings extends OfflineBase {
  settingsPath: string;
  editorVersion: string | null;
  editorVersionWithRevision: string | null;
  productName: string | null;
  companyName: string | null;
  scriptingBackend: Record<string, string>;
  scriptingBackendRaw: Record<string, number>;
  il2cpp: boolean | null;
  targetPlatform: string | null;
  targetPlatformSource: string | null;
  colorSpace: 'Linear' | 'Gamma' | null;
  graphicsApis: string[];
  persistentDataPath: string | null;
  persistentDataPathBasis: string | null;
  activeInputHandler: number | null;
  activeInputHandlerName: string | null;
}

const SCRIPTING_BACKEND: Record<number, string> = { 0: 'Mono', 1: 'IL2CPP' };

const INPUT_HANDLERS: Record<number, string> = {
  0: 'Input Manager (Old)',
  1: 'Input System Package (New)',
  2: 'Both',
};

const GRAPHICS_DEVICE_TYPES: Record<number, string> = {
  0: 'OpenGL2',
  1: 'Direct3D9',
  2: 'Direct3D11',
  4: 'Null',
  8: 'OpenGLES2',
  11: 'OpenGLES3',
  16: 'Metal',
  17: 'OpenGLCore',
  18: 'Direct3D12',
  21: 'Vulkan',
};

function yamlScalar(text: string, keys: string[]): string | null {
  for (const key of keys) {
    const match = new RegExp(`^\\s*${key}:\\s*(.+?)\\s*$`, 'm').exec(text);
    if (match) {
      const value = match[1].replace(/^['"]|['"]$/g, '');
      if (value !== '') return value;
    }
  }
  return null;
}

function yamlBlockMap(text: string, keys: string[]): Record<string, string> {
  for (const key of keys) {
    const lines = text.split(/\r?\n/);
    const out: Record<string, string> = {};
    let inBlock = false;
    let indent = 0;
    let found = false;
    for (const line of lines) {
      const header = new RegExp(`^(\\s*)${key}:\\s*$`).exec(line);
      if (header) {
        inBlock = true;
        indent = header[1].length;
        found = true;
        continue;
      }
      if (!inBlock) continue;
      if (line.trim() === '') continue;
      const currentIndent = line.length - line.trimStart().length;
      if (currentIndent <= indent) {
        inBlock = false;
        continue;
      }
      const entry = /^\s*([A-Za-z0-9_]+):\s*(.+?)\s*$/.exec(line);
      if (entry) out[entry[1]] = entry[2].replace(/^['"]|['"]$/g, '');
    }
    if (found) return out;
  }
  return {};
}

function decodeGraphicsApis(hex: string): string[] {
  const out: string[] = [];
  for (let i = 0; i + 8 <= hex.length; i += 8) {
    const bytes = hex.slice(i, i + 8).match(/../g) ?? [];
    const value = Number.parseInt(bytes.reverse().join(''), 16);
    out.push(GRAPHICS_DEVICE_TYPES[value] ?? `Unknown(${value})`);
  }
  return out;
}

function computePersistentDataPath(companyName: string | null, productName: string | null): {
  path: string | null;
  basis: string | null;
} {
  if (!companyName || !productName) return { path: null, basis: null };
  const home = homedir();
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || join(home, 'AppData', 'Local');
    return {
      path: toPosix(join(dirname(local), 'LocalLow', companyName, productName)),
      basis: '%LOCALAPPDATA%/../LocalLow/<company>/<product>',
    };
  }
  if (process.platform === 'darwin') {
    return {
      path: toPosix(join(home, 'Library', 'Application Support', companyName, productName)),
      basis: '~/Library/Application Support/<company>/<product>',
    };
  }
  return {
    path: toPosix(join(home, '.config', 'unity3d', companyName, productName)),
    basis: '~/.config/unity3d/<company>/<product>',
  };
}

export function produceProjectSettings(input: OfflineInput): ProjectSettings {
  const errors: string[] = [];
  const settingsPath = join(input.projectRoot, 'ProjectSettings', 'ProjectSettings.asset');
  const text = readText(settingsPath);
  const editor = editorVersionInfo(input.projectRoot);

  if (!text) {
    return {
      ...makeBase('unavailable', errors),
      settingsPath: toPosix(relative(input.projectRoot, settingsPath)),
      editorVersion: editor.version,
      editorVersionWithRevision: editor.revision,
      productName: null,
      companyName: null,
      scriptingBackend: {},
      scriptingBackendRaw: {},
      il2cpp: null,
      targetPlatform: null,
      targetPlatformSource: null,
      colorSpace: null,
      graphicsApis: [],
      persistentDataPath: null,
      persistentDataPathBasis: null,
      activeInputHandler: null,
      activeInputHandlerName: null,
    };
  }

  const productName = yamlScalar(text, ['productName']);
  const companyName = yamlScalar(text, ['companyName']);

  const scriptingBackendRaw: Record<string, number> = {};
  const scriptingBackend: Record<string, string> = {};
  for (const [platform, value] of Object.entries(yamlBlockMap(text, ['scriptingBackend', 'm_ScriptingBackend']))) {
    const num = Number(value);
    if (!Number.isFinite(num)) continue;
    scriptingBackendRaw[platform] = num;
    scriptingBackend[platform] = SCRIPTING_BACKEND[num] ?? `Unknown(${num})`;
  }
  const il2cpp =
    Object.keys(scriptingBackendRaw).length === 0
      ? null
      : Object.values(scriptingBackendRaw).some((value) => value === 1);

  const colorRaw = yamlScalar(text, ['m_ActiveColorSpace', 'm_ColorSpace']);
  const colorSpace = colorRaw === '0' ? 'Gamma' : colorRaw === '1' ? 'Linear' : null;

  let targetPlatform = yamlScalar(text, ['m_ActiveBuildTarget', 'activeBuildTarget']);
  let targetPlatformSource = targetPlatform ? 'ProjectSettings.asset' : null;
  if (!targetPlatform) {
    const editorBuildSettings = readText(join(input.projectRoot, 'ProjectSettings', 'EditorUserBuildSettings.asset'));
    const match = editorBuildSettings?.match(/^\s*m_ActiveBuildTarget:\s*(\S+)\s*$/m);
    if (match) {
      targetPlatform = match[1];
      targetPlatformSource = 'EditorUserBuildSettings.asset';
    }
  }

  const graphicsApis: string[] = [];
  const apiRe = /m_BuildTarget:\s*([^\s]+)\s*\r?\n\s*m_APIs:\s*([0-9a-fA-F]+)/g;
  let apiMatch: RegExpExecArray | null;
  while ((apiMatch = apiRe.exec(text))) {
    graphicsApis.push(...decodeGraphicsApis(apiMatch[2]));
  }

  const persistent = computePersistentDataPath(companyName, productName);
  const handler = activeInputHandler(input.projectRoot);

  return {
    ...makeBase('observed_locally', errors),
    settingsPath: toPosix(relative(input.projectRoot, settingsPath)),
    editorVersion: editor.version,
    editorVersionWithRevision: editor.revision,
    productName,
    companyName,
    scriptingBackend,
    scriptingBackendRaw,
    il2cpp,
    targetPlatform,
    targetPlatformSource,
    colorSpace,
    graphicsApis: unique(graphicsApis),
    persistentDataPath: persistent.path,
    persistentDataPathBasis: persistent.basis,
    activeInputHandler: handler,
    activeInputHandlerName: handler == null ? null : INPUT_HANDLERS[handler] ?? `Unknown(${handler})`,
  };
}

// ---------------------------------------------------------------------------
// 4. asmdef-map
// ---------------------------------------------------------------------------

export interface AsmdefNode {
  name: string;
  path: string;
  references: string[];
  includePlatforms: string[];
  excludePlatforms: string[];
  testAssemblies: boolean;
  isTest: boolean;
  editorOnly: boolean;
  targets: { edit: boolean; play: boolean };
  internalsVisibleTo: string[];
}

export interface AsmdefEdge {
  from: string;
  to: string | null;
  reference: string;
  resolved: boolean;
}

export interface AsmdefMap extends OfflineBase {
  assetFolder: string;
  assemblyCount: number;
  testAssemblyCount: number;
  assemblies: AsmdefNode[];
  edges: AsmdefEdge[];
}

interface AsmdefJson {
  name?: string;
  references?: unknown;
  includePlatforms?: unknown;
  excludePlatforms?: unknown;
  testAssemblies?: unknown;
  optionalUnityReferences?: unknown;
  internalsVisibleTo?: unknown;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function ownerAsmdef(
  dir: string,
  dirs: { path: string; dir: string; name: string }[]
): { path: string; name: string } | null {
  let current = dir;
  for (;;) {
    const owner = dirs.find((entry) => entry.dir === current);
    if (owner) return owner;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function scanAsmdefs(assetFolder: string): { nodes: AsmdefNode[]; edges: AsmdefEdge[]; errors: string[] } {
  const errors: string[] = [];
  const files = walkFiles(assetFolder, (name) => name.toLowerCase().endsWith('.asmdef'));
  const guidToName = new Map<string, string>();
  const byPath = new Map<string, { json: AsmdefJson; dir: string; name: string }>();

  for (const file of files) {
    const json = readJson<AsmdefJson>(file);
    if (!json) {
      errors.push(`unreadable asmdef: ${toPosix(file)}`);
      continue;
    }
    const name = json.name || basename(file, '.asmdef');
    byPath.set(file, { json, dir: dirname(file), name });
    const guid = readText(`${file}.meta`)?.match(/guid:\s*([0-9a-fA-F]{32})/);
    if (guid) guidToName.set(guid[1].toLowerCase(), name);
  }

  const names = new Set([...byPath.values()].map((entry) => entry.name));
  const dirs = [...byPath.entries()].map(([path, entry]) => ({ path, ...entry }));

  const ivtByAsmdef = new Map<string, Set<string>>();
  for (const cs of walkFiles(assetFolder, (name) => name.toLowerCase().endsWith('.cs'))) {
    const owner = ownerAsmdef(dirname(cs), dirs);
    if (!owner) continue;
    const text = readText(cs);
    if (!text || !text.includes('InternalsVisibleTo')) continue;
    const re = /InternalsVisibleTo\(\s*"([^"]+)"\s*\)/g;
    const set = ivtByAsmdef.get(owner.path) ?? new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = re.exec(text))) set.add(match[1]);
    ivtByAsmdef.set(owner.path, set);
  }

  const nodes: AsmdefNode[] = [];
  const edges: AsmdefEdge[] = [];
  for (const [path, entry] of byPath) {
    const references = stringArray(entry.json.references);
    const includePlatforms = stringArray(entry.json.includePlatforms);
    const excludePlatforms = stringArray(entry.json.excludePlatforms);
    const optional = stringArray(entry.json.optionalUnityReferences);
    const testAssemblies = entry.json.testAssemblies === true || optional.includes('TestAssemblies');
    const isTest = testAssemblies || /\.Tests(\.|$)/.test(entry.name) || /\.Tests\.asmdef$/i.test(path);
    const editorOnly = includePlatforms.length === 1 && includePlatforms[0].toLowerCase() === 'editor';
    const ivt = new Set<string>(stringArray(entry.json.internalsVisibleTo));
    for (const value of ivtByAsmdef.get(path) ?? []) ivt.add(value);

    nodes.push({
      name: entry.name,
      path: toPosix(path),
      references,
      includePlatforms,
      excludePlatforms,
      testAssemblies,
      isTest,
      editorOnly,
      targets: { edit: editorOnly, play: !editorOnly },
      internalsVisibleTo: [...ivt].sort(),
    });

    for (const reference of references) {
      const guid = reference.startsWith('GUID:') ? reference.slice(5).toLowerCase() : null;
      const resolvedName = guid ? guidToName.get(guid) ?? null : names.has(reference) ? reference : null;
      edges.push({ from: entry.name, to: resolvedName, reference, resolved: resolvedName != null });
    }
  }

  nodes.sort((a, b) => a.name.localeCompare(b.name));
  return { nodes, edges, errors };
}

export function produceAsmdefMap(input: OfflineInput): AsmdefMap {
  const { nodes, edges, errors } = scanAsmdefs(input.assetFolder);
  const status: OfflineStatus = !dirExists(input.assetFolder)
    ? 'unknown'
    : nodes.length > 0
      ? 'observed_locally'
      : 'unavailable';
  return {
    ...makeBase(status, errors),
    assetFolder: toPosix(relative(input.projectRoot, input.assetFolder)),
    assemblyCount: nodes.length,
    testAssemblyCount: nodes.filter((node) => node.isTest).length,
    assemblies: nodes,
    edges,
  };
}

// ---------------------------------------------------------------------------
// 5. test-inventory
// ---------------------------------------------------------------------------

export interface TestResultFile {
  path: string;
  mtimeUtc: string | null;
  counts: TestCounts;
  result: string;
}

export interface VisualVerificationResult {
  path: string;
  status: string | null;
  summary: unknown;
  cases: unknown[];
  screenshots: string[];
  tests: VisualTest[];
}

export type VisualTestSource = 'test-results' | 'visual-verification-json';

export interface VisualTest {
  fullname: string;
  status: string | null;
  description: string | null;
  screenshots: string[];
  missingScreenshots: string[];
  source: VisualTestSource;
}

export interface TestInventory extends OfflineBase {
  testAssemblies: { name: string; path: string }[];
  testAssemblyCount: number;
  results: TestResultFile[];
  latestResult: TestResultFile | null;
  visualVerification: {
    found: boolean;
    files: string[];
    results: VisualVerificationResult[];
    screenshots: string[];
    tests: VisualTest[];
  };
}

const VISUAL_CATEGORY = 'VisualVerification';

function decodeXmlEntities(value: string): string {
  const codePoint = (match: string, digits: string, radix: number): string => {
    const code = Number.parseInt(digits, radix);
    return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
  };
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (match, digits: string) => codePoint(match, digits, 16))
    .replace(/&#(\d+);/g, (match, digits: string) => codePoint(match, digits, 10))
    .replace(/&amp;/g, '&');
}

interface XmlToken {
  name: string;
  attrs: Record<string, string>;
  closing: boolean;
  selfClosing: boolean;
}

function tokenizeXml(xml: string): XmlToken[] {
  const tokens: XmlToken[] = [];
  let cursor = 0;
  while (cursor < xml.length) {
    const open = xml.indexOf('<', cursor);
    if (open === -1) break;
    if (xml.startsWith('<!--', open)) {
      const end = xml.indexOf('-->', open + 4);
      cursor = end === -1 ? xml.length : end + 3;
      continue;
    }
    if (xml.startsWith('<![CDATA[', open)) {
      const end = xml.indexOf(']]>', open + 9);
      cursor = end === -1 ? xml.length : end + 3;
      continue;
    }
    if (xml.startsWith('<?', open) || xml.startsWith('<!', open)) {
      const end = xml.indexOf('>', open + 2);
      cursor = end === -1 ? xml.length : end + 1;
      continue;
    }
    let scan = open + 1;
    let quote: string | null = null;
    while (scan < xml.length) {
      const ch = xml[scan];
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === '>') {
        break;
      }
      scan++;
    }
    if (scan >= xml.length) break;
    const raw = xml.slice(open + 1, scan);
    cursor = scan + 1;
    const closing = raw.startsWith('/');
    const body = closing ? raw.slice(1).trim() : raw.trim();
    const selfClosing = !closing && body.endsWith('/');
    const cleaned = selfClosing ? body.slice(0, -1).trim() : body;
    const nameMatch = /^([A-Za-z_][\w:.-]*)/.exec(cleaned);
    if (!nameMatch) continue;
    const attrs: Record<string, string> = {};
    const attrRe = /([A-Za-z_][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
    const attrBody = cleaned.slice(nameMatch[1].length);
    let match: RegExpExecArray | null;
    while ((match = attrRe.exec(attrBody))) {
      attrs[match[1]] = decodeXmlEntities(match[3] ?? match[4] ?? '');
    }
    tokens.push({ name: nameMatch[1], attrs, closing, selfClosing });
  }
  return tokens;
}

interface XmlElement {
  name: string;
  attrs: Record<string, string>;
  properties: Record<string, string[]>;
}

function categoriesOf(element: XmlElement): string[] {
  const fromAttribute = (element.attrs.categories ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value !== '');
  return [...(element.properties.Category ?? []), ...fromAttribute];
}

function isVisualElement(element: XmlElement): boolean {
  return categoriesOf(element).includes(VISUAL_CATEGORY);
}

function parseVisualTestsFromXml(xml: string): Omit<VisualTest, 'missingScreenshots' | 'source'>[] {
  const out: Omit<VisualTest, 'missingScreenshots' | 'source'>[] = [];
  const stack: XmlElement[] = [];
  let propertyBuffer: Record<string, string[]> | null = null;

  const finalize = (element: XmlElement): void => {
    const ancestorCategories = stack
      .filter((ancestor) => ancestor.name === 'test-suite')
      .flatMap((ancestor) => categoriesOf(ancestor));
    const isVisual = isVisualElement(element) || ancestorCategories.includes(VISUAL_CATEGORY);
    if (!isVisual) return;
    const description = (element.properties.Description ?? [])[0] ?? null;
    out.push({
      fullname: element.attrs.fullname ?? element.attrs.name ?? '(unknown)',
      status: element.attrs.result ?? null,
      description,
      screenshots: [...(element.properties.Screenshot ?? [])],
    });
  };

  const close = (): void => {
    const element = stack.pop();
    if (!element) return;
    if (element.name === 'properties') {
      propertyBuffer = null;
      const parent = stack[stack.length - 1];
      if (parent) {
        for (const [key, values] of Object.entries(element.properties)) {
          parent.properties[key] = [...(parent.properties[key] ?? []), ...values];
        }
      }
      return;
    }
    if (element.name === 'test-case') finalize(element);
  };

  let tokens: XmlToken[];
  try {
    tokens = tokenizeXml(xml);
  } catch {
    return out;
  }

  for (const token of tokens) {
    if (token.closing) {
      close();
      continue;
    }
    const element: XmlElement = { name: token.name, attrs: token.attrs, properties: {} };
    stack.push(element);
    if (token.name === 'properties') {
      propertyBuffer = element.properties;
    } else if (token.name === 'property' && propertyBuffer) {
      const name = token.attrs.name;
      if (name) propertyBuffer[name] = [...(propertyBuffer[name] ?? []), token.attrs.value ?? ''];
    }
    if (token.selfClosing) close();
  }
  return out;
}

function resolveScreenshot(value: string, baseDir: string, projectRoot: string): string {
  const trimmed = value.trim();
  if (trimmed === '') return '';
  const absolute = isAbsolute(trimmed) ? trimmed : join(baseDir, trimmed);
  return toPosix(relative(projectRoot, absolute));
}

function makeVisualTest(
  test: Omit<VisualTest, 'missingScreenshots' | 'source'>,
  source: VisualTestSource,
  projectRoot: string
): VisualTest {
  const screenshots = unique(test.screenshots.filter((value) => value !== ''));
  return {
    ...test,
    screenshots,
    missingScreenshots: screenshots.filter((value) => !fileExists(join(projectRoot, value))),
    source,
  };
}

function visualTestsFromResult(result: VisualVerificationResult, file: string, projectRoot: string): VisualTest[] {
  const baseDir = dirname(file);
  const out: VisualTest[] = [];
  result.cases.forEach((entry, index) => {
    const record = entry && typeof entry === 'object' && !Array.isArray(entry) ? (entry as Record<string, unknown>) : null;
    if (!record) return;
    const text = (key: string): string | null => (typeof record[key] === 'string' ? (record[key] as string) : null);
    const screenshots = collectScreenshotValues(record).map((value) =>
      resolveScreenshot(value, baseDir, projectRoot)
    );
    out.push(
      makeVisualTest(
        {
          fullname: text('fullname') ?? text('name') ?? text('test') ?? `visual-case-${index + 1}`,
          status: text('status') ?? text('result') ?? result.status,
          description: text('description'),
          screenshots,
        },
        'visual-verification-json',
        projectRoot
      )
    );
  });
  return out;
}

function collectScreenshotValues(value: unknown): string[] {
  const out: string[] = [];
  const visit = (node: unknown): void => {
    if (typeof node === 'string') {
      if (/\.(png|jpe?g)$/i.test(node)) out.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (node && typeof node === 'object') {
      for (const item of Object.values(node)) visit(item);
    }
  };
  visit(value);
  return unique(out);
}

function collectScreenshotPaths(value: unknown, projectRoot: string): string[] {
  return collectScreenshotValues(value).map((node) =>
    toPosix(isAbsolute(node) ? relative(projectRoot, node) : node)
  );
}

function parseVisualVerification(file: string, projectRoot: string): VisualVerificationResult | null {
  const data = readJson<Record<string, unknown>>(file);
  if (!data || typeof data !== 'object') return null;
  const cases = Array.isArray(data.cases) ? data.cases : Array.isArray(data.results) ? data.results : [];
  const result: VisualVerificationResult = {
    path: toPosix(relative(projectRoot, file)),
    status: typeof data.status === 'string' ? data.status : null,
    summary: data.summary ?? null,
    cases,
    screenshots: collectScreenshotPaths(data, projectRoot),
    tests: [],
  };
  result.tests = visualTestsFromResult(result, file, projectRoot);
  return result;
}

export function produceTestInventory(input: OfflineInput): TestInventory {
  const errors: string[] = [];
  const { nodes } = scanAsmdefs(input.assetFolder);
  const testAssemblies = nodes
    .filter((node) => node.isTest)
    .map((node) => ({ name: node.name, path: node.path }));

  const roots = unique([input.projectRoot, ...(input.opencodeDir ? [input.opencodeDir] : [])]);
  const resultFiles = new Set<string>();
  const visualFiles = new Set<string>();
  const screenshots = new Set<string>();
  for (const root of roots) {
    for (const file of walkFiles(root, (name) => /results\.xml$/i.test(name) || name === 'TestResults.xml')) {
      resultFiles.add(file);
    }
    for (const file of walkFiles(root, (name) => /^visual-verification.*\.json$/i.test(name))) {
      visualFiles.add(file);
    }
    for (const file of walkFiles(root, (name, full) => /\.(png|jpe?g)$/i.test(name) && /screenshot/i.test(full))) {
      screenshots.add(file);
    }
  }

  const results: TestResultFile[] = [];
  const xmlVisualTests: VisualTest[] = [];
  const orderedResultFiles = [...resultFiles]
    .map((file) => ({ file, info: statInfo(file) }))
    .sort((a, b) => (b.info?.mtimeUtc ?? '').localeCompare(a.info?.mtimeUtc ?? ''));
  for (const { file, info } of orderedResultFiles) {
    const text = readText(file) ?? '';
    const counts = parseNUnit(text);
    results.push({
      path: toPosix(relative(input.projectRoot, file)),
      mtimeUtc: info?.mtimeUtc ?? null,
      counts,
      result: counts.result,
    });
    for (const test of parseVisualTestsFromXml(text)) {
      const resolved = {
        ...test,
        screenshots: test.screenshots.map((value) =>
          resolveScreenshot(value, input.projectRoot, input.projectRoot)
        ),
      };
      xmlVisualTests.push(makeVisualTest(resolved, 'test-results', input.projectRoot));
    }
  }

  const visualResults: VisualVerificationResult[] = [];
  for (const file of visualFiles) {
    const parsed = parseVisualVerification(file, input.projectRoot);
    if (parsed) visualResults.push(parsed);
  }
  visualResults.sort((a, b) => a.path.localeCompare(b.path));

  const mergedVisualTests = new Map<string, VisualTest>();
  for (const test of xmlVisualTests) {
    if (!mergedVisualTests.has(test.fullname)) mergedVisualTests.set(test.fullname, test);
  }
  for (const result of visualResults) {
    for (const test of result.tests) {
      const existing = mergedVisualTests.get(test.fullname);
      if (!existing) {
        mergedVisualTests.set(test.fullname, test);
        continue;
      }
      const screenshots = unique([...existing.screenshots, ...test.screenshots]);
      existing.screenshots = screenshots;
      existing.missingScreenshots = screenshots.filter((value) => !fileExists(join(input.projectRoot, value)));
    }
  }
  const visualTests = [...mergedVisualTests.values()];

  const status: OfflineStatus =
    testAssemblies.length > 0 || results.length > 0 ? 'observed_locally' : 'unavailable';
  return {
    ...makeBase(status, errors),
    testAssemblies,
    testAssemblyCount: testAssemblies.length,
    results,
    latestResult: results[0] ?? null,
    visualVerification: {
      found: visualFiles.size > 0 || visualTests.length > 0,
      files: [...visualFiles].map((file) => toPosix(relative(input.projectRoot, file))),
      results: visualResults,
      screenshots: [...screenshots].map((file) => toPosix(relative(input.projectRoot, file))),
      tests: visualTests,
    },
  };
}

// ---------------------------------------------------------------------------
// 6. deprecation-scan
// ---------------------------------------------------------------------------

export interface DeprecatedPattern {
  id: string;
  match: string;
  replacement: string;
  kind?: string;
  since?: string;
  message?: string;
}

export interface DeprecationFinding {
  patternId: string;
  match: string;
  replacement: string;
  file: string;
  line: number;
  text: string;
}

export interface SourceRange {
  start: number;
  end: number;
}

export interface DeprecationScan extends OfflineBase {
  patternsLoaded: number;
  patternsSource: 'bundle' | 'missing';
  patternsPath: string | null;
  scannedFiles: number;
  findingCount: number;
  truncated: boolean;
  byPattern: Record<string, number>;
  findings: DeprecationFinding[];
}

const MAX_FINDINGS = 1000;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function defaultPatternsPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, '..', '..', 'context', 'unity', 'deprecated-patterns.json');
}

export function loadDeprecatedPatterns(overridePath?: string): {
  patterns: DeprecatedPattern[];
  source: 'bundle' | 'missing';
  path: string | null;
} {
  const path = overridePath ?? defaultPatternsPath();
  const data = readJson<{ patterns?: DeprecatedPattern[] }>(path);
  if (data && Array.isArray(data.patterns) && data.patterns.length > 0) {
    return { patterns: data.patterns, source: 'bundle', path };
  }
  return { patterns: [], source: 'missing', path: null };
}

export function produceDeprecationScan(input: OfflineInput, patternsPath?: string): DeprecationScan {
  const { patterns, source, path } = loadDeprecatedPatterns(patternsPath);
  const errors: string[] = [];
  const sorted = [...patterns].sort((a, b) => b.match.length - a.match.length);
  const findings: DeprecationFinding[] = [];
  const byPattern: Record<string, number> = {};
  let truncated = false;

  const files = walkFiles(input.assetFolder, (name) => name.toLowerCase().endsWith('.cs'));
  outer: for (const file of files) {
    const text = readText(file);
    if (!text) continue;
    const lines = text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const taken: SourceRange[] = [];
      for (const pattern of sorted) {
        const re = new RegExp(`\\b${escapeRegExp(pattern.match)}\\b`, 'g');
        let match: RegExpExecArray | null;
        while ((match = re.exec(line))) {
          const start = match.index;
          const end = start + match[0].length;
          // Skip a shorter pattern nested inside an already-recorded longer match.
          if (taken.some((range) => start < range.end && end > range.start)) continue;
          taken.push({ start, end });
          if (findings.length >= MAX_FINDINGS) {
            truncated = true;
            break outer;
          }
          findings.push({
            patternId: pattern.id,
            match: pattern.match,
            replacement: pattern.replacement,
            file: toPosix(relative(input.projectRoot, file)),
            line: index + 1,
            text: line.trim(),
          });
          byPattern[pattern.match] = (byPattern[pattern.match] ?? 0) + 1;
        }
      }
    }
  }

  const status: OfflineStatus =
    patterns.length === 0 ? 'unavailable' : dirExists(input.assetFolder) ? 'observed_locally' : 'unknown';
  return {
    ...makeBase(status, errors),
    patternsLoaded: patterns.length,
    patternsSource: source,
    patternsPath: path ? toPosix(path) : null,
    scannedFiles: files.length,
    findingCount: findings.length,
    truncated,
    byPattern,
    findings,
  };
}
