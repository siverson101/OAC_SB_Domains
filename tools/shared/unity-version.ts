// Version model for the Unity 6.x line (Phase 7 Step 7.1, FR5).
//
// Maps a detected editor version (for example `6000.5.7f1`) to a structured
// version and a dispatch key (`6.0`/`6.3`/`6.5`/`LTS+`) matching
// `xdomains/game-dev/unity-3d/context/unity-3d/knowledge/version-dispatch.md`,
// exposes the per-version feature flags from
// `xdomains/context/unity/version-matrix.json`, and checks a capability's
// declared `versionCompatibility` against the detected version.
//
// Every entry point is fail-soft: a malformed or absent version yields
// `unknown`/`null`, never a thrown error.
export type UnityDispatchKey = '6.0' | '6.3' | '6.5' | 'LTS+';

export const UNITY_DISPATCH_KEYS: UnityDispatchKey[] = ['6.0', '6.3', '6.5', 'LTS+'];

const KNOWN_DISPATCH: Record<string, UnityDispatchKey> = {
  '6000.0': '6.0',
  '6000.3': '6.3',
  '6000.5': '6.5',
};

const NEWER_DISPATCH_KEY: UnityDispatchKey = 'LTS+';

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)([A-Za-z]\d*)?$/;

export interface ParsedUnityVersion {
  raw: string | null;
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

// `major`/`minor` are the editor line (`6000.5`), not the marketing version.
export function dispatchKeyFor(major: number | null, minor: number | null): UnityDispatchKey | null {
  if (major === null || minor === null) return null;
  const known = KNOWN_DISPATCH[`${major}.${minor}`];
  if (known) return known;
  if (major > 6000 || (major === 6000 && minor > 5)) return NEWER_DISPATCH_KEY;
  return null;
}

export function parseUnityVersion(raw: string | null | undefined): UnityVersionInfo {
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
  const dispatchKey = dispatchKeyFor(major, minor);
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

function resolveDetectedKey(detected: string | null | undefined): { key: string | null; reason: string | null } {
  if (!detected) return { key: null, reason: 'no detected Unity editor version' };
  if ((UNITY_DISPATCH_KEYS as readonly string[]).includes(detected)) return { key: detected, reason: null };
  const parsed = parseUnityVersion(detected);
  if (!parsed.valid) return { key: null, reason: parsed.reason };
  return { key: parsed.dispatchKey, reason: parsed.dispatchKey ? null : parsed.reason };
}

// `declared` is a capability's `versionCompatibility` (an array of dispatch keys
// or the `{ unity: [...] }` frontmatter object); `detected` is a dispatch key or
// a raw editor version. Both missing and forward (LTS+) comparisons are
// `unknown`, never a false `incompatible`.
export function checkVersionCompatibility(
  declared: VersionCompatibilityDeclaration,
  detected: string | null | undefined
): VersionCompatibilityResult {
  const versions = declaredVersions(declared);
  const { key, reason } = resolveDetectedKey(detected);
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
  if (key === NEWER_DISPATCH_KEY) {
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
