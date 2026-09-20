const FAMILIES = ['sense', 'act', 'verify', 'run', 'compose'] as const;
const MODES = ['offline', 'live', 'both'] as const;

export type CapabilityFamily = (typeof FAMILIES)[number];
export type CapabilityMode = (typeof MODES)[number];

export interface ContractValidation {
  ok: boolean;
  errors: string[];
}

export function validateContract(fm: Record<string, unknown>): ContractValidation {
  const errors: string[] = [];

  const id = fm.id;
  if (typeof id !== 'string' || id.trim() === '') {
    errors.push('missing required field: id');
  }

  const summary = fm.summary;
  if (typeof summary !== 'string' || summary.trim() === '') {
    errors.push('missing required field: summary');
  }

  const family = fm.family;
  if (family !== undefined) {
    if (typeof family !== 'string' || !(FAMILIES as readonly string[]).includes(family)) {
      errors.push(`invalid family: expected one of ${FAMILIES.join('|')}, got ${JSON.stringify(family)}`);
    }
  }

  const mode = fm.mode;
  if (mode !== undefined) {
    if (typeof mode !== 'string' || !(MODES as readonly string[]).includes(mode)) {
      errors.push(`invalid mode: expected one of ${MODES.join('|')}, got ${JSON.stringify(mode)}`);
    }
  }

  return { ok: errors.length === 0, errors };
}
