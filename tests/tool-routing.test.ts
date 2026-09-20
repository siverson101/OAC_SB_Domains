import { describe, expect, test } from 'bun:test';
import { runCli } from '../tools/unity/gather-unity-context/src/producers';
import {
  routedError,
  routedOk,
  selectRoute,
  type RuntimeBridge,
} from '../tools/shared/tool-routing';

function bridge(available: boolean): RuntimeBridge {
  return {
    kind: 'localhost-http',
    available: () => available,
    request: async () => null,
  };
}

describe('selectRoute', () => {
  test('falls back to offline with no bridge and no CLI', () => {
    const selection = selectRoute({});
    expect(selection.route).toBe('offline');
    expect(selection.reason).toContain('on-disk');
  });

  test('selects live when the bridge is available', () => {
    const selection = selectRoute({ bridge: bridge(true), cliAvailable: true });
    expect(selection.route).toBe('live');
  });

  test('selects batch when only the CLI is available', () => {
    const selection = selectRoute({ cliAvailable: true });
    expect(selection.route).toBe('batch');
  });

  test('selects offline when the bridge reports unavailable', () => {
    const selection = selectRoute({ bridge: bridge(false) });
    expect(selection.route).toBe('offline');
  });

  test('selects local for local-only work even with a bridge', () => {
    const selection = selectRoute({ localOnly: true, bridge: bridge(true), cliAvailable: true });
    expect(selection.route).toBe('local');
  });

  test('treats a throwing bridge as absent (fail-soft)', () => {
    const broken: RuntimeBridge = {
      kind: 'localhost-http',
      available: () => {
        throw new Error('no bridge');
      },
      request: async () => null,
    };
    expect(selectRoute({ bridge: broken, cliAvailable: true }).route).toBe('batch');
    expect(selectRoute({ bridge: broken }).route).toBe('offline');
  });
});

describe('routed results', () => {
  test('records the route that served a result', () => {
    expect(routedOk('live', { value: 1 })).toEqual({ route: 'live', ok: true, value: { value: 1 } });
    expect(routedError('offline', 'missing')).toEqual({
      route: 'offline',
      ok: false,
      value: null,
      error: 'missing',
    });
  });
});

describe('runCli route evidence', () => {
  test('marks a usable CLI response as batch', () => {
    const env = runCli(process.execPath, ['-e', 'console.log(JSON.stringify({ success: true, data: { ok: 1 } }))']);
    expect(env.success).toBe(true);
    expect(env.route).toBe('batch');
  });

  test('marks an unusable CLI response as offline', () => {
    const env = runCli(process.execPath, ['-e', 'process.exit(1)']);
    expect(env.success).toBe(false);
    expect(env.route).toBe('offline');
  });
});
