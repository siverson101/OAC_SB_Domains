import { describe, expect, test } from 'bun:test';
import { firstString, parseArgs, rejectPositionals, resolveAbility } from '../tools/shared/cli-args';
import { resolveOptions as resolveActOptions } from '../tools/unity/unity-act/src/cli';
import { resolveOptions as resolveComposeOptions } from '../tools/unity/unity-compose/src/cli';
import { resolveOptions as resolveRunOptions } from '../tools/unity/unity-run/src/cli';
import { resolveOptions as resolveSenseOptions } from '../tools/unity/unity-sense/src/cli';
import { resolveOptions as resolveVerifyOptions } from '../tools/unity/unity-verify/src/cli';

describe('parseArgs', () => {
  test('parses space, equals and boolean flags', () => {
    const { values, positional } = parseArgs(['--ability', 'runtime-debugging', '--json', '--timeout=5']);
    expect(values).toEqual({ ability: 'runtime-debugging', json: true, timeout: '5' });
    expect(positional).toEqual([]);
  });

  test('records stray positional args instead of dropping them', () => {
    const { values, positional } = parseArgs(['extra', 'trailing', '--json']);
    expect(values).toEqual({ json: true });
    expect(positional).toEqual(['extra', 'trailing']);
  });

  test('accepts negative numeric values as values, not flags', () => {
    const { values, positional } = parseArgs(['--timeout', '-1', '--offset=-2.5']);
    expect(values).toEqual({ timeout: '-1', offset: '-2.5' });
    expect(positional).toEqual([]);
  });

  test('a flag followed by another flag stays boolean', () => {
    const { values, positional } = parseArgs(['--dry-run', '--json']);
    expect(values).toEqual({ 'dry-run': true, json: true });
    expect(positional).toEqual([]);
  });

  test('firstString picks the first non-empty alias', () => {
    expect(firstString({ 'unity-cli': '', unityCli: 'unity' }, ['unity-cli', 'unityCli'])).toBe('unity');
    expect(firstString({ json: true }, ['unity-cli'])).toBeUndefined();
  });

  test('resolveAbility falls back for an unknown ability', () => {
    const abilities = ['a', 'b'] as const;
    expect(resolveAbility('a', abilities, 'b')).toBe('a');
    expect(resolveAbility('nope', abilities, 'b')).toBe('b');
  });
});

describe('rejectPositionals', () => {
  test('accepts an empty positional list', () => {
    expect(() => rejectPositionals([])).not.toThrow();
  });

  test('rejects a stray positional with a usage error naming it', () => {
    expect(() => rejectPositionals(['stray'])).toThrow(/unexpected positional argument\(s\): stray/);
  });

  test('every family rejects a stray positional', () => {
    const resolvers = [
      resolveActOptions,
      resolveComposeOptions,
      resolveSenseOptions,
      resolveVerifyOptions,
      resolveRunOptions,
    ];
    for (const resolve of resolvers) {
      expect(() => resolve(['stray'])).toThrow(/unexpected positional/);
    }
  });
});
