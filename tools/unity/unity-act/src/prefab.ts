// prefab-automation — ADR-0018 dry-run-first prefab patching.
//
// The TypeScript layer is the offline half of `prefab patch`: it validates and
// proposes JSON ops, records a dry-run receipt, and refuses a non-dry run unless
// a dry run for the same ops was recorded and `--confirm` was supplied. The
// actual prefab write happens in the live Editor through the Unity CLI; this
// module never edits a prefab file itself.
import { createHash } from 'node:crypto';
import { isAbsolute, join } from 'node:path';
import { fileExists, readJson, writeJson } from '../../../shared/io';
import { decideEscalation, inferChangeKind, type ChangeKind, type EscalationDecision } from './escalation';
import { planActGate, type GatePlan } from './gate';
import { asRecord, makeResult, projectDataDir, str, type ActOptions } from './shared';
import type { ActBase, Json } from './types';

export const SUPPORTED_PATCH_OPS = [
  'ensure_child',
  'ensure_component',
  'set_property',
  'set_properties',
  'set_array',
  'append_array',
  'clear_array',
] as const;

export type PatchOpName = (typeof SUPPORTED_PATCH_OPS)[number];

const REQUIRED_FIELDS: Record<PatchOpName, string[]> = {
  ensure_child: [],
  ensure_component: ['typeName'],
  set_property: ['propertyName'],
  set_properties: ['values'],
  set_array: ['propertyName', 'items'],
  append_array: ['propertyName', 'items'],
  clear_array: ['propertyName'],
};

export interface NormalizedPatchOp {
  index: number;
  op: string;
  targetPath: string | null;
  summary: string;
}

export interface PrefabAutomationResult extends ActBase {
  runMode: 'dry-run' | 'apply';
  prefab: string | null;
  prefabExists: boolean;
  patchId: string | null;
  opCount: number;
  ops: NormalizedPatchOp[];
  unsupported: string[];
  dryRunReceipt: { recorded: boolean; firstPass: boolean; path: string | null };
  command: string | null;
  changeKind: ChangeKind;
  escalation: EscalationDecision;
  gate: GatePlan;
}

interface DryRunReceipt {
  patchId: string;
  prefab: string;
  opCount: number;
  recordedAt: string;
}

interface RawOpsParse {
  ops: Json[];
  error: string | null;
}

function resolveInputPath(projectRoot: string, path: string): string {
  return isAbsolute(path) ? path : join(projectRoot, path);
}

function parseRawOps(options: ActOptions): RawOpsParse {
  let raw: unknown = null;

  if (options.opsJson) {
    try {
      raw = JSON.parse(options.opsJson);
    } catch (error) {
      return { ops: [], error: `opsJson is not valid JSON: ${(error as Error).message}` };
    }
  } else if (options.opsFile) {
    raw = readJson<unknown>(resolveInputPath(options.projectRoot, options.opsFile));
    if (raw === null) return { ops: [], error: `ops file not found or unreadable: ${options.opsFile}` };
  } else {
    return { ops: [], error: 'missing ops; pass --ops <file> or --opsJson <json>' };
  }

  const record = asRecord(raw);
  const list = Array.isArray(raw) ? raw : record ? (record.ops ?? record.operations) : null;
  if (!Array.isArray(list)) return { ops: [], error: 'ops must be a JSON array or an object with an "ops" array' };

  const ops: Json[] = [];
  for (const item of list) {
    const entry = asRecord(item);
    if (!entry) return { ops: [], error: 'every op must be a JSON object' };
    ops.push(entry);
  }
  return { ops, error: null };
}

function normalizeOps(ops: Json[]): { normalized: NormalizedPatchOp[]; unsupported: string[]; errors: string[] } {
  const normalized: NormalizedPatchOp[] = [];
  const unsupported: string[] = [];
  const errors: string[] = [];

  ops.forEach((op, index) => {
    const name = str(op, 'op');
    if (!name) {
      errors.push(`op #${index + 1} is missing "op"`);
      return;
    }
    if (!(SUPPORTED_PATCH_OPS as readonly string[]).includes(name)) {
      unsupported.push(name);
      errors.push(`op #${index + 1} uses unsupported op "${name}"`);
      return;
    }

    const target = asRecord(op.target);
    const targetPath = str(target, 'path') ?? str(op, 'path');

    for (const field of REQUIRED_FIELDS[name as PatchOpName]) {
      if (op[field] === undefined || op[field] === null) {
        errors.push(`op #${index + 1} (${name}) is missing "${field}"`);
      }
    }

    if ((name === 'ensure_component' || name === 'set_property') && !targetPath) {
      errors.push(`op #${index + 1} (${name}) needs a target path`);
    }

    normalized.push({ index, op: name, targetPath, summary: summarize(name, targetPath) });
  });

  return { normalized, unsupported, errors };
}

function summarize(op: string, targetPath: string | null): string {
  const where = targetPath ? ` on ${targetPath}` : '';
  switch (op) {
    case 'ensure_child':
      return `ensure child${where}`;
    case 'ensure_component':
      return `ensure component${where}`;
    case 'set_property':
      return `set one property${where}`;
    case 'set_properties':
      return `set several properties${where}`;
    case 'set_array':
      return `replace an array${where}`;
    case 'append_array':
      return `append to an array${where}`;
    case 'clear_array':
      return `clear an array${where}`;
    default:
      return op;
  }
}

function receiptPath(options: ActOptions): string {
  return join(projectDataDir(options), 'act', 'prefab-dryrun.json');
}

function readReceipts(path: string): Record<string, DryRunReceipt> {
  const raw = readJson<Record<string, DryRunReceipt>>(path);
  return raw && typeof raw === 'object' ? raw : {};
}

export function prefabAutomation(options: ActOptions, cliAvailable: boolean | null = null): PrefabAutomationResult {
  const base = makeResult('prefab-automation', 'unknown', 'Prefab patch proposal', [], 'offline');
  const prefab = options.prefab ?? null;
  const parsed = parseRawOps(options);
  const { normalized, unsupported, errors } = normalizeOps(parsed.ops);
  const allErrors = parsed.error ? [parsed.error, ...errors] : errors;
  const changeKind = inferChangeKind(normalized, unsupported.length > 0);
  const escalation = decideEscalation({ changeKind, opCount: normalized.length, hasUnsupportedOps: unsupported.length > 0 });
  const gate = planActGate(options.gate, cliAvailable);

  const prefabExists = prefab ? fileExists(resolveInputPath(options.projectRoot, prefab)) : false;
  const patchId =
    prefab && allErrors.length === 0
      ? createHash('sha256').update(JSON.stringify({ prefab, ops: normalized })).digest('hex')
      : null;

  const path = receiptPath(options);
  const receipts = readReceipts(path);
  const receipt = patchId ? receipts[patchId] : undefined;

  const result: PrefabAutomationResult = {
    ...base,
    runMode: options.dryRun ? 'dry-run' : 'apply',
    prefab,
    prefabExists,
    patchId,
    opCount: normalized.length,
    ops: normalized,
    unsupported,
    dryRunReceipt: { recorded: Boolean(receipt), firstPass: Boolean(receipt), path: null },
    command: null,
    changeKind,
    escalation,
    gate,
    errors: allErrors,
  };

  if (allErrors.length > 0) {
    result.status = 'unknown';
    result.summary = `Refusing to propose prefab patch: ${allErrors[0]}`;
    return result;
  }
  if (!prefab) {
    result.status = 'unknown';
    result.summary = 'Refusing to propose prefab patch without --prefab';
    result.errors = ['missing --prefab <Assets/.../Thing.prefab>'];
    return result;
  }

  const opsArg = options.opsFile ? `--ops "${options.opsFile}"` : `--opsJson '${options.opsJson ?? ''}'`;

  if (options.dryRun) {
    const next: Record<string, DryRunReceipt> = {
      ...receipts,
      [patchId as string]: { patchId: patchId as string, prefab, opCount: normalized.length, recordedAt: new Date().toISOString() },
    };
    writeJson(path, next);
    result.status = 'proposed';
    result.mutated = false;
    result.dryRunReceipt = { recorded: true, firstPass: true, path };
    result.command = `unity command prefab patch --prefabPath "${prefab}" ${opsArg} --dryRun true --json --no-banner --quiet --non-interactive`;
    result.summary = `Dry run proposed ${normalized.length} op(s); nothing mutated`;
    return result;
  }

  result.dryRunReceipt = { recorded: Boolean(receipt), firstPass: Boolean(receipt), path };

  if (!options.confirm) {
    result.status = 'refused';
    result.mutated = false;
    result.errors = ['refusing a non-dry run without --confirm'];
    result.summary = 'Refused: a prefab write requires --confirm';
    return result;
  }

  if (!receipt) {
    result.status = 'refused';
    result.mutated = false;
    result.errors = ['no dry-run receipt for these ops; run --dryRun first'];
    result.summary = 'Refused: run --dryRun first (ADR-0018)';
    return result;
  }

  result.status = 'ready';
  result.mutated = false;
  result.command = `unity command prefab patch --prefabPath "${prefab}" ${opsArg} --dryRun false --json --no-banner --quiet --non-interactive`;
  result.summary = `Approved to apply ${normalized.length} op(s) after a recorded dry run`;
  return result;
}
