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

describe('runCli async seam', () => {
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

  test('an async handler that resolves emits the result with exit code 0', async () => {
    const output: string[] = [];
    const previous = process.exitCode;
    try {
      process.exitCode = 0;
      runCli({
        abilities: ['a'],
        resolveOptions: () => ({ list: false, json: true }),
        run: async () => ({ ok: 1 }),
        render: () => '',
        argv: [],
        write: (text) => output.push(text),
      });
      await tick();
      expect(output.join('')).toContain('"ok": 1');
      expect(process.exitCode).toBe(0);
    } finally {
      process.exitCode = previous;
    }
  });

  test('an async handler that rejects is reported and exits non-zero', async () => {
    const output: string[] = [];
    const previous = process.exitCode;
    try {
      process.exitCode = 0;
      runCli({
        abilities: ['a'],
        resolveOptions: () => ({ list: false, json: true }),
        run: async (): Promise<{ ok: number }> => {
          throw new Error('async boom');
        },
        render: () => '',
        argv: [],
        write: (text) => output.push(text),
      });
      await tick();
      expect(output.join('')).toContain('async boom');
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = previous;
    }
  });
});
