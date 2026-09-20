import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { readText, sha256 } from '../../../shared/io';
import { unityVersionFromFile } from '../../../shared/toolchain';

export interface FingerprintInputs {
  projectName: string;
  projectPath: string;
  projectVersionFileHash: string | null;
  manifestHash: string | null;
  packagesLockHash: string | null;
  configuredUnityVersion: string | null;
}

export function fingerprintInputs(projectRoot: string, projectName: string): FingerprintInputs {
  return {
    projectName,
    projectPath: projectRoot,
    projectVersionFileHash: sha256(join(projectRoot, 'ProjectSettings', 'ProjectVersion.txt')),
    manifestHash: sha256(join(projectRoot, 'Packages', 'manifest.json')),
    packagesLockHash: sha256(join(projectRoot, 'Packages', 'packages-lock.json')),
    configuredUnityVersion: unityVersionFromFile(projectRoot),
  };
}

export function fingerprintOf(inputs: FingerprintInputs): string {
  return createHash('sha256').update(JSON.stringify(inputs)).digest('hex');
}

export function readExistingFingerprint(gateStatePath: string): string | null {
  const text = readText(gateStatePath);
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as { fingerprint?: string };
    return parsed.fingerprint ?? null;
  } catch {
    return null;
  }
}
