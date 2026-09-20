import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { EXCLUDE_FOLDERS, isExcludedFolder } from '../../project-scan/src/asset-folder';
import { nowIso } from '../../../shared/io';
import type { PromptClient } from '../../../shared/prompt-client';
import type { ProjectStructure } from './types';

const CATEGORY_BY_EXT: Record<string, string> = {
  asmdef: 'asmdefs',
  uxml: 'uxml',
  uss: 'uss',
  unity: 'scenes',
  prefab: 'prefabs',
  fbx: 'models',
  obj: 'models',
  blend: 'models',
  dae: 'models',
  '3ds': 'models',
  max: 'models',
  ma: 'models',
  mb: 'models',
  png: 'images',
  jpg: 'images',
  jpeg: 'images',
  tga: 'images',
  psd: 'images',
  tif: 'images',
  tiff: 'images',
  exr: 'images',
  hdr: 'images',
  bmp: 'images',
  gif: 'images',
  wav: 'audio',
  mp3: 'audio',
  ogg: 'audio',
  aiff: 'audio',
  aif: 'audio',
  flac: 'audio',
  mod: 'audio',
  it: 'audio',
  s3m: 'audio',
  xm: 'audio',
  inputactions: 'actionMaps',
  shader: 'shaders',
  cginc: 'shaders',
  hlsl: 'shaders',
  compute: 'compute',
  dll: 'nativeLibraries',
  so: 'nativeLibraries',
  dylib: 'nativeLibraries',
  a: 'nativeLibraries',
  lib: 'nativeLibraries',
  bundle: 'nativeLibraries',
  framework: 'nativeLibraries',
};

function toPosix(path: string): string {
  return path.split(sep).join('/');
}

function hasEditorSegment(relPath: string): boolean {
  return toPosix(relPath)
    .split('/')
    .some((segment) => segment.toLowerCase() === 'editor');
}

function isSpriteMeta(metaPath: string): boolean {
  try {
    return /textureType:\s*8\b/.test(readFileSync(metaPath, 'utf8'));
  } catch {
    return false;
  }
}

export interface StructureScanInput {
  projectRoot: string;
  assetFolder: string;
  projectName: string;
  prompts: PromptClient;
}

export async function discoverProjectStructure(input: StructureScanInput): Promise<ProjectStructure> {
  const { projectRoot, assetFolder, projectName, prompts } = input;
  const categories: Record<string, string[]> = {};
  const add = (category: string, value: string): void => {
    (categories[category] ??= []).push(value);
  };

  const topLevelCounts: Record<string, number> = {};
  let total = 0;

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
      const rel = toPosix(relative(projectRoot, full));
      const relFromAsset = toPosix(relative(assetFolder, full));

      if (ext === 'cs') {
        add(hasEditorSegment(relFromAsset) ? 'editorScripts' : 'runtimeScripts', rel);
      } else {
        const category = CATEGORY_BY_EXT[ext];
        if (!category) continue;
        add(category, rel);
        if (category === 'images' && isSpriteMeta(full + '.meta')) add('sprites', rel);
      }
      total++;
      const top = relFromAsset.includes('/') ? relFromAsset.split('/')[0] : '.';
      topLevelCounts[top] = (topLevelCounts[top] ?? 0) + 1;
    }
  };
  walk(assetFolder);

  const thirdPartyFolders = (() => {
    try {
      return readdirSync(assetFolder, { withFileTypes: true })
        .filter((e) => e.isDirectory() && EXCLUDE_FOLDERS.some((f) => f.toLowerCase() === e.name.toLowerCase()))
        .map((e) => toPosix(join(relative(projectRoot, assetFolder), e.name)));
    } catch {
      return [];
    }
  })();

  const { baseFolder, baseFolderConfident } = await resolveBaseFolder(
    projectRoot,
    assetFolder,
    topLevelCounts,
    total,
    prompts
  );

  const counts: Record<string, number> = {};
  for (const [category, files] of Object.entries(categories)) counts[category] = files.length;

  return {
    schemaVersion: 1,
    generatedAt: nowIso(),
    projectName,
    assetFolder: toPosix(relative(projectRoot, assetFolder)),
    baseFolder,
    baseFolderConfident,
    counts,
    categories,
    thirdPartyFolders,
  };
}

async function resolveBaseFolder(
  projectRoot: string,
  assetFolder: string,
  topLevelCounts: Record<string, number>,
  total: number,
  prompts: PromptClient
): Promise<{ baseFolder: string; baseFolderConfident: boolean }> {
  const assetRel = toPosix(relative(projectRoot, assetFolder)) || 'Assets';
  const ranked = Object.entries(topLevelCounts).sort((a, b) => b[1] - a[1]);
  const rootCount = topLevelCounts['.'] ?? 0;

  if (total === 0) return { baseFolder: assetRel, baseFolderConfident: false };

  const [topName, topCount] = ranked[0] ?? ['.', 0];
  if (topName !== '.' && topCount / total >= 0.6) {
    return { baseFolder: `${assetRel}/${topName}`, baseFolderConfident: true };
  }
  if (rootCount / total >= 0.5) {
    return { baseFolder: assetRel, baseFolderConfident: true };
  }

  const candidates = ranked
    .filter(([name]) => name !== '.')
    .map(([name, count]) => ({
      value: `${assetRel}/${name}`,
      label: `${name} (${count} files)`,
    }));
  const options = [{ value: assetRel, label: `${assetRel} (${rootCount} files)` }, ...candidates];
  const answers = await prompts.ask({
    title: 'Project base folder',
    questions: [
      {
        id: 'baseFolder',
        type: 'select',
        message: 'Which folder is the base for this project?',
        options,
      },
    ],
  });
  const chosen = String(answers.baseFolder || assetRel);
  return { baseFolder: chosen, baseFolderConfident: false };
}
