// Opt-in integration test. It starts a Unity Editor (if one is not running),
// runs the gate, and stops the Editor it started. Disabled by default because it
// is slow (~2 min) and needs a licensed Editor on the machine.
//
//   OAC_UNITY_E2E=1 OAC_UNITY_PROJECT=C:/path/to/Project bun test tests/editor-e2e.test.ts
//
import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const enabled = process.env.OAC_UNITY_E2E === '1';
const project = process.env.OAC_UNITY_PROJECT;
const repoRoot = resolve(import.meta.dir, '..');
const gatherBundle = join(repoRoot, 'xdomains', 'scripts', 'unity', 'gather-unity-context.mjs');

describe('editor lifecycle (opt-in)', () => {
  test(
    'gather --gate runs the gate and leaves no Editor running',
    () => {
      if (!enabled || !project) {
        expect(true).toBe(true);
        return;
      }

      const out = mkdtempSync(join(tmpdir(), 'oac-editor-e2e-'));
      try {
        const res = spawnSync(
          process.execPath,
          [gatherBundle, '--project-root', project, '--opencode-dir', out, '--non-interactive', '--gate'],
          { encoding: 'utf8', timeout: 900000 }
        );
        expect(res.status).toBe(0);

        const gate = JSON.parse(readFileSync(join(out, 'project-data', 'gate-state.json'), 'utf8'));
        expect(['passed', 'failed']).toContain(gate.gateResult);
        expect(typeof gate.fingerprint).toBe('string');

        // Only assert the Editor was stopped if we were the ones who started it.
        if (gate.gateStartedByEditor) {
          const status = spawnSync('unity', ['status', '--json', '--no-banner', '--quiet'], { encoding: 'utf8' });
          const parsed = JSON.parse(status.stdout);
          expect(parsed.data.count).toBe(0);
        }
      } finally {
        rmSync(out, { recursive: true, force: true });
      }
    },
    900000
  );
});
