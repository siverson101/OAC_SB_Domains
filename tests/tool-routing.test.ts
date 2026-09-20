import { describe, expect, test } from 'bun:test';
import { runCli } from '../tools/unity/gather-unity-context/src/producers';
import {
  routedError,
  routedOk,
  selectRoute,
  type LiveEditorChannel,
  type LiveTransport,
} from '../tools/shared/tool-routing';

function channel(available: boolean, transport: LiveTransport = 'cli'): LiveEditorChannel {
  return { transport, available: () => available };
}

describe('selectRoute', () => {
  test('falls back to offline with no live channel and no CLI', () => {
    const selection = selectRoute({});
    expect(selection.route).toBe('offline');
    expect(selection.reason).toContain('on-disk');
  });

  test('selects live when the CLI channel is available and records its transport', () => {
    const selection = selectRoute({ live: channel(true, 'cli'), cliAvailable: true });
    expect(selection.route).toBe('live');
    expect(selection.transport).toBe('cli');
  });

  test('selects live over the stdio MCP transport when shell execution is unavailable', () => {
    const selection = selectRoute({ live: channel(true, 'mcp') });
    expect(selection.route).toBe('live');
    expect(selection.transport).toBe('mcp');
  });

  test('selects batch when only the CLI is available', () => {
    const selection = selectRoute({ cliAvailable: true });
    expect(selection.route).toBe('batch');
  });

  test('selects offline when the live channel reports unavailable', () => {
    const selection = selectRoute({ live: channel(false) });
    expect(selection.route).toBe('offline');
  });

  test('selects local for local-only work even with a live channel', () => {
    const selection = selectRoute({ localOnly: true, live: channel(true), cliAvailable: true });
    expect(selection.route).toBe('local');
  });

  test('treats a throwing channel as absent (fail-soft)', () => {
    const broken: LiveEditorChannel = {
      transport: 'cli',
      available: () => {
        throw new Error('no channel');
      },
    };
    expect(selectRoute({ live: broken, cliAvailable: true }).route).toBe('batch');
    expect(selectRoute({ live: broken }).route).toBe('offline');
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
