import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { PromptClient } from '../../../shared/prompt-client';

export const EXCLUDE_FOLDERS = ['Packages', 'Plugins', 'Library', 'Text Mesh Pro', 'ThirdParty'];
export const MAX_DEPTH = 4;

export function isExcludedFolder(name: string): boolean {
  return EXCLUDE_FOLDERS.some((folder) => folder.toLowerCase() === name.toLowerCase());
}

export function pathContainsExcluded(projectRoot: string, path: string): boolean {
  const rel = relative(projectRoot, path);
  return rel.split(sep).some((segment) => isExcludedFolder(segment));
}

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

interface Candidate {
  path: string;
  depth: number;
}

function collectAssetCandidates(projectRoot: string): Candidate[] {
  const found: Candidate[] = [];
  const walk = (dir: string, depth: number): void => {
    if (depth > MAX_DEPTH) return;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.startsWith('.')) continue;
      if (isExcludedFolder(entry)) continue;
      const full = join(dir, entry);
      if (!isDir(full)) continue;
      if (entry.toLowerCase() === 'assets') {
        found.push({ path: full, depth });
        continue;
      }
      walk(full, depth + 1);
    }
  };
  walk(projectRoot, 1);
  return found;
}

export interface AssetFolderResult {
  foundProject: boolean;
  assetFolder: string | null;
}

export async function discoverAssetFolder(projectRoot: string, prompts: PromptClient): Promise<AssetFolderResult> {
  const rootAssets = join(projectRoot, 'Assets');
  if (isDir(rootAssets)) return { foundProject: true, assetFolder: rootAssets };

  const candidates = collectAssetCandidates(projectRoot);
  const depth1 = candidates.filter((c) => c.depth === 1);
  const depth2 = candidates.filter((c) => c.depth === 2);

  if (depth1.length === 1) return { foundProject: true, assetFolder: depth1[0].path };
  if (depth2.length === 1) return { foundProject: true, assetFolder: depth2[0].path };

  if (candidates.length === 1) return { foundProject: true, assetFolder: candidates[0].path };
  if (candidates.length === 0) return { foundProject: false, assetFolder: null };

  const options = candidates.map((c) => ({
    value: c.path,
    label: relative(projectRoot, c.path).split(sep).join('/'),
  }));
  const answers = await prompts.ask({
    title: 'Assets folder',
    questions: [
      {
        id: 'assetFolder',
        type: 'select',
        message: 'Multiple Assets folders were found. Which one is the project?',
        options,
      },
    ],
  });
  return { foundProject: true, assetFolder: String(answers.assetFolder) };
}
