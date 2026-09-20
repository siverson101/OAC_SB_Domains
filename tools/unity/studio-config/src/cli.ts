import { join, resolve } from 'node:path';
import { firstString, parseArgs, rejectPositionals } from '../../../shared/cli-args';
import { fileExists } from '../../../shared/io';

export interface StudioConfigOptions {
  list: boolean;
  json: boolean;
  opencodeDir: string;
  configPath: string;
  catalogPath: string | null;
}

// Look for the catalog in the installed layout (`.opencode/xdomains/context/`)
// and then the repo layout (`xdomains/context/` one level above `.opencode`).
export function findCatalog(opencodeDir: string): string | null {
  const candidates = [
    join(opencodeDir, 'xdomains', 'context', 'programming-patterns.json'),
    join(opencodeDir, '..', 'xdomains', 'context', 'programming-patterns.json'),
  ];
  for (const candidate of candidates) {
    if (fileExists(candidate)) return candidate;
  }
  return null;
}

export function resolveOptions(argv: string[]): StudioConfigOptions {
  const { values: args, positional } = parseArgs(argv);
  rejectPositionals(positional);
  const opencodeDir = resolve(String(args['opencode-dir'] || '.opencode'));
  const configArg = firstString(args, ['config']);
  const catalogArg = firstString(args, ['catalog']);
  return {
    list: Boolean(args.list),
    json: Boolean(args.json),
    opencodeDir,
    configPath: configArg ? resolve(configArg) : join(opencodeDir, 'unity-studio.json'),
    catalogPath: catalogArg ? resolve(catalogArg) : findCatalog(opencodeDir),
  };
}
