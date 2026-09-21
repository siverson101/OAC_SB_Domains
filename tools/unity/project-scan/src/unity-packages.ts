import { join } from 'node:path';
import { fileExists, readJson, sha256 } from '../../../shared/io';
import { readManifestDependencies } from '../../../shared/unity-manifest';
import type { PackageEntry, ProjectInfo } from '../../../shared/types';

interface LockEntry {
  version?: string;
  depth?: number;
  source?: string;
  dependencies?: Record<string, string>;
  url?: string;
}

interface PackagesLock {
  dependencies?: Record<string, LockEntry>;
}

export interface UnityPackagesResult {
  map: Record<string, string>;
  packages: PackageEntry[];
  manifestPath: string;
  lockPath: string;
  manifestHash: string | null;
  lockHash: string | null;
  hasManifest: boolean;
  hasLock: boolean;
}

export function readUnityPackages(projectRoot: string, info: ProjectInfo | null): UnityPackagesResult {
  const manifestPath = join(projectRoot, 'Packages', 'manifest.json');
  const lockPath = join(projectRoot, 'Packages', 'packages-lock.json');
  const manifest = readManifestDependencies(manifestPath);
  const lock = readJson<PackagesLock>(lockPath);
  const manifestDeps = manifest.dependencies ?? {};
  const lockDeps = lock?.dependencies ?? {};

  const map: Record<string, string> = {};
  if (info?.packages) Object.assign(map, info.packages);
  for (const [name, version] of Object.entries(manifestDeps)) {
    if (!(name in map)) map[name] = String(version);
  }

  const names = Array.from(new Set([...Object.keys(manifestDeps), ...Object.keys(lockDeps)])).sort();
  const packages: PackageEntry[] = names.map((name) => ({
    name,
    manifestVersion: name in manifestDeps ? String(manifestDeps[name]) : null,
    lockEntry: lockDeps[name] ?? null,
    manifestPath,
    lockPath,
    status: name in manifestDeps || name in lockDeps ? 'observed_locally' : 'unavailable',
  }));

  return {
    map,
    packages,
    manifestPath,
    lockPath,
    manifestHash: sha256(manifestPath),
    lockHash: sha256(lockPath),
    hasManifest: manifest.present,
    hasLock: fileExists(lockPath),
  };
}

export function applySyntheticBuiltins(map: Record<string, string>, usesLegacyInput: boolean): void {
  if (usesLegacyInput) map['com.unity.builtin.input_manager'] = 'builtin';
  map['com.unity.builtin.camera'] = 'builtin';
}
