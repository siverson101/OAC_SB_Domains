import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GatherOptions } from './types';

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith('--') && arg.includes('=')) {
      const eq = arg.indexOf('=');
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
      i++;
      continue;
    }
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out[key] = next;
        i += 2;
      } else {
        out[key] = true;
        i++;
      }
      continue;
    }
    i++;
  }
  return out;
}

export function resolveOptions(argv: string[]): GatherOptions {
  const args = parseArgs(argv);
  const projectRoot = resolve(String(args['project-root'] || process.cwd()));
  const opencodeDir = resolve(String(args['opencode-dir'] || join(projectRoot, '.opencode')));
  const contextDir = resolve(String(args['context-dir'] || join(opencodeDir, 'xdomains', 'context')));
  const projectDataDir = resolve(String(args['project-data-dir'] || join(opencodeDir, 'project-data')));
  const interimDir = resolve(String(args['interim-dir'] || join(contextDir, 'project')));
  const subdomain = String(args.subdomain || 'unity');
  const scratchDir = resolve(String(args['scratch-dir'] || join(opencodeDir, '.scratch', subdomain)));

  const here = dirname(fileURLToPath(import.meta.url));
  const promptScript = resolve(String(args.prompt || join(here, '..', 'shared', 'prompt.mjs')));

  return {
    projectRoot,
    opencodeDir,
    contextDir,
    projectDataDir,
    interimDir,
    scratchDir,
    subdomain,
    cliCommand: String(args['unity-cli'] || 'unity'),
    answersFile: args['answers'] ? resolve(String(args['answers'])) : undefined,
    nonInteractive: Boolean(args['non-interactive']),
    force: Boolean(args.force),
    runGate: Boolean(args.gate),
    promptScript,
  };
}
