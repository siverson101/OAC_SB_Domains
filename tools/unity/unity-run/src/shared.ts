// Shared helpers for the Run family.
export * from './types';

import { join } from 'node:path';
import { nowIso } from '../../../shared/io';
import type { Route } from '../../../shared/tool-routing';
import type { RunAbility, RunBase, RunOptions, RunStatus, Json } from './types';

export function projectDataDir(options: RunOptions): string {
  return join(options.opencodeDir, 'project-data');
}

export function runDataDir(options: RunOptions): string {
  return join(projectDataDir(options), 'run');
}

export interface MakeResultOptions {
  route?: Route;
  requiresEditor?: boolean;
  requiresApproval?: boolean;
  approved?: boolean;
}

export function makeResult(
  ability: RunAbility,
  status: RunStatus,
  summary: string,
  errors: string[],
  options: MakeResultOptions = {}
): RunBase {
  return {
    schemaVersion: 1,
    generatedAt: nowIso(),
    ability,
    family: 'run',
    mode: 'offline',
    route: options.route ?? 'offline',
    status,
    summary,
    errors,
    safetyGate: {
      requiresEditor: options.requiresEditor ?? false,
      requiresApproval: options.requiresApproval ?? false,
      approved: options.approved ?? false,
    },
  };
}

export function asRecord(value: unknown): Json | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : null;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function str(obj: Json | null, key: string): string | null {
  const value = obj?.[key];
  return typeof value === 'string' ? value : null;
}

export function num(obj: Json | null, key: string): number | null {
  const value = obj?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function bool(obj: Json | null, key: string): boolean | null {
  const value = obj?.[key];
  return typeof value === 'boolean' ? value : null;
}

export function stringArray(obj: Json | null, key: string): string[] {
  const value = obj?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function parseBool(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  const text = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(text)) return true;
  if (['false', '0', 'no', 'off'].includes(text)) return false;
  return fallback;
}
