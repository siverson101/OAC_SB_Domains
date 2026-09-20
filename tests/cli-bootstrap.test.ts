import { describe, expect, test } from 'bun:test';
import { runCli } from '../tools/shared/cli-bootstrap';

describe('runCli sync throw guard', () => {
  test('a throwing synchronous handler is reported and exits non-zero', () => {
    const output: string[] = [];
    const previous = process.exitCode;
    try {
      process.exitCode = 0;
      runCli({
        abilities: ['a'],
        resolveOptions: () => ({ list: false, json: true }),
        run: () => {
          throw new Error('unknown ability: boom');
        },
        render: () => '',
        argv: [],
        write: (text) => output.push(text),
      });
      expect(output.join('')).toContain('unknown ability: boom');
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = previous;
    }
  });
});
