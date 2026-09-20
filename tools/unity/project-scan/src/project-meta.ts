import { nowIso } from '../../../shared/io';
import type { NativeState, ProjectInfo, SubProject, UnityEnv } from '../../../shared/types';

export interface ProjectMetaInput {
  name: string;
  path: string;
  info: ProjectInfo | null;
  unityVer: string | null;
  env: UnityEnv | null;
  native: NativeState | null;
  subProjects: Record<string, SubProject>;
}

export function buildProjectJson(input: ProjectMetaInput): Record<string, unknown> {
  const info = input.info ?? {};
  return {
    schemaVersion: 1,
    generatedAt: nowIso(),
    project: {
      name: input.name,
      path: input.path,
      version: input.unityVer ?? info.version ?? null,
      changeset: info.changeset ?? null,
      architecture: info.architecture ?? null,
      buildTarget: info.buildTarget ?? null,
      renderPipeline: info.renderPipeline ?? null,
      scriptingBackend: info.scriptingBackend ?? null,
      localProjectId: info.localProjectId ?? null,
      cloudProjectId: info.cloudProjectId ?? null,
      organizationId: info.organizationId ?? null,
      vcsProvider: info.vcsProvider ?? null,
      repositoryName: info.repositoryName ?? null,
      lastModified: info.lastModified ?? null,
      editorInstallPath: input.env?.editorInstallPath ?? null,
      native: input.native,
      subProjects: input.subProjects,
    },
  };
}
