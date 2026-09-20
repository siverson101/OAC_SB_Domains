import { describe, expect, test } from 'bun:test';
import { firstString, parseArgs, resolveAbility } from '../tools/shared/cli-args';

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
