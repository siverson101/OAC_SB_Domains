import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function ensureScratch(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

export function clearScratch(dir: string): void {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

export function scratchPath(dir: string, name: string): string {
  return join(dir, name);
}

export function writeScratchJson(dir: string, name: string, value: unknown): string {
  const path = scratchPath(dir, name);
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
  return path;
}
