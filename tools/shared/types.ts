export type QuestionType = 'select' | 'multiselect' | 'text' | 'confirm';

export interface PromptOption {
  value: string;
  label: string;
  hint?: string;
}

export interface PromptQuestion {
  id: string;
  type: QuestionType;
  message: string;
  options?: PromptOption[];
  initialValue?: string | boolean;
  initialValues?: string[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}

export interface PromptSpec {
  title?: string;
  questions: PromptQuestion[];
}

export interface UnityEnv {
  userDataPath?: string;
  editorInstallPath?: string;
  downloadCachePath?: string;
  configPath?: string;
  hubVersion?: string;
  proxy?: unknown;
}

export interface ProjectInfo {
  title?: string;
  path?: string;
  version?: string;
  changeset?: string;
  architecture?: string;
  buildTarget?: string;
  renderPipeline?: string;
  scriptingBackend?: Record<string, string>;
  localProjectId?: string;
  cloudProjectId?: string;
  organizationId?: string;
  vcsProvider?: string;
  repositoryName?: string;
  lastModified?: number;
  packages?: Record<string, string>;
}

export interface PackageEntry {
  name: string;
  manifestVersion: string | null;
  lockEntry: unknown | null;
  manifestPath: string;
  lockPath: string;
  status: string;
}

export interface NativeArtifact {
  name: string;
  kind: string;
  path: string;
  pdb?: string;
  exists?: boolean;
  pdbExists?: boolean;
}

export interface NativeState {
  status: string;
  solution: string | null;
  solutionExists: boolean;
  configuration: string | null;
  platform: string | null;
  artifacts: NativeArtifact[];
}

export interface SubProject {
  path: string;
  language: string;
  kind: string;
  native: {
    solution: string;
    configuration: string;
    platform: string;
    artifacts: NativeArtifact[];
  };
}

export interface ProjectPref {
  packageChoices: Record<string, string>;
  patterns: Record<string, string | string[]>;
  deferredChoices: Record<string, string[]>;
  usesInputSystem: boolean;
  usesLegacyInput: boolean;
}

export interface ScanOptions {
  projectRoot: string;
  opencodeDir: string;
  contextDir: string;
  projectDataDir: string;
  interimDir: string;
  answersFile?: string;
  nonInteractive: boolean;
  reask: boolean;
  force: boolean;
  promptScript: string;
}
