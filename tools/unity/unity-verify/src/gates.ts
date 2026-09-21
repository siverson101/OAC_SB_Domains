// Named gates with strictest-wins (ADR-0015).
//
// "Done" is green tests plus every applicable named gate: compile,
// EditMode/PlayMode, scene/asset, build, performance, and visual verification.
// The review-intensity knob (`full | lean | solo`) decides which gates apply;
// the folded verdict is the strictest of the applicable gates.
import { asArray, asRecord, bool, str, stringArray, type Json } from './shared';
import type { ReviewIntensity } from './types';

export type GateName =
  | 'compile'
  | 'editMode'
  | 'playMode'
  | 'scene'
  | 'asset'
  | 'build'
  | 'performance'
  | 'visual';

export type GateStatus = 'passed' | 'failed' | 'warning' | 'not_run' | 'unavailable' | 'unknown';

// An external reviewer's verdict on a gate, independent of the on-disk status.
// `uncertain` folds at least as strict as `warning`; `confirmed` contributes a
// `passed` verdict and so cannot override a harder on-disk status. The union is
// derived from the array so the two can never drift.
export const EXTERNAL_VERDICTS = ['confirmed', 'uncertain'] as const;
export type ExternalVerdict = (typeof EXTERNAL_VERDICTS)[number];

export interface GateEntry {
  gate: GateName;
  status: GateStatus;
  externalVerdict?: ExternalVerdict;
  detail?: string;
}

export interface FoldedGates {
  status: GateStatus;
  strictest: GateName | null;
  intensity: ReviewIntensity;
  entries: GateEntry[];
  hardFailures: number;
  reviewRequired: number;
}

export const GATE_ORDER: GateName[] = [
  'compile',
  'editMode',
  'playMode',
  'scene',
  'asset',
  'build',
  'performance',
  'visual',
];

const SEVERITY: Record<GateStatus, number> = {
  failed: 5,
  warning: 4,
  unknown: 3,
  unavailable: 3,
  passed: 2,
  not_run: 1,
};

const INTENSITY_GATES: Record<ReviewIntensity, GateName[]> = {
  full: GATE_ORDER,
  lean: GATE_ORDER.filter((gate) => gate !== 'performance' && gate !== 'visual'),
  solo: ['compile', 'editMode', 'playMode'],
};

export function gatesForIntensity(intensity: ReviewIntensity): GateName[] {
  return INTENSITY_GATES[intensity];
}

function severity(status: GateStatus): number {
  return SEVERITY[status] ?? 0;
}

function orderIndex(gate: GateName): number {
  const index = GATE_ORDER.indexOf(gate);
  return index === -1 ? GATE_ORDER.length : index;
}

// The external verdict is folded as an additional status contribution:
// `uncertain` contributes `warning`, `confirmed` contributes `passed`, and the
// stricter of the two wins. So `confirmed` can fill a `not_run` gate but never
// overrides a `failed`/`warning`/`unknown` on-disk status.
export function effectiveGateStatus(entry: GateEntry): GateStatus {
  if (!entry.externalVerdict) return entry.status;
  const external: GateStatus = entry.externalVerdict === 'uncertain' ? 'warning' : 'passed';
  return severity(external) > severity(entry.status) ? external : entry.status;
}

export function foldGates(entries: GateEntry[], intensity: ReviewIntensity = 'full'): FoldedGates {
  const applicable = gatesForIntensity(intensity);
  const considered = entries
    .filter((entry) => applicable.includes(entry.gate))
    .slice()
    .sort((a, b) => orderIndex(a.gate) - orderIndex(b.gate));

  let strictest: GateEntry | null = null;
  for (const entry of considered) {
    if (!strictest || severity(effectiveGateStatus(entry)) > severity(effectiveGateStatus(strictest))) {
      strictest = entry;
    }
  }

  return {
    status: strictest ? effectiveGateStatus(strictest) : 'not_run',
    strictest: strictest?.gate ?? null,
    intensity,
    entries: considered,
    hardFailures: considered.filter((entry) => effectiveGateStatus(entry) === 'failed').length,
    reviewRequired: considered.filter((entry) => effectiveGateStatus(entry) === 'warning').length,
  };
}

function gateStatusFromResult(status: string | null): GateStatus {
  if (status === 'passed') return 'passed';
  if (status === 'failed') return 'failed';
  if (status === 'not_run' || status == null) return 'not_run';
  return 'unknown';
}

function compileGate(compileState: Json | null): GateEntry {
  const status = str(compileState, 'status');
  if (status === 'unavailable') return { gate: 'compile', status: 'unavailable', detail: 'Library/ScriptAssemblies missing' };
  if (bool(compileState, 'stale') === true) return { gate: 'compile', status: 'failed', detail: 'scripts newer than assemblies' };
  if (bool(compileState, 'noOpRecompile') === true) return { gate: 'compile', status: 'failed', detail: 'silent no-op recompile' };
  if (status === 'observed_locally') return { gate: 'compile', status: 'passed' };
  return { gate: 'compile', status: 'unknown' };
}

function visualTestName(test: Json): string {
  return str(test, 'fullname') ?? '(unknown visual test)';
}

function visualTestFailed(test: Json): boolean {
  const status = (str(test, 'status') ?? '').toLowerCase();
  return status.includes('fail') || status.includes('error');
}

// A visual test passes only when it recorded at least one screenshot and none of
// its recorded screenshots is missing: a partially missing set is a failure, not
// a pass on the strength of the ones that exist.
function visualTestHasScreenshot(test: Json): boolean {
  const screenshots = stringArray(test, 'screenshots');
  const missing = stringArray(test, 'missingScreenshots');
  return screenshots.length > 0 && missing.length === 0;
}

function visualGate(testInventory: Json | null): GateEntry {
  const visual = asRecord(testInventory?.visualVerification);
  if (!visual) return { gate: 'visual', status: 'not_run' };

  // Inventory versions that report a `tests` array gate each visual test; an
  // older inventory without one falls back to the aggregate result shape.
  if (Array.isArray(visual.tests)) {
    const tests = asArray(visual.tests)
      .map(asRecord)
      .filter((test): test is Json => test !== null);
    if (tests.length === 0) return { gate: 'visual', status: 'not_run' };

    const failed = tests.filter(visualTestFailed);
    if (failed.length > 0) {
      return { gate: 'visual', status: 'failed', detail: `visual test failed: ${failed.map(visualTestName).join(', ')}` };
    }
    const missing = tests.filter((test) => !visualTestHasScreenshot(test));
    if (missing.length > 0) {
      return {
        gate: 'visual',
        status: 'failed',
        detail: `missing screenshot: ${missing.map(visualTestName).join(', ')}`,
      };
    }
    return { gate: 'visual', status: 'passed' };
  }

  if (bool(visual, 'found') !== true) return { gate: 'visual', status: 'not_run' };
  const results = asArray(visual.results).map(asRecord);
  const failed = results.some((result) => (str(result, 'status') ?? '').toLowerCase().includes('fail'));
  return failed
    ? { gate: 'visual', status: 'failed', detail: 'visual verification failures' }
    : { gate: 'visual', status: 'passed' };
}

export interface GateStateSources {
  gateState?: Json | null;
  verificationReport?: Json | null;
  compileState?: Json | null;
  testInventory?: Json | null;
  overrides?: GateEntry[];
}

// Build the named-gate entries from the on-disk artefacts. Gates that cannot be
// derived from the current artefacts (scene/asset, build, performance) stay
// `not_run` unless the caller supplies an override.
export function gateEntriesFromState(sources: GateStateSources): GateEntry[] {
  const report = sources.verificationReport;
  const results = asRecord(report?.results);
  const editMode = asRecord(results?.editMode);
  const playMode = asRecord(results?.playMode);

  const entries: GateEntry[] = [
    compileGate(sources.compileState ?? null),
    { gate: 'editMode', status: gateStatusFromResult(str(editMode, 'status')) },
    { gate: 'playMode', status: gateStatusFromResult(str(playMode, 'status')) },
    { gate: 'scene', status: 'not_run' },
    { gate: 'asset', status: 'not_run' },
    { gate: 'build', status: 'not_run' },
    { gate: 'performance', status: 'not_run' },
    visualGate(sources.testInventory ?? null),
  ];

  const overrides = sources.overrides ?? [];
  for (const override of overrides) {
    const index = entries.findIndex((entry) => entry.gate === override.gate);
    if (index === -1) entries.push(override);
    else entries[index] = override;
  }
  return entries;
}

export interface ParsedGateOverrides {
  entries: GateEntry[];
  errors: string[];
}

export function parseGateOverrides(json: string | undefined): ParsedGateOverrides {
  if (!json) return { entries: [], errors: [] };
  try {
    const parsed = JSON.parse(json) as unknown;
    const entries = asArray(parsed).map(asRecord).filter((entry): entry is Json => entry !== null);
    const out: GateEntry[] = [];
    const errors: string[] = [];
    for (const entry of entries) {
      const gate = str(entry, 'gate');
      const status = str(entry, 'status');
      if (!gate || !GATE_ORDER.includes(gate as GateName)) {
        errors.push(`ignored --gates override "${gate ?? 'unknown'}": unknown gate`);
        continue;
      }
      if (!status || !(status in SEVERITY)) {
        errors.push(`ignored --gates override "${gate}": unknown status "${status ?? 'unknown'}"`);
        continue;
      }
      const externalRaw = str(entry, 'externalVerdict');
      let externalVerdict: ExternalVerdict | undefined;
      if (externalRaw !== null) {
        if ((EXTERNAL_VERDICTS as readonly string[]).includes(externalRaw)) {
          externalVerdict = externalRaw as ExternalVerdict;
        } else {
          errors.push(`ignored --gates override "${gate}": unknown externalVerdict "${externalRaw}"`);
        }
      }
      out.push({
        gate: gate as GateName,
        status: status as GateStatus,
        ...(externalVerdict ? { externalVerdict } : {}),
        detail: str(entry, 'detail') ?? undefined,
      });
    }
    return { entries: out, errors };
  } catch {
    return { entries: [], errors: [] };
  }
}
