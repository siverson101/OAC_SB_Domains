import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileExists, nowIso, readJson } from '../../../shared/io';
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

// The version matrix lives at `xdomains/context/unity/version-matrix.json` in
// the repo and under `<opencode-dir>/xdomains/context/unity/` once installed.
// Fail-soft: a missing matrix simply skips the version-matrix doc.
function findVersionMatrix(domainDir: string, opencodeDir: string): string | null {
  const candidates = [
    join(domainDir, '..', '..', 'context', 'unity', 'version-matrix.json'),
    join(opencodeDir, 'xdomains', 'context', 'unity', 'version-matrix.json'),
    join(opencodeDir, '..', 'xdomains', 'context', 'unity', 'version-matrix.json'),
  ];
  return candidates.find((candidate) => fileExists(candidate)) ?? null;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const domainDirArg = args['domain-dir'];
  if (!domainDirArg) {
    process.stderr.write(
      'Usage: build-registry.mjs --domain-dir <dir> [--opencode-dir <dir>] [--out-json <file>] [--out-md <file>] [--docs-only]\n'
    );
    process.exitCode = 2;
    return;
  }

  const domainDir = resolve(String(domainDirArg));
  const opencodeDir = resolve(String(args['opencode-dir'] || '.opencode'));
  const registry = buildRegistry(domainDir, nowIso(), opencodeDir);
  const subdomain = registry.subdomain || 'unity';

  const docsDir = join(opencodeDir, 'context', subdomain);
  const outJson = resolve(String(args['out-json'] || join(opencodeDir, 'registry.json')));
  const outMd = resolve(String(args['out-md'] || join(docsDir, 'registry.md')));
  const outBlueprint = join(docsDir, 'agent-system-blueprint.md');
  const outVersionMatrix = join(docsDir, 'version-matrix.md');

  const paths: Record<string, string> = { blueprint: outBlueprint };
  write(outBlueprint, renderAgentSystemBlueprint(registry));

  const matrixPath = findVersionMatrix(domainDir, opencodeDir);
  const matrix = matrixPath ? readJson<VersionMatrix>(matrixPath) : null;
  if (matrix) {
    write(outVersionMatrix, renderVersionMatrixDoc(matrix, subdomain));
    paths.versionMatrix = outVersionMatrix;
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
      },
      null,
      2
    ) + '\n'
  );
}

main();
