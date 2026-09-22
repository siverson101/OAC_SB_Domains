// Offline Sense abilities (Phase 2 Step 2.3, Phase 7 Step 7.1).
//
// Six of the seven abilities live here; `code-navigation` is in its own module
// because it walks project source. All reads are fail-soft and read-only.
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirExists, readJson, readText } from '../../../shared/io';
import { editorVersionInfo } from '../../../shared/toolchain';
import { parseFrontmatter } from '../../../shared/registry/src/frontmatter';
import {
  checkVersionCompatibility,
  featureFlagsFor,
  parseUnityVersion,
  type VersionCompatibilityStatus,
  type VersionFeatureFlag,
} from '../../../shared/unity-version';
import { codeNavigation } from './code-navigation';
import {
  loadApiQuickref,
  loadPlatformDefines,
  loadVersionMatrix,
  type ApiEntry,
  type PlatformEntry,
  type VersionDefineEntry,
} from './tables';
import {
  asArray,
  asRecord,
  bool,
  makeResult,
  num,
  projectDataDir,
  str,
  stringArray,
  type Json,
  type SenseBase,
  type SenseOptions,
  type SenseStatus,
} from './shared';

function readData(dataDir: string, file: string): Json | null {
  return asRecord(readJson<unknown>(join(dataDir, file)));
}

function present(entries: Record<string, unknown | null>): Record<string, boolean> {
  return Object.fromEntries(Object.entries(entries).map(([key, value]) => [key, value !== null]));
}

function anyPresent(flags: Record<string, boolean>): boolean {
  return Object.values(flags).some(Boolean);
}

function statusFromFlags(flags: Record<string, boolean>): SenseStatus {
  return anyPresent(flags) ? 'observed_locally' : 'unavailable';
}

// ---------------------------------------------------------------------------
// project-status — aggregate identity/version/compile/gate state
// ---------------------------------------------------------------------------

export interface ProjectStatusResult extends SenseBase {
  identity: {
    projectName: string | null;
    projectPath: string | null;
    unityVersion: string | null;
    cliVersion: string | null;
    pipelineVersion: string | null;
    foundProject: boolean | null;
    assetFolder: string | null;
  };
  compile: { status: string | null; stale: boolean | null; noOpRecompile: boolean | null; assemblyCount: number | null };
  gate: {
    gateResult: string | null;
    hardFailures: number | null;
    reviewRequired: number | null;
    fingerprint: string | null;
    lastVerificationUtc: string | null;
    route: string | null;
  };
  structure: { totalAssets: number; counts: Record<string, number>; thirdPartyFolderCount: number };
  packages: { status: string | null; count: number };
  sources: Record<string, boolean>;
}

export function projectStatus(options: SenseOptions): ProjectStatusResult {
  const dataDir = projectDataDir(options);
  const scan = readData(dataDir, 'scan-result.json');
  const project = readData(dataDir, 'unity-project.json');
  const gate = readData(dataDir, 'gate-state.json');
  const compile = readData(dataDir, 'compile-state.json');
  const structure = readData(dataDir, 'project-structure.json');
  const packages = readData(dataDir, 'unity-package-list.json');

  const sources = present({ scanResult: scan, unityProject: project, gateState: gate, compileState: compile, projectStructure: structure, packageList: packages });

  const counts = (asRecord(structure?.counts) ?? {}) as Record<string, number>;
  const numericCounts: Record<string, number> = {};
  for (const [key, value] of Object.entries(counts)) if (typeof value === 'number') numericCounts[key] = value;

  const identity = {
    projectName: str(project, 'projectName') ?? str(scan, 'projectName'),
    projectPath: str(project, 'projectPath') ?? str(scan, 'projectPath'),
    unityVersion: str(project, 'unityVersion') ?? str(scan, 'unityVer'),
    cliVersion: str(project, 'cliVersion') ?? str(scan, 'unityCliVer'),
    pipelineVersion: str(project, 'pipelineVersion') ?? str(scan, 'pipelineVer'),
    foundProject: bool(project, 'foundProject') ?? bool(scan, 'foundProject'),
    assetFolder: str(project, 'assetFolder') ?? str(scan, 'assetFolder'),
  };

  const result: ProjectStatusResult = {
    ...makeResult('project-status', statusFromFlags(sources), 'Aggregated identity, compile and gate state', []),
    identity,
    compile: {
      status: str(compile, 'status'),
      stale: bool(compile, 'stale'),
      noOpRecompile: bool(compile, 'noOpRecompile'),
      assemblyCount: num(compile, 'assemblyCount'),
    },
    gate: {
      gateResult: str(gate, 'gateResult'),
      hardFailures: num(gate, 'hardFailures'),
      reviewRequired: num(gate, 'reviewRequired'),
      fingerprint: str(gate, 'fingerprint'),
      lastVerificationUtc: str(gate, 'lastVerificationUtc'),
      route: str(asRecord(gate?.routing), 'route'),
    },
    structure: {
      totalAssets: Object.values(numericCounts).reduce((sum, value) => sum + value, 0),
      counts: numericCounts,
      thirdPartyFolderCount: asArray(structure?.thirdPartyFolders).length,
    },
    packages: { status: str(packages, 'status'), count: asArray(packages?.packages).length },
    sources,
  };
  result.summary = result.identity.projectName
    ? `${result.identity.projectName} · Unity ${result.identity.unityVersion ?? 'unknown'} · gate ${result.gate.gateResult ?? 'not_run'}`
    : 'No Unity project data found under .opencode/project-data';
  return result;
}

// ---------------------------------------------------------------------------
// asset-intelligence — deduce asset usage from structure + packages + prefs
// ---------------------------------------------------------------------------

export interface AssetIntelligenceResult extends SenseBase {
  assetCounts: Record<string, number>;
  totalAssets: number;
  thirdPartyFolders: string[];
  packages: { status: string | null; count: number; names: string[] };
  input: { usesInputSystem: boolean | null; usesLegacyInput: boolean | null; activeInputHandlerName: string | null };
  platform: { targetPlatform: string | null; il2cpp: boolean | null; colorSpace: string | null };
  assemblies: { testAssemblyCount: number | null };
  signals: string[];
  sources: Record<string, boolean>;
}

export function assetIntelligence(options: SenseOptions): AssetIntelligenceResult {
  const dataDir = projectDataDir(options);
  const structure = readData(dataDir, 'project-structure.json');
  const packages = readData(dataDir, 'unity-package-list.json');
  const files = readData(dataDir, 'project-files.json');
  const pref = readData(dataDir, 'project-pref.json');
  const settings = readData(dataDir, 'project-settings.json');
  const asmdef = readData(dataDir, 'asmdef-map.json');

  const sources = present({ projectStructure: structure, packageList: packages, projectFiles: files, projectPref: pref, projectSettings: settings, asmdefMap: asmdef });

  const counts = (asRecord(structure?.counts) ?? {}) as Record<string, number>;
  const assetCounts: Record<string, number> = {};
  for (const [key, value] of Object.entries(counts)) if (typeof value === 'number') assetCounts[key] = value;

  const packageEntries = asArray(packages?.packages).map(asRecord).filter((entry): entry is Json => entry !== null);
  const names = packageEntries.map((entry) => str(entry, 'name')).filter((name): name is string => name !== null);

  const usesInputSystem = bool(pref, 'usesInputSystem');
  const usesLegacyInput = bool(pref, 'usesLegacyInput');
  const activeInputHandlerName = str(settings, 'activeInputHandlerName');
  const targetPlatform = str(settings, 'targetPlatform');
  const il2cpp = bool(settings, 'il2cpp');
  const colorSpace = str(settings, 'colorSpace');
  const testAssemblyCount = num(asmdef, 'testAssemblyCount');

  const signals: string[] = [];
  const inputSystem = usesInputSystem ?? (activeInputHandlerName === 'Input System Package (New)' || activeInputHandlerName === 'Both');
  if (inputSystem) signals.push('uses the Input System package');
  if (usesLegacyInput || activeInputHandlerName === 'Input Manager (Old)' || activeInputHandlerName === 'Both') signals.push('uses the legacy Input Manager');
  if (il2cpp) signals.push('IL2CPP scripting backend');
  if (targetPlatform) signals.push(`target platform ${targetPlatform}`);
  if (testAssemblyCount != null && testAssemblyCount > 0) signals.push(`${testAssemblyCount} test assembly/ies`);
  if (assetCounts.sprites) signals.push(`${assetCounts.sprites} sprite(s)`);
  if (assetCounts.prefabs) signals.push(`${assetCounts.prefabs} prefab(s)`);

  const result: AssetIntelligenceResult = {
    ...makeResult('asset-intelligence', statusFromFlags(sources), 'Asset usage deduced from structure, packages and preferences', []),
    assetCounts,
    totalAssets: Object.values(assetCounts).reduce((sum, value) => sum + value, 0),
    thirdPartyFolders: stringArray(structure, 'thirdPartyFolders'),
    packages: { status: str(packages, 'status'), count: packageEntries.length, names },
    input: { usesInputSystem, usesLegacyInput, activeInputHandlerName },
    platform: { targetPlatform, il2cpp, colorSpace },
    assemblies: { testAssemblyCount },
    signals,
    sources,
  };
  result.summary = `${result.totalAssets} asset(s) across ${Object.keys(assetCounts).length} categor(ies), ${packageEntries.length} package(s)`;
  return result;
}

// ---------------------------------------------------------------------------
// offline-project-inspection — digest the six Phase 2a offline readers
// ---------------------------------------------------------------------------

export interface OfflineInspectionResult extends SenseBase {
  compile: { status: string | null; stale: boolean | null; noOpRecompile: boolean | null; assemblyCount: number | null; newestScript: string | null };
  logs: { status: string | null; errorCount: number | null; warningCount: number | null };
  settings: { editorVersion: string | null; productName: string | null; targetPlatform: string | null; activeInputHandlerName: string | null; il2cpp: boolean | null };
  assemblies: { assemblyCount: number | null; testAssemblyCount: number | null };
  tests: { testAssemblyCount: number | null; latestResult: string | null };
  deprecations: { findingCount: number | null; byPattern: Record<string, number> };
  sources: Record<string, boolean>;
}

export function offlineProjectInspection(options: SenseOptions): OfflineInspectionResult {
  const dataDir = projectDataDir(options);
  const compile = readData(dataDir, 'compile-state.json');
  const logs = readData(dataDir, 'log-digest.json');
  const settings = readData(dataDir, 'project-settings.json');
  const asmdef = readData(dataDir, 'asmdef-map.json');
  const tests = readData(dataDir, 'test-inventory.json');
  const deprecations = readData(dataDir, 'deprecation-scan.json');

  const sources = present({ compileState: compile, logDigest: logs, projectSettings: settings, asmdefMap: asmdef, testInventory: tests, deprecationScan: deprecations });

  const newestScript = asRecord(compile?.newestScript);
  const latestResult = asRecord(tests?.latestResult);
  const byPattern: Record<string, number> = {};
  const rawByPattern = asRecord(deprecations?.byPattern) ?? {};
  for (const [key, value] of Object.entries(rawByPattern)) if (typeof value === 'number') byPattern[key] = value;

  const result: OfflineInspectionResult = {
    ...makeResult('offline-project-inspection', statusFromFlags(sources), 'Digest of the six offline Phase 2a readers', []),
    compile: {
      status: str(compile, 'status'),
      stale: bool(compile, 'stale'),
      noOpRecompile: bool(compile, 'noOpRecompile'),
      assemblyCount: num(compile, 'assemblyCount'),
      newestScript: str(newestScript, 'path'),
    },
    logs: { status: str(logs, 'status'), errorCount: num(logs, 'errorCount'), warningCount: num(logs, 'warningCount') },
    settings: {
      editorVersion: str(settings, 'editorVersion'),
      productName: str(settings, 'productName'),
      targetPlatform: str(settings, 'targetPlatform'),
      activeInputHandlerName: str(settings, 'activeInputHandlerName'),
      il2cpp: bool(settings, 'il2cpp'),
    },
    assemblies: { assemblyCount: num(asmdef, 'assemblyCount'), testAssemblyCount: num(asmdef, 'testAssemblyCount') },
    tests: { testAssemblyCount: num(tests, 'testAssemblyCount'), latestResult: str(latestResult, 'result') },
    deprecations: { findingCount: num(deprecations, 'findingCount'), byPattern },
    sources,
  };
  result.summary = `compile ${result.compile.status ?? 'unknown'} · ${result.logs.errorCount ?? '?'} error(s) · ${result.deprecations.findingCount ?? '?'} deprecation(s)`;
  return result;
}

// ---------------------------------------------------------------------------
// unity-api-lookup — offline symbol lookup against unity-api-quickref.json
// ---------------------------------------------------------------------------

export interface ApiLookupResult extends SenseBase {
  table: { source: 'bundle' | 'missing'; path: string | null; entryCount: number };
  query: string | null;
  matchCount: number;
  matches: ApiEntry[];
}

function matchesQuery(value: string, query: string): boolean {
  return value.toLowerCase().includes(query.toLowerCase());
}

export function unityApiLookup(options: SenseOptions): ApiLookupResult {
  const load = loadApiQuickref(options.tableDir);
  const entries = load.data?.entries ?? [];
  const query = options.query?.trim() ? options.query.trim() : null;

  const matches = query
    ? entries.filter((entry) =>
        matchesQuery(entry.symbol, query) ||
        (entry.namespace != null && matchesQuery(entry.namespace, query)) ||
        matchesQuery(entry.summary, query) ||
        (entry.replacement != null && matchesQuery(entry.replacement, query))
      )
    : entries;

  const status: SenseStatus = entries.length === 0 ? 'unavailable' : matches.length > 0 || query === null ? 'observed_locally' : 'unknown';
  const result: ApiLookupResult = {
    ...makeResult('unity-api-lookup', status, 'Offline Unity API quick reference lookup', []),
    table: { source: load.source, path: load.path, entryCount: entries.length },
    query,
    matchCount: matches.length,
    matches,
  };
  result.summary = query
    ? `${matches.length} API match(es) for "${query}"`
    : `${entries.length} API entry/ies in the quick reference`;
  if (load.source === 'missing') result.errors.push('unity-api-quickref.json not found');
  return result;
}

// ---------------------------------------------------------------------------
// platform-info — offline platform defines lookup against platform-defines.json
// ---------------------------------------------------------------------------

export interface PlatformInfoResult extends SenseBase {
  table: { source: 'bundle' | 'missing'; path: string | null; platformCount: number; versionDefineCount: number };
  query: string | null;
  platforms: PlatformEntry[];
  versionDefines: VersionDefineEntry[];
  project: { targetPlatform: string | null; activeInputHandlerName: string | null; scriptingBackend: Record<string, string>; il2cpp: boolean | null };
  activeDefines: string[];
}

export function platformInfo(options: SenseOptions): PlatformInfoResult {
  const load = loadPlatformDefines(options.tableDir);
  const platforms = load.data?.platforms ?? [];
  const versionDefines = load.data?.versionDefines ?? [];
  const query = options.query?.trim() ? options.query.trim() : null;

  const matchedPlatforms = query
    ? platforms.filter(
        (platform) =>
          matchesQuery(platform.name, query) ||
          (platform.displayName != null && matchesQuery(platform.displayName, query)) ||
          matchesQuery(platform.buildTarget, query) ||
          platform.defines.some((define) => matchesQuery(define, query))
      )
    : platforms;
  const matchedDefines = query ? versionDefines.filter((entry) => matchesQuery(entry.define, query)) : versionDefines;

  const settings = readData(projectDataDir(options), 'project-settings.json');
  const targetPlatform = str(settings, 'targetPlatform');
  const scriptingBackendRaw = asRecord(settings?.scriptingBackend) ?? {};
  const scriptingBackend: Record<string, string> = {};
  for (const [key, value] of Object.entries(scriptingBackendRaw)) if (typeof value === 'string') scriptingBackend[key] = value;

  const active = targetPlatform ? platforms.find((platform) => platform.buildTarget === targetPlatform) : undefined;
  const activeDefines = active?.defines ?? [];

  const found = matchedPlatforms.length > 0 || matchedDefines.length > 0;
  const status: SenseStatus = platforms.length === 0 && versionDefines.length === 0 ? 'unavailable' : found || query === null ? 'observed_locally' : 'unknown';

  const result: PlatformInfoResult = {
    ...makeResult('platform-info', status, 'Offline platform/build-target defines lookup', []),
    table: {
      source: load.source,
      path: load.path,
      platformCount: platforms.length,
      versionDefineCount: versionDefines.length,
    },
    query,
    platforms: matchedPlatforms,
    versionDefines: matchedDefines,
    project: {
      targetPlatform,
      activeInputHandlerName: str(settings, 'activeInputHandlerName'),
      scriptingBackend,
      il2cpp: bool(settings, 'il2cpp'),
    },
    activeDefines,
  };
  result.summary = query
    ? `${matchedPlatforms.length} platform(s), ${matchedDefines.length} version define(s) for "${query}"`
    : `${platforms.length} platform(s), ${versionDefines.length} version define(s)`;
  if (load.source === 'missing') result.errors.push('platform-defines.json not found');
  return result;
}

// ---------------------------------------------------------------------------
// version-matrix — detected version, dispatch key, feature flags, capability
// compatibility (Phase 7 Step 7.1, FR5)
// ---------------------------------------------------------------------------

export interface VersionMatrixCapability {
  id: string;
  status: VersionCompatibilityStatus;
  declaredVersions: string[];
  reason: string;
}

export interface VersionMatrixResult extends SenseBase {
  detected: {
    raw: string | null;
    valid: boolean;
    major: number | null;
    minor: number | null;
    patch: number | null;
    stream: string | null;
    dispatchKey: string | null;
    reason: string;
  };
  matrix: {
    source: 'bundle' | 'missing';
    path: string | null;
    versions: string[];
    primaryVersion: string | null;
    featureCount: number;
    features: VersionFeatureFlag[];
  };
  compatibility: {
    checked: number;
    compatible: string[];
    incompatible: string[];
    unknown: string[];
    capabilities: VersionMatrixCapability[];
  };
  sources: Record<string, boolean>;
}

function detectedEditorVersion(options: SenseOptions): string | null {
  const fromProject = editorVersionInfo(options.projectRoot).version;
  if (fromProject) return fromProject;
  const dataDir = projectDataDir(options);
  const project = readData(dataDir, 'unity-project.json');
  const settings = readData(dataDir, 'project-settings.json');
  const scan = readData(dataDir, 'scan-result.json');
  return str(project, 'unityVersion') ?? str(settings, 'editorVersion') ?? str(scan, 'unityVer');
}

function defaultCommandDir(options: SenseOptions): string | null {
  if (options.commandDir) return options.commandDir;
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(options.projectRoot, 'xdomains', 'game-dev', 'unity-3d', 'command'),
    join(options.opencodeDir, 'command'),
    join(here, '..', '..', 'game-dev', 'unity-3d', 'command'),
    join(here, '..', '..', '..', '..', 'xdomains', 'game-dev', 'unity-3d', 'command'),
  ];
  return candidates.find((candidate) => dirExists(candidate)) ?? null;
}

function declaredCapabilities(commandDir: string | null, detectedKey: string | null): VersionMatrixCapability[] {
  if (!commandDir) return [];
  let entries: string[];
  try {
    entries = readdirSync(commandDir);
  } catch {
    return [];
  }
  const out: VersionMatrixCapability[] = [];
  for (const entry of entries.sort()) {
    if (!entry.endsWith('.md')) continue;
    const text = readText(join(commandDir, entry));
    if (text === null) continue;
    const fm = parseFrontmatter(text);
    if (fm.versionCompatibility === undefined || fm.versionCompatibility === null) continue;
    const id = typeof fm.id === 'string' ? fm.id : entry.replace(/\.md$/, '');
    const check = checkVersionCompatibility(
      fm.versionCompatibility as Parameters<typeof checkVersionCompatibility>[0],
      detectedKey
    );
    out.push({ id, status: check.status, declaredVersions: check.declaredVersions, reason: check.reason });
  }
  return out;
}

export function versionMatrix(options: SenseOptions): VersionMatrixResult {
  const detectedRaw = detectedEditorVersion(options);
  const parsed = parseUnityVersion(detectedRaw);
  const load = loadVersionMatrix(options.tableDir);
  const matrix = load.data;

  const features = featureFlagsFor(matrix, parsed.dispatchKey);
  const commandDir = defaultCommandDir(options);
  const capabilities = declaredCapabilities(commandDir, parsed.dispatchKey);

  const compatible = capabilities.filter((capability) => capability.status === 'compatible').map((capability) => capability.id);
  const incompatible = capabilities.filter((capability) => capability.status === 'incompatible').map((capability) => capability.id);
  const unknown = capabilities.filter((capability) => capability.status === 'unknown').map((capability) => capability.id);

  const status: SenseStatus = !matrix ? 'unavailable' : parsed.dispatchKey ? 'observed_locally' : 'unknown';
  const result: VersionMatrixResult = {
    ...makeResult('version-matrix', status, 'Detected editor version, dispatch key, feature flags and capability compatibility', []),
    detected: {
      raw: parsed.raw,
      valid: parsed.valid,
      major: parsed.major,
      minor: parsed.minor,
      patch: parsed.patch,
      stream: parsed.stream,
      dispatchKey: parsed.dispatchKey,
      reason: parsed.reason,
    },
    matrix: {
      source: load.source,
      path: load.path,
      versions: matrix?.versions ?? [],
      primaryVersion: matrix?.primaryVersion ?? null,
      featureCount: features.length,
      features,
    },
    compatibility: {
      checked: capabilities.length,
      compatible,
      incompatible,
      unknown,
      capabilities,
    },
    sources: present({ matrix, commandDir, detectedVersion: parsed.raw }),
  };
  if (load.source === 'missing') result.errors.push('version-matrix.json not found');
  result.summary = matrix
    ? `Unity ${parsed.raw ?? 'unknown'} -> ${parsed.dispatchKey ?? 'unmapped'} · ${features.length} feature flag(s) · ${incompatible.length} incompatible capability/ies`
    : 'version-matrix.json not found';
  return result;
}

// ---------------------------------------------------------------------------
// dispatcher
// ---------------------------------------------------------------------------

export type SenseResult =
  | ProjectStatusResult
  | AssetIntelligenceResult
  | OfflineInspectionResult
  | ApiLookupResult
  | PlatformInfoResult
  | VersionMatrixResult
  | ReturnType<typeof codeNavigation>;

export function runSense(options: SenseOptions): SenseResult {
  switch (options.ability) {
    case 'project-status':
      return projectStatus(options);
    case 'asset-intelligence':
      return assetIntelligence(options);
    case 'offline-project-inspection':
      return offlineProjectInspection(options);
    case 'unity-api-lookup':
      return unityApiLookup(options);
    case 'platform-info':
      return platformInfo(options);
    case 'code-navigation':
      return codeNavigation(options);
    case 'version-matrix':
      return versionMatrix(options);
    default: {
      const exhaustive: never = options.ability;
      throw new Error(`unsupported Sense ability: ${String(exhaustive)}`);
    }
  }
}
