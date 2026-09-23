// Optional Unity `unity-skills` installer (ADR-0019).
//
// Pure-ish: the network download is a seam, so the verification, gitignore, and
// config behaviour is testable without a network. The install path is only ever
// the gitignored vendor dir; no Unity source enters a tracked path.

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { asRecord } from '../../../shared/json-helpers';
import { readText, writeJson } from '../../../shared/io';
import {
  UNITY_SKILLS_REPO,
  VENDOR_GITIGNORE_ENTRY,
  installMarkerPath,
  vendorPath,
} from '../../../shared/optional-unity-skills';
import type { DownloadResult, UnitySkillsOptions, UnitySkillsResult, UnitySkillsStatus } from './types';

// The repository must actually contain the `skills/` tree; a LICENSE-only
// checkout is a failed install, not a usable one.
export function verifySkillsDir(vendorDir: string): { ok: boolean; reason: string } {
  const skillsDir = join(vendorDir, 'skills');
  if (!existsSync(skillsDir)) return { ok: false, reason: 'the downloaded repository has no skills/ directory' };
  return { ok: true, reason: 'skills/ present' };
}

export function verifyLicense(vendorDir: string): { ok: boolean; reason: string } {
  const licensePath = join(vendorDir, 'LICENSE.md');
  if (!existsSync(licensePath)) return { ok: false, reason: 'LICENSE.md is missing from the downloaded repository' };
  const text = readText(licensePath) ?? '';
  if (!/Unity Companion License/i.test(text)) {
    return { ok: false, reason: 'LICENSE.md does not name the Unity Companion License' };
  }
  if (!/Unity Technologies/i.test(text)) {
    return { ok: false, reason: 'LICENSE.md has no Unity Technologies copyright line' };
  }
  return { ok: true, reason: 'Unity Companion License verified' };
}

// The default downloader: a shallow clone, then record HEAD and drop `.git`.
export function gitDownload(dest: string, ref: string | undefined): DownloadResult {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dirname(dest), { recursive: true });
  const args = ['clone', '--depth', '1'];
  if (ref) args.push('--branch', ref);
  args.push(UNITY_SKILLS_REPO, dest);
  const clone = spawnSync('git', args, { encoding: 'utf8' });
  if (clone.status !== 0) {
    return { ok: false, error: (clone.stderr || '').trim() || `git clone exited ${clone.status}` };
  }
  const head = spawnSync('git', ['-C', dest, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  const commit = head.status === 0 ? (head.stdout || '').trim() : undefined;
  rmSync(join(dest, '.git'), { recursive: true, force: true });
  return { ok: true, commit };
}

function readConfig(opencodeDir: string): Record<string, unknown> {
  const text = readText(join(opencodeDir, 'unity-studio.json'));
  if (!text) return {};
  try {
    return asRecord(JSON.parse(text)) ?? {};
  } catch {
    return {};
  }
}

function writeConfig(opencodeDir: string, config: Record<string, unknown>): void {
  mkdirSync(opencodeDir, { recursive: true });
  writeJson(join(opencodeDir, 'unity-studio.json'), config);
}

function setToggle(opencodeDir: string, enabled: boolean, uiStack: string): void {
  const config = readConfig(opencodeDir);
  if (typeof config.schemaVersion !== 'number') config.schemaVersion = 1;
  const toggles = asRecord(config.toggles) ?? {};
  toggles.unitySkills = enabled;
  config.toggles = toggles;
  config.uiStack = uiStack;
  writeConfig(opencodeDir, config);
}

// A local-source downloader (offline install / tests): copies a directory that
// already contains the repository contents.
export function localDownload(sourceDir: string) {
  return (dest: string): DownloadResult => {
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(sourceDir, dest, { recursive: true });
    return { ok: true };
  };
}

export function ensureGitignore(projectRoot: string, entry = VENDOR_GITIGNORE_ENTRY): boolean {
  const file = join(projectRoot, '.gitignore');
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const lines = text.split(/\r?\n/);
  if (lines.some((line) => line.trim() === entry)) return false;
  const next = text && !text.endsWith('\n') ? `${text}\n${entry}\n` : `${text}${entry}\n`;
  writeFileSync(file, next);
  return true;
}

// A `.gitignore` inside the vendor dir is belt-and-braces: even if the host
// project is not a git repo, the downloaded Work is never tracked.
function writeVendorGitignore(vendorDir: string): void {
  mkdirSync(vendorDir, { recursive: true });
  writeFileSync(join(vendorDir, '.gitignore'), '*\n');
}

function baseResult(options: UnitySkillsOptions, status: UnitySkillsStatus, summary: string): UnitySkillsResult {
  return {
    schemaVersion: 1,
    generatedAt: options.now,
    ability: options.ability,
    family: 'compose',
    mode: 'both',
    status,
    summary,
    errors: [],
    vendorPath: vendorPath(options.opencodeDir),
    installed: existsSync(vendorPath(options.opencodeDir)),
    licenseVerified: false,
    commit: null,
    uiStack: options.uiStack,
    enabled: readConfig(options.opencodeDir).toggles
      ? (asRecord(readConfig(options.opencodeDir).toggles)?.unitySkills === true)
      : false,
    gitignoreUpdated: false,
    action: null,
  };
}

export async function runUnitySkills(options: UnitySkillsOptions): Promise<UnitySkillsResult> {
  const vendor = vendorPath(options.opencodeDir);

  if (options.off) {
    setToggle(options.opencodeDir, false, options.uiStack);
    const result = baseResult(options, 'disabled', 'Unity skills disabled; re-apply to restore the base agents.');
    result.enabled = false;
    result.action = 'Run the domain apply step (or /unity-studio-mode) to swap back to the base agents.';
    return result;
  }

  if (options.status || (!options.install && !options.off)) {
    if (!existsSync(vendor)) return baseResult(options, 'absent', 'Unity skills are not installed.');
    const license = verifyLicense(vendor);
    const result = baseResult(options, 'installed', `Unity skills installed${license.ok ? '' : ` (license: ${license.reason})`}.`);
    result.licenseVerified = license.ok;
    return result;
  }

  // install
  const consent = options.consent || (options.confirm ? await options.confirm() : false);
  if (!consent) {
    return baseResult(options, 'refused', 'Install declined; no changes made.');
  }

  const download = options.download ?? gitDownload;
  const downloaded = download(vendor, options.ref);
  if (!downloaded.ok) {
    rmSync(vendor, { recursive: true, force: true });
    const result = baseResult(options, 'refused', `Download failed: ${downloaded.error ?? 'unknown error'}`);
    result.errors.push(downloaded.error ?? 'download failed');
    return result;
  }

  const license = verifyLicense(vendor);
  const skillsDir = license.ok ? verifySkillsDir(vendor) : { ok: false, reason: '' };
  const failure = !license.ok ? license.reason : !skillsDir.ok ? skillsDir.reason : null;
  if (failure) {
    rmSync(vendor, { recursive: true, force: true });
    const result = baseResult(options, 'refused', `Install verification failed: ${failure}. Partial download removed.`);
    result.errors.push(failure);
    return result;
  }

  writeVendorGitignore(vendor);
  writeJson(installMarkerPath(vendor), {
    schemaVersion: 1,
    repo: UNITY_SKILLS_REPO,
    commit: downloaded.commit ?? null,
    installedAt: options.now,
  });
  const gitignoreUpdated = ensureGitignore(options.projectRoot);
  setToggle(options.opencodeDir, true, options.uiStack);

  const result = baseResult(options, 'installed', `Unity skills installed at ${vendor} (${license.reason}).`);
  result.licenseVerified = true;
  result.installed = true;
  result.enabled = true;
  result.commit = downloaded.commit ?? null;
  result.gitignoreUpdated = gitignoreUpdated;
  result.action = 'Run the domain apply step (or /unity-studio-mode) so the apply engine resolves the sk agent variants.';
  return result;
}
