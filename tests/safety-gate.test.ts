import { describe, expect, test } from 'bun:test';
import { SAFETY_GATE_KEYS, safetyGateFlag } from '../tools/shared/safety-gate';

describe('SAFETY_GATE_KEYS', () => {
  test('lists the six contract flags', () => {
    expect(SAFETY_GATE_KEYS).toEqual([
      'mutates',
      'requiresEditor',
      'requiresApproval',
      'dryRunFirst',
      'advisory',
      'writesState',
    ]);
  });
});

describe('safetyGateFlag', () => {
  test('an absent flag is false, never unknown', () => {
    expect(safetyGateFlag({ mutates: true }, 'advisory')).toBe(false);
    expect(safetyGateFlag({}, 'writesState')).toBe(false);
  });

  test('a non-boolean value is false', () => {
    expect(safetyGateFlag({ mutates: 'true' }, 'mutates')).toBe(false);
    expect(safetyGateFlag({ mutates: 1 }, 'mutates')).toBe(false);
    expect(safetyGateFlag({ mutates: null }, 'mutates')).toBe(false);
  });

  test('a true flag is true', () => {
    expect(safetyGateFlag({ mutates: true }, 'mutates')).toBe(true);
  });

  test('a non-object gate is false', () => {
    expect(safetyGateFlag(undefined, 'mutates')).toBe(false);
    expect(safetyGateFlag(null, 'mutates')).toBe(false);
    expect(safetyGateFlag([], 'mutates')).toBe(false);
    expect(safetyGateFlag('mutates', 'mutates')).toBe(false);
  });
});
