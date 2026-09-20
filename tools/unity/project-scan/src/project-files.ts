import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { isExcludedFolder } from './asset-folder';
import type { FiletypesFile } from '../../../shared/context-files';

export interface ProjectFilesResult {
  folders: Record<string, Record<string, string[]>>;
  filetypeToFolder: Record<string, string[]>;
  codeFiles: string[];
}

function toPosix(path: string): string {
  return path.split(sep).join('/');
}

export function discoverProjectFiles(
  projectRoot: string,
  assetFolder: string,
  filetypes: Record<string, string>
): ProjectFilesResult {
  const folders: Record<string, Record<string, string[]>> = {};
  const filetypeToFolder: Record<string, string[]> = {};
  const codeFiles: string[] = [];

  const walk = (dir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (isExcludedFolder(entry.name)) continue;
        walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = extname(entry.name).slice(1).toLowerCase();
      if (!filetypes[ext]) continue;

      const folderKey = toPosix(relative(projectRoot, dir)) || '.';
      const assetRelFolder = toPosix(relative(assetFolder, dir)) || '.';

      folders[folderKey] ??= {};
      folders[folderKey][ext] ??= [];
      folders[folderKey][ext].push(entry.name);

      filetypeToFolder[ext] ??= [];
      if (!filetypeToFolder[ext].includes(assetRelFolder)) filetypeToFolder[ext].push(assetRelFolder);

      if (ext === 'cs') {
        const isEditor = toPosix(relative(assetFolder, dir))
          .split('/')
          .some((segment) => segment.toLowerCase() === 'editor');
        if (!isEditor) codeFiles.push(full);
      }
    }
  };

  walk(assetFolder);
  return { folders, filetypeToFolder, codeFiles };
}

export interface InputUsage {
  usesInputSystem: boolean;
  usesLegacyInput: boolean;
}

export function detectInputUsage(codeFiles: string[]): InputUsage {
  const newPattern = /UnityEngine\.InputSystem/;
  const legacyPattern = /UnityEngine\.Input(?!System)\b|\bInput\./;
  let usesInputSystem = false;
  let usesLegacyInput = false;
  for (const file of codeFiles) {
    let text: string;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (!usesInputSystem && newPattern.test(text)) usesInputSystem = true;
    if (!usesLegacyInput && legacyPattern.test(text)) usesLegacyInput = true;
    if (usesInputSystem && usesLegacyInput) break;
  }
  return { usesInputSystem, usesLegacyInput };
}
