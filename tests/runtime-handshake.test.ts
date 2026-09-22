// Opt-in runtime handshake. Reaches a live Editor/Player through the Unity CLI
// runtime transport (`unity command`) and asserts the round-trip shape. Disabled
// by default because it is slow and needs a licensed Editor for the project.
//
//   OAC_UNITY_E2E=1 OAC_UNITY_PROJECT=C:/path/to/Project bun test tests/runtime-handshake.test.ts
//
import { describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import {
  findLiveInstance,
  startEditor,
  stopEditor,
  type EditorInstance,
} from '../tools/unity/gather-unity-context/src/editor';
import { runRuntimeAbility } from '../tools/unity/unity-run/src/runtime';
import type { RunOptions } from '../tools/unity/unity-run/src/types';

const project = process.env.OAC_UNITY_PROJECT ?? '';
const enabled = process.env.OAC_UNITY_E2E === '1' && project !== '';
const cliCommand = process.env.OAC_UNITY_CLI ?? 'unity';

function options(projectRoot: string): RunOptions {
  return {
    projectRoot,
    opencodeDir: resolve(projectRoot, '.opencode'),
    ability: 'runtime-debugging',
    json: true,
    list: false,
    operation: 'get_logs',
    approveCodeExecution: false,
    cliCommand,
  };
}

describe('runtime CLI handshake (opt-in)', () => {
  test.skipIf(!enabled)(
    'reaches the live Editor through unity command and observes get_logs',
    async () => {
      let started = false;
      let instance: EditorInstance | null = findLiveInstance(project, cliCommand);
      if (!instance) {
        instance = startEditor(project, cliCommand);
        started = instance != null;
      }

      try {
        const result = await runRuntimeAbility(options(project));
        if (!instance) {
          expect(result.status).toBe('unavailable');
          expect(result.errors.length).toBeGreaterThan(0);
          return;
        }
        expect(result.status).toBe('observed_locally');
        expect(result.transport).toBe('cli');
        expect(result.operation).toBe('get_logs');
        expect(result.data).not.toBeNull();
        expect(result.command ?? []).toContain('command');
        expect(result.command ?? []).toContain('get_logs');
      } finally {
        if (started && instance) stopEditor(instance);
      }
    },
    900000
  );
});
