// Bundle drift guard. The bundles under xdomains/scripts/** are committed build
// output, hand-maintained in lockstep with their TS sources (review-lessons #8).
// `bun run build:check` regenerates and git-diffs them, but that is a package
// script, not a test. This re-runs `bun build` for every generated bundle
// declared in package.json's `build:*` scripts into a temp file and asserts the
// bytes match the committed bundle, so a hand-edited bundle fails `bun test`
// without touching the repo or shelling out to git.
import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dir, '..');
const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as { scripts: Record<string, string> };

// Matches the generated-bundle scripts exactly; `build:watch` (extra `--watch`)
// and the chained `build`/`build:check` scripts deliberately do not match.
const BUILD_RE = /^bun build (\S+) --outfile (\S+) --target node$/;

interface Bundle {
  script: string;
  src: string;
  outfile: string;
}

function declaredBundles(): Bundle[] {
  const bundles: Bundle[] = [];
  for (const [script, command] of Object.entries(pkg.scripts)) {
    if (!script.startsWith('build:')) continue;
    const match = BUILD_RE.exec(command.trim());
    if (match) bundles.push({ script, src: match[1], outfile: match[2] });
  }
  return bundles;
}

describe('generated bundles match their sources', () => {
  const bundles = declaredBundles();

  test('every generated bundle is declared by a build:* script', () => {
    expect(bundles.length).toBeGreaterThanOrEqual(10);
    expect(bundles.map((bundle) => bundle.outfile)).toContain('xdomains/scripts/unity/unity-compose.mjs');
  });

  for (const bundle of bundles) {
    test(`${bundle.outfile} matches a fresh build of ${bundle.src}`, () => {
      const dir = mkdtempSync(join(tmpdir(), 'oac-bundle-drift-'));
      try {
        const out = join(dir, 'bundle.mjs');
        const build = spawnSync(process.execPath, ['build', bundle.src, '--outfile', out, '--target', 'node'], {
          cwd: repoRoot,
          encoding: 'utf8',
        });
        expect(build.status, build.stderr).toBe(0);
        const fresh = readFileSync(out);
        const committed = readFileSync(join(repoRoot, bundle.outfile));
        expect(
          fresh.equals(committed),
          `${bundle.outfile} is stale; run \`bun run build\` to regenerate it`
        ).toBe(true);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }
});
