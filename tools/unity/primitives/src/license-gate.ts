// Import gate for the primitive registry (Phase 3 Step 3.3, ADR-0014).
//
// A primitive is only importable when its recorded license — from its
// `primitive.yaml` and/or the source registry's PROVENANCE.md — is on the
// allowlist. Copyleft licenses (GPL/LGPL/AGPL) are gated out; a missing or
// unrecognised license is skipped rather than assumed permissive.
//
// The module is dependency-free and pure: callers pass the license strings and
// receive a decision, so it can run offline and be unit-tested without touching
// the source registry.

export type LicenseVerdict = 'allowed' | 'copyleft' | 'unknown';

export const ALLOWED_LICENSES = ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'Unlicense'] as const;

// The source registry only records GPL-3.0 and LGPL-3.0, but the gate refuses
// the wider copyleft family so a future import cannot slip an AGPL/MPL entry in.
export const COPYLEFT_LICENSES = ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0', 'LGPL-2.1', 'LGPL-3.0'] as const;

const VERDICT_RANK: Record<LicenseVerdict, number> = { allowed: 0, unknown: 1, copyleft: 2 };

export interface ImportInput {
  id: string;
  license?: string | null;
  provenanceLicense?: string | null;
}

export interface ImportDecision {
  id: string;
  license: string;
  provenanceLicense: string;
  verdict: LicenseVerdict;
  importable: boolean;
  reason: string;
}

// Canonicalise an SPDX-ish id: trim, then drop the `-only`/`-or-later` suffix
// so `GPL-3.0-only` is recognised as the same license as `GPL-3.0`.
export function normalizeLicense(license: string | null | undefined): string {
  return (license ?? '').trim().replace(/-(only|or-later)$/i, '');
}

function matches(candidate: string, allowlist: readonly string[]): boolean {
  const lowered = candidate.toLowerCase();
  return allowlist.some((entry) => entry.toLowerCase() === lowered);
}

export function classifyLicense(license: string | null | undefined): LicenseVerdict {
  const normalized = normalizeLicense(license);
  if (!normalized) return 'unknown';
  if (matches(normalized, COPYLEFT_LICENSES)) return 'copyleft';
  if (matches(normalized, ALLOWED_LICENSES)) return 'allowed';
  return 'unknown';
}

export function decideImport(input: ImportInput): ImportDecision {
  const license = normalizeLicense(input.license);
  const provenanceLicense = normalizeLicense(input.provenanceLicense);
  const hasProvenance = provenanceLicense.length > 0;

  const verdicts: LicenseVerdict[] = [classifyLicense(license)];
  if (hasProvenance) verdicts.push(classifyLicense(provenanceLicense));
  const verdict = verdicts.reduce((worst, current) =>
    VERDICT_RANK[current] > VERDICT_RANK[worst] ? current : worst
  );

  if (verdict === 'copyleft') {
    const copyleft = [license, provenanceLicense].filter((entry) => classifyLicense(entry) === 'copyleft');
    return { id: input.id, license, provenanceLicense, verdict, importable: false, reason: `copyleft license (${copyleft.join(', ')}) is gated out` };
  }
  if (verdict === 'unknown') {
    const missing = license.length === 0 && !hasProvenance;
    return {
      id: input.id,
      license,
      provenanceLicense,
      verdict,
      importable: false,
      reason: missing ? 'no license recorded' : `license '${license || provenanceLicense}' is not on the allowlist`,
    };
  }
  const source = hasProvenance && license ? `yaml '${license}', provenance '${provenanceLicense}'` : `'${license || provenanceLicense}'`;
  return { id: input.id, license, provenanceLicense, verdict, importable: true, reason: `allowlisted license ${source}` };
}
