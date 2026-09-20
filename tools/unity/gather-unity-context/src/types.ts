import type { Route } from '../../../shared/tool-routing';

export interface GatherOptions {
  projectRoot: string;
  opencodeDir: string;
  contextDir: string;
  projectDataDir: string;
  interimDir: string;
  scratchDir: string;
  subdomain: string;
  cliCommand: string;
  answersFile?: string;
  nonInteractive: boolean;
  force: boolean;
  runGate: boolean;
  promptScript: string;
}

export interface CliEnvelope<T = unknown> {
  success: boolean;
  command?: string;
  route?: Route;
  data: T | null;
  errors: { code?: string; message?: string }[];
  warnings: string[];
  raw: string;
}

export interface ProjectStructure {
  schemaVersion: number;
  generatedAt: string;
  projectName: string;
  assetFolder: string | null;
  baseFolder: string | null;
  baseFolderConfident: boolean;
  counts: Record<string, number>;
  categories: Record<string, string[]>;
  thirdPartyFolders: string[];
}
