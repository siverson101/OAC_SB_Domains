import { isAbsolute, resolve } from 'node:path';
import { fileExists } from '../../../shared/io';
import type { PromptClient } from '../../../shared/prompt-client';
import type { NativeArtifact, NativeState, SubProject } from '../../../shared/types';

export interface SubProjectsResult {
  native: NativeState | null;
  subProjects: Record<string, SubProject>;
}

async function gatherNative(basePath: string, name: string, prompts: PromptClient): Promise<NativeState> {
  const meta = await prompts.ask({
    title: `Native build: ${name}`,
    questions: [
      { id: 'solution', type: 'text', message: 'Solution path (relative to the sub-project root)' },
      { id: 'configuration', type: 'text', message: 'Configuration', defaultValue: 'Release' },
      { id: 'platform', type: 'text', message: 'Platform', defaultValue: 'x64' },
    ],
  });
  const solution = String(meta.solution || '').trim();
  const configuration = String(meta.configuration || 'Release');
  const platform = String(meta.platform || 'x64');

  const artifacts: NativeArtifact[] = [];
  for (;;) {
    const add = await prompts.ask({
      title: `Artifacts: ${name}`,
      questions: [
        {
          id: 'moreArtifacts',
          type: 'confirm',
          message: 'Add an artifact (DLL) to this native build?',
          initialValue: artifacts.length === 0,
        },
      ],
    });
    if (add.moreArtifacts !== true) break;

    const fields = await prompts.ask({
      title: `Artifact: ${name}`,
      questions: [
        { id: 'artName', type: 'text', message: 'Artifact name' },
        { id: 'artKind', type: 'text', message: 'Kind / hint (e.g. loader, core)' },
        { id: 'artPath', type: 'text', message: 'Artifact path (relative to the sub-project root)' },
        { id: 'artPdb', type: 'text', message: 'PDB path (optional)' },
      ],
    });
    const path = String(fields.artPath || '').trim();
    const pdb = String(fields.artPdb || '').trim();
    artifacts.push({
      name: String(fields.artName || '').trim(),
      kind: String(fields.artKind || '').trim(),
      path,
      pdb: pdb || undefined,
      exists: path ? fileExists(resolve(basePath, path)) : false,
      pdbExists: pdb ? fileExists(resolve(basePath, pdb)) : undefined,
    });
  }

  return {
    status: solution ? 'declared' : 'unavailable',
    solution: solution || null,
    solutionExists: solution ? fileExists(resolve(basePath, solution)) : false,
    configuration,
    platform,
    artifacts,
  };
}

export async function runSubProjects(
  projectRoot: string,
  projectName: string,
  prompts: PromptClient
): Promise<SubProjectsResult> {
  const subProjects: Record<string, SubProject> = {};
  let native: NativeState | null = null;

  const main = await prompts.ask({
    title: 'Native build',
    questions: [
      {
        id: 'hasNative',
        type: 'confirm',
        message: `Does ${projectName} compile native (C++/C) code?`,
        initialValue: false,
      },
    ],
  });
  if (main.hasNative === true) {
    native = await gatherNative(projectRoot, projectName, prompts);
  }

  for (;;) {
    const more = await prompts.ask({
      title: 'Sub-projects',
      questions: [
        {
          id: 'hasSubProject',
          type: 'confirm',
          message: 'Is there another sub-project that needs to compile?',
          initialValue: false,
        },
      ],
    });
    if (more.hasSubProject !== true) break;

    const meta = await prompts.ask({
      title: 'Sub-project',
      questions: [
        { id: 'subName', type: 'text', message: 'Sub-project name' },
        { id: 'subPath', type: 'text', message: 'Path (absolute or relative to the project root)' },
        { id: 'subLanguage', type: 'text', message: 'Language', defaultValue: 'cpp' },
        { id: 'subKind', type: 'text', message: 'Kind / hint (e.g. loader, core)' },
      ],
    });
    const name = String(meta.subName || '').trim();
    const path = String(meta.subPath || '').trim();
    if (!name || !path) break;

    const absPath = isAbsolute(path) ? path : resolve(projectRoot, path);
    const nativeState = await gatherNative(absPath, name, prompts);
    subProjects[name] = {
      path: absPath,
      language: String(meta.subLanguage || 'cpp'),
      kind: String(meta.subKind || ''),
      native: {
        solution: nativeState.solution ?? '',
        configuration: nativeState.configuration ?? 'Release',
        platform: nativeState.platform ?? 'x64',
        artifacts: nativeState.artifacts,
      },
    };
  }

  return { native, subProjects };
}
