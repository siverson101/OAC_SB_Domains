// Shared constants and readers for the optional Unity `unity-skills` install
// (ADR-0019). The vendor path and the install marker are one source of truth
// for both the installer (`tools/unity/unity-skills/`) and version-drift, which
// reports the install state offline.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { asRecord } from './json-helpers';
import { readJson } from './io';

export const UNITY_SKILLS_REPO = 'https://github.com/Unity-Technologies/skills';

// Relative to the OpenCode dir. Gitignored; never redistributed.
export const VENDOR_REL = 'xdomains/vendor/unity-skills';

// The entry the installer ensures in the host project's `.gitignore`.
export const VENDOR_GITIGNORE_ENTRY = '.opencode/xdomains/vendor/';

export const INSTALL_MARKER = '.oac-unity-skills.json';

export function vendorPath(opencodeDir: string): string {
  return join(opencodeDir, VENDOR_REL);
}

export function installMarkerPath(vendorDir: string): string {
  return join(vendorDir, INSTALL_MARKER);
}

// The commit the install resolved to, if the marker is present and readable.
export function readInstalledCommit(vendorDir: string): string | null {
  const marker = installMarkerPath(vendorDir);
  if (!existsSync(marker)) return null;
  const commit = asRecord(readJson<unknown>(marker))?.commit;
  return typeof commit === 'string' && commit ? commit : null;
}
