// Shared helpers for the Compose family.
export * from './types';

import { join } from 'node:path';
import { nowIso } from '../../../shared/io';
import type { Route } from '../../../shared/tool-routing';
import { COMPOSE_MODES, type ComposeAbility, type ComposeBase, type ComposeOptions, type ComposeStatus, type Json } from './types';

export const DEFAULT_LEASE_SECONDS = 900;
export const DEFAULT_HOLD_SECONDS = 1800;

export function coordinationDir(options: ComposeOptions): string {
  return join(options.opencodeDir, 'coordination');
}

export function projectDataDir(options: ComposeOptions): string {
  return join(options.opencodeDir, 'project-data');
}

export function addSeconds(iso: string, seconds: number): string {
  return new Date(new Date(iso).getTime() + seconds * 1000).toISOString();
}

export function isExpired(expiresAt: string, now: string): boolean {
  const expiry = new Date(expiresAt).getTime();
  const reference = new Date(now).getTime();
  if (!Number.isFinite(expiry) || !Number.isFinite(reference)) return false;
  return expiry <= reference;
}

export interface MakeResultOptions {
  route?: Route;
  requiresEditor?: boolean;
  requiresApproval?: boolean;
  approved?: boolean;
}

export function makeResult(
  ability: ComposeAbility,
  status: ComposeStatus,
  summary: string,
  errors: string[],
  options: MakeResultOptions = {}
): ComposeBase {
  return {
    schemaVersion: 1,
    generatedAt: nowIso(),
    ability,
    family: 'compose',
    mode: COMPOSE_MODES[ability],
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

export function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}
