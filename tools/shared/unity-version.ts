// Version model for the Unity 6.x line (Phase 7 Step 7.1, FR5).
//
// Maps a detected editor version (for example `6000.5.7f1`) to a structured
// version and a dispatch key matching the machine-readable matrix
// (`xdomains/context/unity/version-matrix.json`), exposes the per-version
// feature flags from that matrix, and checks a capability's declared
// `versionCompatibility` against the detected version.
//
// The editor-line -> dispatch-key mapping lives only in the matrix's `dispatch`
// map; this module never restates it. Every entry point is fail-soft: a
// malformed or absent version yields `unknown`/`null`, never a thrown error.
export type UnityDispatchKey = '6.0' | '6.3' | '6.5' | 'LTS+';

export const UNITY_DISPATCH_KEYS: UnityDispatchKey[] = ['6.0', '6.3', '6.5', 'LTS+'];

// Used only when a caller supplies no matrix (raw editor versions then cannot be
// mapped, but a key already in `UNITY_DISPATCH_KEYS` still resolves).
const FALLBACK_NEWER_DISPATCH_KEY: UnityDispatchKey = 'LTS+';

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)([A-Za-z]\d*)?$/;

export interface ParsedUnityVersion {
  raw: string | null;
  // `valid` means "parsed as a Unity version", NOT "dispatchable": an older line
  // such as `2022.3.10f1` is valid but has `dispatchKey: null`. Gate on
  // `dispatchKey` (as `checkVersionCompatibility` does), not on `valid` alone.
  valid: boolean;
  major: number | null;
  minor: number | null;
  patch: number | null;
  stream: string | null;
}

export interface UnityVersionInfo extends ParsedUnityVersion {
  dispatchKey: UnityDispatchKey | null;
  reason: string;
}

export interface VersionFeature {
  id: string;
  label: string;
  summary?: string;
  define?: string;
  since?: string;
  deprecatedSince?: string | null;
  removedSince?: string | null;
  versions: Record<string, boolean>;
}

export interface VersionMatrix {
  schemaVersion?: number;
  description?: string;
  verifyNote?: string;
  versions: string[];
  primaryVersion?: string;
  newerDispatchKey?: string;
  dispatch?: Record<string, string>;
  overlays?: Record<string, string>;
  features: VersionFeature[];
}

export interface VersionFeatureFlag {
  id: string;
  label: string;
  enabled: boolean;
  summary: string | null;
  define: string | null;
}

interface DispatchLine {
  major: number;
  minor: number;
  key: string;
}

function knownKeys(matrix: VersionMatrix | null | undefined): readonly string[] {
  return matrix?.versions ?? UNITY_DISPATCH_KEYS;
}

function isKnownKey(key: string, matrix: VersionMatrix | null | undefined): key is UnityDispatchKey {
  return knownKeys(matrix).includes(key);
}

// The matrix's `dispatch` map, parsed into editor lines sorted ascending. The
// map is the single source of the editor-line -> key mapping; anything the
// matrix does not list is resolved relative to these lines.
function dispatchLines(matrix: VersionMatrix | null | undefined): DispatchLine[] {
  const lines: DispatchLine[] = [];
  for (const [editorLine, key] of Object.entries(matrix?.dispatch ?? {})) {
    const [majorRaw, minorRaw] = editorLine.split('.');
    const major = Number(majorRaw);
    const minor = Number(minorRaw);
    if (!Number.isInteger(major) || !Number.isInteger(minor) || !key) continue;
    lines.push({ major, minor, key });
  }
  lines.sort((a, b) => a.major - b.major || a.minor - b.minor);
  return lines;
}

// `major`/`minor` are the editor line (`6000.5`), not the marketing version.
// An explicitly listed line resolves to its matrix key; an unlisted 6000.x line
// resolves to the nearest known key at or below it (so `6000.1`/`6000.2` ->
// `6.0`); a line above every known line resolves to `newerDispatchKey`. A line
// older than the lowest known key, or an absent matrix, yields `null`.
export function dispatchKeyFor(
  major: number | null,
  minor: number | null,
  matrix?: VersionMatrix | null
): UnityDispatchKey | null {
  if (major === null || minor === null) return null;
  const lines = dispatchLines(matrix);
  if (lines.length === 0) return null;

  const exact = lines.find((line) => line.major === major && line.minor === minor);
  if (exact) return isKnownKey(exact.key, matrix) ? exact.key : null;

  const highest = lines[lines.length - 1];
  if (major > highest.major || (major === highest.major && minor > highest.minor)) {
    const newer = matrix?.newerDispatchKey ?? FALLBACK_NEWER_DISPATCH_KEY;
    return isKnownKey(newer, matrix) ? newer : null;
  }

  let floor: DispatchLine | null = null;
  for (const line of lines) {
    if (line.major < major || (line.major === major && line.minor < minor)) floor = line;
  }
  return floor && isKnownKey(floor.key, matrix) ? floor.key : null;
}

export function parseUnityVersion(
  raw: string | null | undefined,
  matrix?: VersionMatrix | null
): UnityVersionInfo {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (trimmed === '') {
    return {
      raw: null,
      valid: false,
      major: null,
      minor: null,
      patch: null,
      stream: null,
      dispatchKey: null,
      reason: 'no Unity editor version detected',
    };
  }
  const match = VERSION_PATTERN.exec(trimmed);
  if (!match) {
    return {
      raw: trimmed,
      valid: false,
      major: null,
      minor: null,
      patch: null,
      stream: null,
      dispatchKey: null,
      reason: `malformed Unity editor version "${trimmed}"`,
    };
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  const stream = match[4] ?? null;
  const dispatchKey = dispatchKeyFor(major, minor, matrix);
  return {
    raw: trimmed,
    valid: true,
    major,
    minor,
    patch,
    stream,
    dispatchKey,
    reason: dispatchKey
      ? `dispatch key ${dispatchKey}`
      : `no dispatch key for Unity ${major}.${minor}; older than the supported 6.0 overlays`,
  };
}

// The feature flags that apply to one dispatch key. A missing matrix, a missing
// dispatch key, or a dispatch key the matrix does not list yields an empty list
// rather than a guess.
export function featureFlagsFor(
  matrix: VersionMatrix | null | undefined,
  dispatchKey: string | null | undefined
): VersionFeatureFlag[] {
  if (!matrix || !dispatchKey) return [];
  if (!(matrix.versions ?? []).includes(dispatchKey)) return [];
  return matrix.features.map((feature) => ({
    id: feature.id,
    label: feature.label,
    enabled: feature.versions[dispatchKey] === true,
    summary: feature.summary ?? null,
    define: feature.define ?? null,
  }));
}

export type VersionCompatibilityStatus = 'compatible' | 'incompatible' | 'unknown';

export type VersionCompatibilityDeclaration =
  | readonly string[]
  | { unity?: readonly string[] }
  | null
  | undefined;

export interface VersionCompatibilityResult {
  status: VersionCompatibilityStatus;
  reason: string;
  declaredVersions: string[];
  detectedKey: string | null;
}

function declaredVersions(declared: VersionCompatibilityDeclaration): string[] {
  if (declared === null || declared === undefined) return [];
  const list = Array.isArray(declared)
    ? declared
    : (declared as { unity?: readonly string[] }).unity;
  if (!Array.isArray(list)) return [];
  return list.filter((value): value is string => typeof value === 'string');
}

function resolveDetectedKey(
  detected: string | null | undefined,
  matrix: VersionMatrix | null | undefined
): { key: string | null; reason: string | null } {
  if (!detected) return { key: null, reason: 'no detected Unity editor version' };
  if (knownKeys(matrix).includes(detected)) return { key: detected, reason: null };
  const parsed = parseUnityVersion(detected, matrix);
  if (!parsed.valid) return { key: null, reason: parsed.reason };
  return { key: parsed.dispatchKey, reason: parsed.dispatchKey ? null : parsed.reason };
}

// `declared` is a capability's `versionCompatibility` (an array of dispatch keys
// or the `{ unity: [...] }` frontmatter object); `detected` is a dispatch key or
// a raw editor version. Both missing and forward (LTS+) comparisons are
// `unknown`, never a false `incompatible`.
export function checkVersionCompatibility(
  declared: VersionCompatibilityDeclaration,
  detected: string | null | undefined,
  matrix?: VersionMatrix | null
): VersionCompatibilityResult {
  const versions = declaredVersions(declared);
  const { key, reason } = resolveDetectedKey(detected, matrix);
  if (versions.length === 0) {
    return {
      status: 'unknown',
      reason: 'capability declares no versionCompatibility',
      declaredVersions: versions,
      detectedKey: key,
    };
  }
  if (!key) {
    return {
      status: 'unknown',
      reason: reason ?? 'no detected Unity editor version',
      declaredVersions: versions,
      detectedKey: null,
    };
  }
  if (versions.includes(key)) {
    return {
      status: 'compatible',
      reason: `declared compatibility includes ${key}`,
      declaredVersions: versions,
      detectedKey: key,
    };
  }
  if (key === (matrix?.newerDispatchKey ?? FALLBACK_NEWER_DISPATCH_KEY)) {
    return {
      status: 'unknown',
      reason: `detected ${key} is newer than the declared range (${versions.join(', ')}); forward-compatibility unverified`,
      declaredVersions: versions,
      detectedKey: key,
    };
  }
  return {
    status: 'incompatible',
    reason: `declared ${versions.join(', ')} does not include the detected dispatch key ${key}`,
    declaredVersions: versions,
    detectedKey: key,
  };
}
