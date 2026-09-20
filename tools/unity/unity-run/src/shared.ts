// Shared helpers for the Run family.
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
import type { RunAbility, RunBase, RunOptions, RunStatus } from './types';

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
    ...makeEnvelope({
      ability,
      family: 'run',
      mode: 'offline',
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
