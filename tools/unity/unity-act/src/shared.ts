// Shared helpers for the Act family.
export * from './types';

import { join } from 'node:path';
import { nowIso } from '../../../shared/io';
import type { Route } from '../../../shared/tool-routing';
import type { ActAbility, ActBase, ActOptions, ActStatus, Json } from './types';

export function projectDataDir(options: ActOptions): string {
  return join(options.opencodeDir, 'project-data');
}

export function makeResult(
  ability: ActAbility,
  status: ActStatus,
  summary: string,
  errors: string[],
  route: Route = 'offline'
): ActBase {
  return {
    schemaVersion: 1,
    generatedAt: nowIso(),
    ability,
    family: 'act',
    mode: 'offline',
    route,
    status,
    summary,
    errors,
    mutated: false,
    safetyGate: { dryRunFirst: true, requireConfirm: true },
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
