// Optional Unity `unity-skills` install (ADR-0019).
//
// Model B: the user initiates the download; this repository never redistributes
// the Work. The installer verifies the Unity Companion License, ensures the
// vendor path is gitignored, and records the choice in `.opencode/unity-studio.json`.
// The download is a seam so tests never touch the network.

export const UNITY_SKILLS_ABILITY = 'unity-skills';

export const UNITY_SKILLS_ABILITIES = [UNITY_SKILLS_ABILITY] as const;
export type UnitySkillsAbility = (typeof UNITY_SKILLS_ABILITIES)[number];

export {
  UNITY_SKILLS_REPO,
  VENDOR_REL,
  VENDOR_GITIGNORE_ENTRY,
  INSTALL_MARKER,
  vendorPath,
  installMarkerPath,
  readInstalledCommit,
} from '../../../shared/optional-unity-skills';

export type UnitySkillsStatus = 'installed' | 'absent' | 'refused' | 'disabled' | 'unknown';

export interface DownloadResult {
  ok: boolean;
  // The resolved commit SHA when the downloader can report it.
  commit?: string;
  error?: string;
}

// The download seam: copy/clone the upstream repo into `dest`. The default
// shells out to `git clone`; tests inject a local copy.
export type Downloader = (dest: string, ref: string | undefined) => DownloadResult;

export interface UnitySkillsOptions {
  projectRoot: string;
  opencodeDir: string;
  ability: UnitySkillsAbility;
  json: boolean;
  list: boolean;
  // Sub-commands.
  install: boolean;
  off: boolean;
  status: boolean;
  // Consent: only install when true (the CLI prompts; `--yes`/`--install` sets it).
  consent: boolean;
  uiStack: string;
  ref?: string;
  now: string;
  // A local directory to install from instead of cloning (offline/test seam).
  source?: string;
  // Test seams.
  download?: Downloader;
  confirm?: () => Promise<boolean>;
}

export interface UnitySkillsResult {
  schemaVersion: number;
  generatedAt: string;
  ability: UnitySkillsAbility;
  family: 'compose';
  mode: 'both';
  status: UnitySkillsStatus;
  summary: string;
  errors: string[];
  vendorPath: string;
  installed: boolean;
  licenseVerified: boolean;
  commit: string | null;
  uiStack: string;
  enabled: boolean;
  gitignoreUpdated: boolean;
  action: string | null;
}
