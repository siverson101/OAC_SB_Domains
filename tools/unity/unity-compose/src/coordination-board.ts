// coordination-board — the advisory on-disk coordination board (ADR-0011).
//
// Claims carry leases (TTL) and fail fast naming the holder on conflict; the
// Editor hold is a single-holder advisory lock. The board lives at
// `.opencode/coordination/board.json` (+ a human-readable `board.md`) so it
// survives a Unity domain reload and works with the Editor closed. It is
// **advisory**, never an enforced hard lock: a conflict is reported, not queued.
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { nowIso, readJson, toPosix } from '../../../shared/io';
import {
  addSeconds,
  asRecord,
  DEFAULT_HOLD_SECONDS,
  DEFAULT_LEASE_SECONDS,
  isExpired,
  makeResult,
  num,
  str,
  type ComposeBase,
  type ComposeOptions,
  type ComposeStatus,
  type Json,
} from './shared';

export const BOARD_FILE = 'board.json';
export const BOARD_MARKDOWN_FILE = 'board.md';
export const BOARD_SCHEMA_VERSION = 1;

export interface Claim {
  resource: string;
  holder: string;
  note: string | null;
  claimedAt: string;
  expiresAt: string;
  leaseSeconds: number;
}

export interface EditorHold {
  holder: string;
  note: string | null;
  acquiredAt: string;
  expiresAt: string;
  leaseSeconds: number;
}

export interface CoordinationBoard {
  schemaVersion: number;
  updatedAt: string;
  claims: Claim[];
  editorHold: EditorHold | null;
}

export type BoardVerb = 'claim' | 'release' | 'hold' | 'release-hold' | 'status';

export const BOARD_VERBS: BoardVerb[] = ['claim', 'release', 'hold', 'release-hold', 'status'];

export interface BoardMutation {
  ok: boolean;
  status: ComposeStatus;
  action: string;
  summary: string;
  holder: string | null;
  expiresAt: string | null;
  errors: string[];
  board: CoordinationBoard;
}

export function emptyBoard(now: string = nowIso()): CoordinationBoard {
  return { schemaVersion: BOARD_SCHEMA_VERSION, updatedAt: now, claims: [], editorHold: null };
}

function toClaim(raw: unknown): Claim | null {
  const record = asRecord(raw);
  if (!record) return null;
  const resource = str(record, 'resource');
  const holder = str(record, 'holder');
  if (!resource || !holder) return null;
  return {
    resource,
    holder,
    note: str(record, 'note'),
    claimedAt: str(record, 'claimedAt') ?? nowIso(),
    expiresAt: str(record, 'expiresAt') ?? nowIso(),
    leaseSeconds: num(record, 'leaseSeconds') ?? DEFAULT_LEASE_SECONDS,
  };
}

function toHold(raw: Json | null): EditorHold | null {
  if (!raw) return null;
  const holder = str(raw, 'holder');
  if (!holder) return null;
  return {
    holder,
    note: str(raw, 'note'),
    acquiredAt: str(raw, 'acquiredAt') ?? nowIso(),
    expiresAt: str(raw, 'expiresAt') ?? nowIso(),
    leaseSeconds: num(raw, 'leaseSeconds') ?? DEFAULT_HOLD_SECONDS,
  };
}

export function readBoard(dir: string): CoordinationBoard {
  const raw = readJson<Json>(join(dir, BOARD_FILE));
  if (!raw) return emptyBoard();
  const claims = (Array.isArray(raw.claims) ? raw.claims : [])
    .map(toClaim)
    .filter((claim): claim is Claim => claim !== null);
  return {
    schemaVersion: num(raw, 'schemaVersion') ?? BOARD_SCHEMA_VERSION,
    updatedAt: str(raw, 'updatedAt') ?? nowIso(),
    claims,
    editorHold: toHold(asRecord(raw.editorHold)),
  };
}

// Drop expired claims/holds. Pure: returns a new board, never mutates the input.
export function pruneBoard(board: CoordinationBoard, now: string): CoordinationBoard {
  const claims = board.claims.filter((claim) => !isExpired(claim.expiresAt, now));
  const editorHold = board.editorHold && !isExpired(board.editorHold.expiresAt, now) ? board.editorHold : null;
  return { ...board, claims, editorHold };
}

function withUpdatedAt(board: CoordinationBoard, now: string): CoordinationBoard {
  return { ...board, updatedAt: now };
}

function conflict(action: string, summary: string, board: CoordinationBoard, holder: string, expiresAt: string): BoardMutation {
  return { ok: false, status: 'conflict', action, summary, holder, expiresAt, errors: [summary], board };
}

function success(action: string, summary: string, board: CoordinationBoard, holder: string | null, expiresAt: string | null): BoardMutation {
  return { ok: true, status: 'ok', action, summary, holder, expiresAt, errors: [], board };
}

export interface ClaimInput {
  resource: string;
  holder: string;
  note?: string | null;
  leaseSeconds?: number;
  // When > 0, a conflicting live claim is queued on: wait up to this many
  // seconds for the lease to expire or the claim to be released, then claim.
  // When 0/absent, a conflict fails fast naming the holder (ADR-0011).
  waitSeconds?: number;
}

const CLAIM_POLL_MS = 50;

function sleepSync(ms: number): void {
  if (ms <= 0) return;
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      /* spin as a last resort */
    }
  }
}

// Claim with the optional queue path. The pure `claimResource` above decides the
// fail-fast conflict; this wrapper re-reads the on-disk board while waiting so a
// lease expiry or an explicit release by the holder frees the resource.
export function claimResourceWithWait(dir: string, input: ClaimInput, now: string): BoardMutation {
  let board = readBoard(dir);
  let currentNow = now;
  let mutation = claimResource(board, input, currentNow);
  const waitSeconds = input.waitSeconds ?? 0;
  if (mutation.ok || mutation.status !== 'conflict' || waitSeconds <= 0) return mutation;

  const deadline = Date.now() + waitSeconds * 1000;
  while (Date.now() < deadline) {
    sleepSync(Math.min(CLAIM_POLL_MS, deadline - Date.now()));
    board = readBoard(dir);
    currentNow = nowIso();
    mutation = claimResource(board, input, currentNow);
    if (mutation.ok) return mutation;
  }
  return mutation;
}

export function claimResource(board: CoordinationBoard, input: ClaimInput, now: string): BoardMutation {
  const leaseSeconds = input.leaseSeconds && input.leaseSeconds > 0 ? input.leaseSeconds : DEFAULT_LEASE_SECONDS;
  const pruned = pruneBoard(board, now);
  const existing = pruned.claims.find((claim) => claim.resource === input.resource);

  if (existing && existing.holder !== input.holder) {
    return conflict(
      'claim',
      `resource "${input.resource}" is claimed by "${existing.holder}" until ${existing.expiresAt}; fail-fast (advisory board)`,
      withUpdatedAt(pruned, now),
      existing.holder,
      existing.expiresAt
    );
  }

  const claim: Claim = {
    resource: input.resource,
    holder: input.holder,
    note: input.note ?? null,
    claimedAt: existing?.claimedAt ?? now,
    expiresAt: addSeconds(now, leaseSeconds),
    leaseSeconds,
  };
  const claims = existing
    ? pruned.claims.map((entry) => (entry.resource === input.resource ? claim : entry))
    : [...pruned.claims, claim];
  const next = withUpdatedAt({ ...pruned, claims }, now);
  const verb = existing ? 'renewed' : 'claimed';
  return success('claim', `${verb} "${input.resource}" for "${input.holder}" until ${claim.expiresAt}`, next, input.holder, claim.expiresAt);
}

export interface ReleaseInput {
  resource: string;
  holder: string;
}

export function releaseResource(board: CoordinationBoard, input: ReleaseInput, now: string): BoardMutation {
  const pruned = pruneBoard(board, now);
  const existing = pruned.claims.find((claim) => claim.resource === input.resource);
  if (!existing) {
    return {
      ok: true,
      status: 'not_found',
      action: 'release',
      summary: `no claim on "${input.resource}"`,
      holder: null,
      expiresAt: null,
      errors: [],
      board: withUpdatedAt(pruned, now),
    };
  }
  if (existing.holder !== input.holder) {
    return conflict(
      'release',
      `cannot release "${input.resource}": held by "${existing.holder}" until ${existing.expiresAt}; fail-fast (advisory board)`,
      withUpdatedAt(pruned, now),
      existing.holder,
      existing.expiresAt
    );
  }
  const claims = pruned.claims.filter((claim) => claim.resource !== input.resource);
  return success('release', `released "${input.resource}" from "${input.holder}"`, withUpdatedAt({ ...pruned, claims }, now), null, null);
}

export interface HoldInput {
  holder: string;
  note?: string | null;
  leaseSeconds?: number;
}

export function acquireEditorHold(board: CoordinationBoard, input: HoldInput, now: string): BoardMutation {
  const leaseSeconds = input.leaseSeconds && input.leaseSeconds > 0 ? input.leaseSeconds : DEFAULT_HOLD_SECONDS;
  const pruned = pruneBoard(board, now);
  const existing = pruned.editorHold;
  if (existing && existing.holder !== input.holder) {
    return conflict(
      'hold',
      `Editor hold is held by "${existing.holder}" until ${existing.expiresAt}; fail-fast (one holder at a time)`,
      withUpdatedAt(pruned, now),
      existing.holder,
      existing.expiresAt
    );
  }
  const editorHold: EditorHold = {
    holder: input.holder,
    note: input.note ?? null,
    acquiredAt: existing?.acquiredAt ?? now,
    expiresAt: addSeconds(now, leaseSeconds),
    leaseSeconds,
  };
  const next = withUpdatedAt({ ...pruned, editorHold }, now);
  const verb = existing ? 'renewed' : 'acquired';
  return success('hold', `${verb} Editor hold for "${input.holder}" until ${editorHold.expiresAt}`, next, input.holder, editorHold.expiresAt);
}

export function releaseEditorHold(board: CoordinationBoard, input: { holder: string }, now: string): BoardMutation {
  const pruned = pruneBoard(board, now);
  const existing = pruned.editorHold;
  if (!existing) {
    return {
      ok: true,
      status: 'not_found',
      action: 'release-hold',
      summary: 'no Editor hold is active',
      holder: null,
      expiresAt: null,
      errors: [],
      board: withUpdatedAt(pruned, now),
    };
  }
  if (existing.holder !== input.holder) {
    return conflict(
      'release-hold',
      `cannot release Editor hold: held by "${existing.holder}" until ${existing.expiresAt}; fail-fast`,
      withUpdatedAt(pruned, now),
      existing.holder,
      existing.expiresAt
    );
  }
  return success('release-hold', `released Editor hold from "${input.holder}"`, withUpdatedAt({ ...pruned, editorHold: null }, now), null, null);
}

export function boardStatus(board: CoordinationBoard, now: string): BoardMutation {
  const pruned = withUpdatedAt(pruneBoard(board, now), now);
  const hold = pruned.editorHold ? `Editor hold: ${pruned.editorHold.holder}` : 'Editor hold: free';
  return {
    ok: true,
    status: 'ok',
    action: 'status',
    summary: `${pruned.claims.length} claim(s); ${hold}`,
    holder: pruned.editorHold?.holder ?? null,
    expiresAt: pruned.editorHold?.expiresAt ?? null,
    errors: [],
    board: pruned,
  };
}

export function renderBoardMarkdown(board: CoordinationBoard): string {
  const lines: string[] = ['# Coordination board', '', `Updated: ${board.updatedAt}`, ''];
  lines.push('## Editor hold', '');
  if (board.editorHold) {
    lines.push(`- **${board.editorHold.holder}** until ${board.editorHold.expiresAt}${board.editorHold.note ? ` — ${board.editorHold.note}` : ''}`);
  } else {
    lines.push('- _free_');
  }
  lines.push('', '## Claims', '');
  if (board.claims.length === 0) {
    lines.push('_none_');
  } else {
    lines.push('| resource | holder | expires | note |');
    lines.push('| --- | --- | --- | --- |');
    for (const claim of board.claims) {
      lines.push(`| ${claim.resource} | ${claim.holder} | ${claim.expiresAt} | ${claim.note ?? ''} |`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

// Atomic-ish write: board.json is written to a temp file and renamed, then the
// markdown projection is refreshed. Advisory board, so this is best-effort.
export function writeBoard(dir: string, board: CoordinationBoard): void {
  mkdirSync(dir, { recursive: true });
  const target = join(dir, BOARD_FILE);
  const temp = join(dir, `${BOARD_FILE}.tmp`);
  writeFileSync(temp, JSON.stringify(board, null, 2) + '\n');
  renameSync(temp, target);
  writeFileSync(join(dir, BOARD_MARKDOWN_FILE), renderBoardMarkdown(board));
}

export interface CoordinationBoardResult extends ComposeBase {
  action: string;
  holder: string | null;
  expiresAt: string | null;
  board: CoordinationBoard;
}

export function normalizeBoardVerb(value: string | undefined): { verb: BoardVerb; errors: string[] } {
  if (!value || value.trim() === '') return { verb: 'status', errors: [] };
  const normalized = value.trim().toLowerCase();
  if ((BOARD_VERBS as string[]).includes(normalized)) return { verb: normalized as BoardVerb, errors: [] };
  return { verb: 'status', errors: [`unknown board verb "${value}"; defaulted to status`] };
}

export function runCoordinationBoard(options: ComposeOptions): CoordinationBoardResult {
  const dir = join(options.opencodeDir, 'coordination');
  const now = options.now ?? nowIso();
  const { verb, errors } = normalizeBoardVerb(options.verb);
  const board = readBoard(dir);

  if (verb === 'claim') {
    if (!options.resource || !options.holder) {
      const base = makeResult('coordination-board', 'refused', 'claim requires --resource and --holder', ['claim requires --resource and --holder']);
      return { ...base, action: 'claim', holder: null, expiresAt: null, board };
    }
    const mutation = claimResourceWithWait(
      dir,
      {
        resource: options.resource,
        holder: options.holder,
        note: options.note,
        leaseSeconds: options.leaseSeconds,
        waitSeconds: options.waitSeconds,
      },
      now
    );
    if (mutation.ok) writeBoard(dir, mutation.board);
    return toResult(mutation, errors, options);
  }

  if (verb === 'release') {
    if (!options.resource || !options.holder) {
      const base = makeResult('coordination-board', 'refused', 'release requires --resource and --holder', ['release requires --resource and --holder']);
      return { ...base, action: 'release', holder: null, expiresAt: null, board };
    }
    const mutation = releaseResource(board, { resource: options.resource, holder: options.holder }, now);
    if (mutation.ok) writeBoard(dir, mutation.board);
    return toResult(mutation, errors, options);
  }

  if (verb === 'hold') {
    if (!options.holder) {
      const base = makeResult('coordination-board', 'refused', 'hold requires --holder', ['hold requires --holder']);
      return { ...base, action: 'hold', holder: null, expiresAt: null, board };
    }
    const mutation = acquireEditorHold(board, { holder: options.holder, note: options.note, leaseSeconds: options.leaseSeconds }, now);
    if (mutation.ok) writeBoard(dir, mutation.board);
    return toResult(mutation, errors, options);
  }

  if (verb === 'release-hold') {
    if (!options.holder) {
      const base = makeResult('coordination-board', 'refused', 'release-hold requires --holder', ['release-hold requires --holder']);
      return { ...base, action: 'release-hold', holder: null, expiresAt: null, board };
    }
    const mutation = releaseEditorHold(board, { holder: options.holder }, now);
    if (mutation.ok) writeBoard(dir, mutation.board);
    return toResult(mutation, errors, options);
  }

  const mutation = boardStatus(board, now);
  return toResult(mutation, errors, options);
}

function toResult(mutation: BoardMutation, extraErrors: string[], options: ComposeOptions): CoordinationBoardResult {
  const base = makeResult('coordination-board', mutation.status, mutation.summary, [...mutation.errors, ...extraErrors]);
  const result: CoordinationBoardResult = {
    ...base,
    action: mutation.action,
    holder: mutation.holder,
    expiresAt: mutation.expiresAt,
    board: mutation.board,
  };
  if (!mutation.ok) result.route = 'offline';
  return result;
}

export function boardFiles(dir: string): string[] {
  return [toPosix(join(dir, BOARD_FILE)), toPosix(join(dir, BOARD_MARKDOWN_FILE))];
}
