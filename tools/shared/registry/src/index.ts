import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileExists, nowIso, readJson, toPosix } from '../../../shared/io';
import type { VersionMatrix } from '../../unity-version';
import { buildRegistry } from './build';
import { renderAgentSystemBlueprint, renderRegistry, renderVersionMatrixDoc } from './render';

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

function write(path: string, body: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
}

// The version matrix lives at `xdomains/context/unity/version-matrix.json`.
// Resolve it the same way `defaultXdomainsPath` does: the installed layout
// first, then the source layout. Fail-soft, but a caller whose layout matches
// neither gets the searched paths back (never a silent skip).
export function findVersionMatrix(domainDir: string, opencodeDir: string): { path: string | null; searched: string[] } {
  const candidates = [
    // Installed layout: the distributed tree under `<opencode-dir>/xdomains/`.
    join(opencodeDir, 'xdomains', 'context', 'unity', 'version-matrix.json'),
    // Source layout: `<repo>/xdomains/`, reached from the domain dir
    // (`xdomains/<domain>/<subdomain>`) or from the project root beside opencodeDir.
    join(domainDir, '..', '..', 'context', 'unity', 'version-matrix.json'),
    join(opencodeDir, '..', 'xdomains', 'context', 'unity', 'version-matrix.json'),
  ];
  return { path: candidates.find((candidate) => fileExists(candidate)) ?? null, searched: candidates };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const domainDirArg = args['domain-dir'];
  if (!domainDirArg) {
    process.stderr.write(
      'Usage: build-registry.mjs --domain-dir <dir> [--opencode-dir <dir>] [--studio-config <file>] [--out-json <file>] [--out-md <file>] [--docs-only]\n'
    );
    process.exitCode = 2;
    return;
  }

  const domainDir = resolve(String(domainDirArg));
  const opencodeDir = resolve(String(args['opencode-dir'] || '.opencode'));
  const studioConfigPath = args['studio-config'] ? String(args['studio-config']) : undefined;
  const registry = buildRegistry(domainDir, nowIso(), opencodeDir, studioConfigPath);
  const subdomain = registry.subdomain || 'unity';

  const docsDir = join(opencodeDir, 'context', subdomain);
  const outJson = resolve(String(args['out-json'] || join(opencodeDir, 'registry.json')));
  const outMd = resolve(String(args['out-md'] || join(docsDir, 'registry.md')));
  const outBlueprint = join(docsDir, 'agent-system-blueprint.md');
  const outVersionMatrix = join(docsDir, 'version-matrix.md');

  const paths: Record<string, string> = { blueprint: outBlueprint };
  write(outBlueprint, renderAgentSystemBlueprint(registry));

  const warnings: string[] = [];
  const { path: matrixPath, searched } = findVersionMatrix(domainDir, opencodeDir);
  const matrix = matrixPath ? readJson<VersionMatrix>(matrixPath) : null;
  if (matrix) {
    write(outVersionMatrix, renderVersionMatrixDoc(matrix, subdomain));
    paths.versionMatrix = outVersionMatrix;
  } else {
    const message = `version-matrix.json not found; searched: ${searched.map(toPosix).join(', ')}`;
    warnings.push(message);
    process.stderr.write(`warning: ${message}\n`);
  }

  if (!args['docs-only']) {
    write(outJson, JSON.stringify(registry, null, 2) + '\n');
    write(outMd, renderRegistry(registry));
    paths.json = outJson;
    paths.markdown = outMd;
  }

  process.stdout.write(
    JSON.stringify(
      {
        generatedAt: registry.generatedAt,
        domain: registry.domain,
        subdomain: registry.subdomain,
        counts: registry.counts,
        paths,
        warnings,
      },
      null,
      2
    ) + '\n'
  );
}

main();
