// Shared helpers for the Compose family.
export * from './types';
export {
  asArray,
  asRecord,
  bool,
  num,
  parseBool,
  str,
  stringArray,
} from '../../../shared/json-helpers';

import { join } from 'node:path';
import { makeEnvelope } from '../../../shared/result-envelope';
import type { Route } from '../../../shared/tool-routing';
import {
  COMPOSE_MODES,
  type ComposeAbility,
  type ComposeBase,
  type ComposeOptions,
  type ComposeStatus,
} from './types';

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
    ...makeEnvelope({
      ability,
      family: 'compose',
      mode: COMPOSE_MODES[ability],
      status,
      summary,
      errors,
      route: options.route ?? 'offline',
    }),
    safetyGate: {
      requiresEditor: options.requiresEditor ?? false,
      requiresApproval: options.requiresApproval ?? false,
      approved: options.approved ?? false,
    },
  };
}
