import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { nowIso } from '../../../shared/io';
import { buildRegistry } from './build';
import { renderRegistry } from './render';

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

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const domainDirArg = args['domain-dir'];
  if (!domainDirArg) {
    process.stderr.write('Usage: build-registry.mjs --domain-dir <dir> [--opencode-dir <dir>] [--out-json <file>] [--out-md <file>]\n');
    process.exitCode = 2;
    return;
  }

  const domainDir = resolve(String(domainDirArg));
  const opencodeDir = resolve(String(args['opencode-dir'] || '.opencode'));
  const registry = buildRegistry(domainDir, nowIso(), opencodeDir);
  const subdomain = registry.subdomain || 'unity';

  const outJson = resolve(String(args['out-json'] || join(opencodeDir, 'registry.json')));
  const outMd = resolve(String(args['out-md'] || join(opencodeDir, 'context', subdomain, 'registry.md')));

  write(outJson, JSON.stringify(registry, null, 2) + '\n');
  write(outMd, renderRegistry(registry));

  process.stdout.write(
    JSON.stringify(
      {
        generatedAt: registry.generatedAt,
        domain: registry.domain,
        subdomain: registry.subdomain,
        counts: registry.counts,
        paths: { json: outJson, markdown: outMd },
      },
      null,
      2
    ) + '\n'
  );
}

main();
