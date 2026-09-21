import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ENVELOPE_KEYS } from '../tools/shared/result-envelope';
import { parseFrontmatter } from '../tools/shared/registry/src/frontmatter';
import { runVerify } from '../tools/unity/unity-verify/src/abilities';
import { VERIFY_ABILITIES, type VerifyOptions } from '../tools/unity/unity-verify/src/types';
import { runCompose } from '../tools/unity/unity-compose/src/abilities';
import { COMPOSE_ABILITIES, type ComposeOptions } from '../tools/unity/unity-compose/src/types';

const repoRoot = resolve(import.meta.dir, '..');
const commandDir = join(repoRoot, 'xdomains', 'game-dev', 'unity-3d', 'command');

function declaredOutputs(ability: string): Set<string> {
  const fm = parseFrontmatter(readFileSync(join(commandDir, `${ability}.md`), 'utf8'));
  const outputs = fm.outputs;
  return new Set(
    outputs && typeof outputs === 'object' && !Array.isArray(outputs) ? Object.keys(outputs) : []
  );
}

// A runtime envelope may emit the shared core plus any field declared in the
// command's frontmatter `outputs`. Anything else is contract drift: the runtime
// and the declaration must agree.
function assertDeclaredOutputs(ability: string, result: Record<string, unknown>): void {
  const allowed = new Set<string>([...ENVELOPE_KEYS, ...declaredOutputs(ability)]);
  for (const key of Object.keys(result)) {
    expect(allowed.has(key)).toBe(true);
  }
}

let fixture: string;
let verifyBase: VerifyOptions;
let composeBase: ComposeOptions;

beforeAll(() => {
  fixture = mkdtempSync(join(tmpdir(), 'oac-output-contract-'));
  const projectRoot = join(fixture, 'project');
  const opencodeDir = join(projectRoot, '.opencode');
  verifyBase = {
    projectRoot,
    opencodeDir,
    ability: 'compile-and-verify-project',
    json: true,
    list: false,
    phase: 'validate',
    cliCommand: 'definitely-not-a-real-cli-xyz',
    reviewIntensity: 'full',
  };
  composeBase = {
    projectRoot,
    opencodeDir,
    ability: 'coordination-board',
    json: true,
    list: false,
    cliCommand: 'definitely-not-a-real-cli-xyz',
  };
});

afterAll(() => {
  try {
    rmSync(fixture, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

describe('Verify runtime output contract', () => {
  for (const ability of VERIFY_ABILITIES) {
    test(`${ability} emits only declared output keys`, () => {
      const result = runVerify({ ...verifyBase, ability });
      assertDeclaredOutputs(ability, result as unknown as Record<string, unknown>);
    });
  }
});

describe('Compose runtime output contract', () => {
  for (const ability of COMPOSE_ABILITIES) {
    test(`${ability} emits only declared output keys`, async () => {
      const result = await runCompose({ ...composeBase, ability });
      assertDeclaredOutputs(ability, result as unknown as Record<string, unknown>);
    });
  }
});
