// Shared result envelope for the five Unity families.
//
// Every family result carries the same core shape
// (`schemaVersion/generatedAt/ability/family/mode/route/status/summary/errors`).
// `makeEnvelope` builds exactly that core; each family's `makeResult` spreads it
// and adds its own safety-gate/extras. This keeps the envelope from drifting.
import { nowIso } from './io';
import type { Route } from './tool-routing';

// The envelope core every family emits. A runtime result may add family base
// fields and ability extras, but those must be declared in the command's
// frontmatter `outputs`; `tests/output-contract.test.ts` enforces the subset.
export const ENVELOPE_KEYS = [
  'schemaVersion',
  'generatedAt',
  'ability',
  'family',
  'mode',
  'route',
  'status',
  'summary',
  'errors',
] as const;

export interface ResultEnvelope<
  Ability extends string,
  Family extends string,
  Mode extends string,
  Status extends string
> {
  schemaVersion: number;
  generatedAt: string;
  ability: Ability;
  family: Family;
  mode: Mode;
  route: Route;
  status: Status;
  summary: string;
  errors: string[];
}

export interface EnvelopeInput<
  Ability extends string,
  Family extends string,
  Mode extends string,
  Status extends string
> {
  ability: Ability;
  family: Family;
  mode: Mode;
  status: Status;
  summary: string;
  errors: string[];
  route?: Route;
}

export function makeEnvelope<
  Ability extends string,
  Family extends string,
  Mode extends string,
  Status extends string
>(input: EnvelopeInput<Ability, Family, Mode, Status>): ResultEnvelope<Ability, Family, Mode, Status> {
  return {
    schemaVersion: 1,
    generatedAt: nowIso(),
    ability: input.ability,
    family: input.family,
    mode: input.mode,
    route: input.route ?? 'offline',
    status: input.status,
    summary: input.summary,
    errors: input.errors,
  };
}
