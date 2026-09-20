// tools/shared/cli-bootstrap.ts
function runCli(config) {
  const argv = config.argv ?? process.argv.slice(2);
  const write = config.write ?? ((text) => process.stdout.write(text));
  const options = config.resolveOptions(argv);
  if (options.list) {
    write(config.abilities.join(`
`) + `
`);
    return;
  }
  const result = config.run(options);
  if (options.json) {
    write(JSON.stringify(result, null, 2) + `
`);
    return;
  }
  write(config.render(result) + `
`);
}

// tools/unity/unity-compose/src/ci-status-baseline.ts
import { join } from "node:path";

// tools/shared/io.ts
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, sep } from "node:path";
function dirExists(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}
function readText(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}
function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + `
`);
}
function nowIso() {
  return new Date().toISOString();
}
function toPosix(path) {
  return path.split(sep).join("/");
}

// tools/unity/unity-compose/src/types.ts
var COMPOSE_ABILITY_NAMES = [
  "coordination-board",
  "primitive-composition",
  "contract-aware-design",
  "ci-status-baseline"
];
var COMPOSE_ABILITIES = [...COMPOSE_ABILITY_NAMES];
var COMPOSE_MODES = {
  "coordination-board": "offline",
  "primitive-composition": "offline",
  "contract-aware-design": "offline",
  "ci-status-baseline": "both"
};
// tools/shared/json-helpers.ts
function asRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}
function str(obj, key) {
  const value = obj?.[key];
  return typeof value === "string" ? value : null;
}
function num(obj, key) {
  const value = obj?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
// tools/shared/result-envelope.ts
function makeEnvelope(input) {
  return {
    schemaVersion: 1,
    generatedAt: nowIso(),
    ability: input.ability,
    family: input.family,
    mode: input.mode,
    route: input.route ?? "offline",
    status: input.status,
    summary: input.summary,
    errors: input.errors
  };
}

// tools/unity/unity-compose/src/shared.ts
var DEFAULT_LEASE_SECONDS = 900;
var DEFAULT_HOLD_SECONDS = 1800;
function addSeconds(iso, seconds) {
  return new Date(new Date(iso).getTime() + seconds * 1000).toISOString();
}
function isExpired(expiresAt, now) {
  const expiry = new Date(expiresAt).getTime();
  const reference = new Date(now).getTime();
  if (!Number.isFinite(expiry) || !Number.isFinite(reference))
    return false;
  return expiry <= reference;
}
function makeResult(ability, status, summary, errors, options = {}) {
  return {
    ...makeEnvelope({
      ability,
      family: "compose",
      mode: COMPOSE_MODES[ability],
      status,
      summary,
      errors,
      route: options.route ?? "offline"
    }),
    safetyGate: {
      requiresEditor: options.requiresEditor ?? false,
      requiresApproval: options.requiresApproval ?? false,
      approved: options.approved ?? false
    }
  };
}
function parsePositiveInt(value, fallback) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0)
    return fallback;
  return Math.floor(parsed);
}

// tools/unity/unity-compose/src/ci-status-baseline.ts
var CI_BASELINE_FILE = "ci-status-baseline.json";
function baselinePath(options) {
  return join(options.opencodeDir, "project-data", CI_BASELINE_FILE);
}
function testFailureCount(report) {
  const summary = report && typeof report.summary === "object" && report.summary !== null ? report.summary : null;
  if (!summary)
    return null;
  let failed = 0;
  let seen = false;
  for (const key of ["editMode", "playMode"]) {
    const counts = summary[key];
    if (counts && typeof counts === "object") {
      seen = true;
      failed += num(counts, "failed") ?? 0;
    }
  }
  return seen ? failed : null;
}
function deriveBaselineStatus(compile, logs, tests) {
  const errorCount = num(logs, "errorCount");
  const failed = testFailureCount(tests);
  if ((errorCount ?? 0) > 0 || (failed ?? 0) > 0)
    return "red";
  if (!compile || !tests)
    return "unknown";
  if (str(compile, "status") === "unavailable")
    return "unknown";
  return "green";
}
function gatherBaseline(options) {
  const dataDir = join(options.opencodeDir, "project-data");
  const compile = readJson(join(dataDir, "compile-state.json"));
  const logs = readJson(join(dataDir, "log-digest.json"));
  const tests = readJson(join(dataDir, "unity-verification-report.json"));
  return {
    schemaVersion: 1,
    recordedAt: nowIso(),
    source: options.source ?? "project-data",
    status: deriveBaselineStatus(compile, logs, tests),
    compile,
    tests,
    logs
  };
}
function readBaseline(path) {
  const raw = readJson(path);
  if (!raw)
    return null;
  const status = str(raw, "status");
  return {
    schemaVersion: num(raw, "schemaVersion") ?? 1,
    recordedAt: str(raw, "recordedAt") ?? nowIso(),
    source: str(raw, "source") ?? "project-data",
    status: status === "green" || status === "red" ? status : "unknown",
    compile: raw.compile ?? null,
    tests: raw.tests ?? null,
    logs: raw.logs ?? null
  };
}
function runCiStatusBaseline(options) {
  const path = baselinePath(options);
  const action = (options.verb ?? "read").trim().toLowerCase() === "record" ? "record" : "read";
  if (action === "record") {
    const baseline = gatherBaseline(options);
    writeJson(path, baseline);
    const base = makeResult("ci-status-baseline", "recorded", `recorded CI baseline: ${baseline.status}`, []);
    return { ...base, action, baselinePath: toPosix(path), baseline };
  }
  const baseline = readBaseline(path);
  if (!baseline) {
    const base = makeResult("ci-status-baseline", "not_found", `no CI baseline at ${toPosix(path)}`, []);
    return { ...base, action, baselinePath: toPosix(path), baseline: null };
  }
  const base = makeResult("ci-status-baseline", "ok", `CI baseline: ${baseline.status} (recorded ${baseline.recordedAt})`, []);
  return { ...base, action, baselinePath: toPosix(path), baseline };
}

// tools/unity/unity-compose/src/contract-aware-design.ts
import { readdirSync, statSync as statSync2 } from "node:fs";
import { basename, join as join2 } from "node:path";

// tools/shared/registry/src/frontmatter.ts
function stripQuotes(value) {
  if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  return value;
}
function tryParseJson(input) {
  try {
    return JSON.parse(input);
  } catch {
    return;
  }
}
function normalizeQuotes(input) {
  let out = "";
  let inDouble = false;
  for (let i = 0;i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') {
      inDouble = !inDouble;
      out += ch;
      continue;
    }
    if (ch === "'" && !inDouble) {
      let j = i + 1;
      let inner = "";
      while (j < input.length && input[j] !== "'") {
        inner += input[j];
        j++;
      }
      out += '"' + inner.replace(/"/g, "\\\"") + '"';
      i = j;
      continue;
    }
    out += ch;
  }
  return out;
}
var JSON_LITERALS = new Set(["true", "false", "null"]);
function quoteBareWords(input) {
  return input.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_-]*)(\s*:)/g, '$1"$2"$3').replace(/(:\s*)([A-Za-z_][A-Za-z0-9_-]*)(?=\s*[,}\]])/g, (match, prefix, word) => JSON_LITERALS.has(word) ? match : `${prefix}"${word}"`);
}
function splitTopLevel(input, delimiter) {
  const parts = [];
  let depth = 0;
  let current = "";
  let inSingle = false;
  let inDouble = false;
  for (let i = 0;i < input.length; i++) {
    const ch = input[i];
    if (inSingle) {
      current += ch;
      if (ch === "'")
        inSingle = false;
      continue;
    }
    if (inDouble) {
      current += ch;
      if (ch === '"')
        inDouble = false;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      current += ch;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      current += ch;
      continue;
    }
    if (ch === "[" || ch === "{" || ch === "(")
      depth++;
    if (ch === "]" || ch === "}" || ch === ")")
      depth--;
    if (ch === delimiter && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim() !== "")
    parts.push(current);
  return parts;
}
function parseFlowArray(raw) {
  const inner = raw.slice(1, -1).trim();
  if (inner === "")
    return [];
  const json = tryParseJson(normalizeQuotes(raw));
  if (Array.isArray(json))
    return json;
  return splitTopLevel(inner, ",").map((item) => parseInlineValue(item.trim()));
}
function parseFlowObject(raw) {
  const normalized = normalizeQuotes(raw);
  const direct = tryParseJson(normalized);
  if (direct !== undefined && direct !== null && typeof direct === "object" && !Array.isArray(direct)) {
    return direct;
  }
  const lenient = tryParseJson(quoteBareWords(normalized));
  if (lenient !== undefined && lenient !== null && typeof lenient === "object" && !Array.isArray(lenient)) {
    return lenient;
  }
  return raw;
}
function parseInlineValue(rest) {
  const trimmed = rest.trim();
  if (trimmed.startsWith("["))
    return parseFlowArray(trimmed);
  if (trimmed.startsWith("{"))
    return parseFlowObject(trimmed);
  return stripQuotes(trimmed);
}
function readBlock(lines, start) {
  const collected = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === "")
        j++;
      if (j < lines.length && /^\s/.test(lines[j])) {
        i++;
        continue;
      }
      break;
    }
    if (!/^\s/.test(line))
      break;
    collected.push(line);
    i++;
  }
  const trimmed = collected.map((line) => line.trim()).filter((line) => line !== "");
  if (trimmed.length > 0 && trimmed.every((line) => line.startsWith("-"))) {
    return { value: trimmed.map((line) => parseInlineValue(line.replace(/^-\s*/, ""))), nextIndex: i };
  }
  if (trimmed.length > 0 && trimmed.every((line) => /^[A-Za-z0-9_-]+:\s/.test(line) && !line.startsWith("-"))) {
    const obj = {};
    for (const line of trimmed) {
      const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
      if (!m)
        continue;
      obj[m[1]] = m[2] === "" ? "" : parseInlineValue(m[2]);
    }
    return { value: obj, nextIndex: i };
  }
  return { value: trimmed, nextIndex: i };
}
function parseFrontmatter(content) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!match)
    return {};
  const fm = {};
  const lines = match[1].split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!m) {
      i++;
      continue;
    }
    const key = m[1];
    const rest = m[2];
    if (rest !== "") {
      fm[key] = parseInlineValue(rest);
      i++;
      continue;
    }
    const block = readBlock(lines, i + 1);
    fm[key] = block.value;
    i = block.nextIndex;
  }
  return fm;
}

// tools/shared/registry/src/contract.ts
function isMissing(value) {
  if (value === undefined || value === null)
    return true;
  if (typeof value === "string" && value.trim() === "")
    return true;
  if (Array.isArray(value) && value.length === 0)
    return true;
  return false;
}
function isType(value, type, property) {
  if (type === "string")
    return typeof value === "string";
  if (type === "number")
    return typeof value === "number";
  if (type === "boolean")
    return typeof value === "boolean";
  if (type === "object")
    return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "array") {
    if (!Array.isArray(value))
      return false;
    return property.items?.type !== "string" || value.every((item) => typeof item === "string");
  }
  return true;
}
function validateContract(data, schema) {
  const errors = [];
  for (const key of schema.required ?? []) {
    if (isMissing(data[key])) {
      errors.push(`missing required field: ${key}`);
    }
  }
  for (const [key, property] of Object.entries(schema.properties ?? {})) {
    const value = data[key];
    if (value === undefined || value === null)
      continue;
    if (property.enum) {
      if (!property.enum.includes(value)) {
        errors.push(`invalid ${key}: expected one of ${property.enum.join("|")}, got ${JSON.stringify(value)}`);
      }
      continue;
    }
    const types = Array.isArray(property.type) ? property.type : property.type ? [property.type] : [];
    if (types.length === 0)
      continue;
    const matches = types.some((type) => isType(value, type, property));
    if (!matches) {
      errors.push(`invalid ${key}: expected ${types.join("|")}, got ${JSON.stringify(value)}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

// tools/unity/unity-compose/src/contract-aware-design.ts
function defaultCapabilitiesDir(options) {
  return join2(options.projectRoot, "xdomains", "game-dev", "unity-3d", "command");
}
function defaultSchemaPath(options) {
  return join2(options.projectRoot, "xdomains", "context", "capability-contract.schema.json");
}
function listMarkdown(dir) {
  const files = [];
  const walk = (current) => {
    let entries;
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join2(current, entry);
      let directory = false;
      try {
        directory = statSync2(full).isDirectory();
      } catch {
        continue;
      }
      if (directory) {
        walk(full);
        continue;
      }
      if (entry.endsWith(".md"))
        files.push(full);
    }
  };
  walk(dir);
  return files.sort();
}
function checkCapability(path, schema) {
  const text = readText(path);
  const id = basename(path, ".md");
  if (text === null) {
    return { id, path: toPosix(path), family: null, mode: null, ok: false, errors: ["unreadable file"] };
  }
  const frontmatter = parseFrontmatter(text);
  const data = frontmatter;
  const validation = validateContract(data, schema);
  const family = typeof data.family === "string" ? data.family : null;
  const mode = typeof data.mode === "string" ? data.mode : null;
  return {
    id: typeof data.id === "string" ? data.id : id,
    path: toPosix(path),
    family,
    mode,
    ok: validation.ok,
    errors: validation.errors
  };
}
function runContractAwareDesign(options) {
  const schemaPath = options.schema ?? defaultSchemaPath(options);
  const capabilitiesDir = options.capabilitiesDir ?? defaultCapabilitiesDir(options);
  const schema = readJson(schemaPath);
  if (!schema) {
    const base = makeResult("contract-aware-design", "unavailable", `no contract schema at ${toPosix(schemaPath)}`, []);
    return { ...base, schemaPath: toPosix(schemaPath), capabilitiesDir: toPosix(capabilitiesDir), checked: 0, valid: 0, invalid: 0, results: [] };
  }
  if (!dirExists(capabilitiesDir)) {
    const base = makeResult("contract-aware-design", "unavailable", `no capabilities directory at ${toPosix(capabilitiesDir)}`, []);
    return { ...base, schemaPath: toPosix(schemaPath), capabilitiesDir: toPosix(capabilitiesDir), checked: 0, valid: 0, invalid: 0, results: [] };
  }
  const results = listMarkdown(capabilitiesDir).map((path) => checkCapability(path, schema));
  const valid = results.filter((result) => result.ok).length;
  const invalid = results.length - valid;
  const status = invalid > 0 ? "observed_locally" : "ok";
  const summary = `${results.length} capability contract(s) checked; ${valid} valid, ${invalid} invalid`;
  const base = makeResult("contract-aware-design", status, summary, []);
  return { ...base, schemaPath: toPosix(schemaPath), capabilitiesDir: toPosix(capabilitiesDir), checked: results.length, valid, invalid, results };
}

// tools/unity/unity-compose/src/coordination-board.ts
import { mkdirSync as mkdirSync2, renameSync, writeFileSync as writeFileSync2 } from "node:fs";
import { join as join3 } from "node:path";
var BOARD_FILE = "board.json";
var BOARD_MARKDOWN_FILE = "board.md";
var BOARD_SCHEMA_VERSION = 1;
var BOARD_VERBS = ["claim", "release", "hold", "release-hold", "status"];
function emptyBoard(now = nowIso()) {
  return { schemaVersion: BOARD_SCHEMA_VERSION, updatedAt: now, claims: [], editorHold: null };
}
function toClaim(raw) {
  const record = asRecord(raw);
  if (!record)
    return null;
  const resource = str(record, "resource");
  const holder = str(record, "holder");
  if (!resource || !holder)
    return null;
  return {
    resource,
    holder,
    note: str(record, "note"),
    claimedAt: str(record, "claimedAt") ?? nowIso(),
    expiresAt: str(record, "expiresAt") ?? nowIso(),
    leaseSeconds: num(record, "leaseSeconds") ?? DEFAULT_LEASE_SECONDS
  };
}
function toHold(raw) {
  if (!raw)
    return null;
  const holder = str(raw, "holder");
  if (!holder)
    return null;
  return {
    holder,
    note: str(raw, "note"),
    acquiredAt: str(raw, "acquiredAt") ?? nowIso(),
    expiresAt: str(raw, "expiresAt") ?? nowIso(),
    leaseSeconds: num(raw, "leaseSeconds") ?? DEFAULT_HOLD_SECONDS
  };
}
function readBoard(dir) {
  const raw = readJson(join3(dir, BOARD_FILE));
  if (!raw)
    return emptyBoard();
  const claims = (Array.isArray(raw.claims) ? raw.claims : []).map(toClaim).filter((claim) => claim !== null);
  return {
    schemaVersion: num(raw, "schemaVersion") ?? BOARD_SCHEMA_VERSION,
    updatedAt: str(raw, "updatedAt") ?? nowIso(),
    claims,
    editorHold: toHold(asRecord(raw.editorHold))
  };
}
function pruneBoard(board, now) {
  const claims = board.claims.filter((claim) => !isExpired(claim.expiresAt, now));
  const editorHold = board.editorHold && !isExpired(board.editorHold.expiresAt, now) ? board.editorHold : null;
  return { ...board, claims, editorHold };
}
function withUpdatedAt(board, now) {
  return { ...board, updatedAt: now };
}
function conflict(action, summary, board, holder, expiresAt) {
  return { ok: false, status: "conflict", action, summary, holder, expiresAt, errors: [summary], board };
}
function success(action, summary, board, holder, expiresAt) {
  return { ok: true, status: "ok", action, summary, holder, expiresAt, errors: [], board };
}
var CLAIM_POLL_MS = 50;
function sleepSync(ms) {
  if (ms <= 0)
    return;
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch {
    const end = Date.now() + ms;
    while (Date.now() < end) {}
  }
}
function claimResourceWithWait(dir, input, now) {
  let board = readBoard(dir);
  let currentNow = now;
  let mutation = claimResource(board, input, currentNow);
  const waitSeconds = input.waitSeconds ?? 0;
  if (mutation.ok || mutation.status !== "conflict" || waitSeconds <= 0)
    return mutation;
  const deadline = Date.now() + waitSeconds * 1000;
  while (Date.now() < deadline) {
    sleepSync(Math.min(CLAIM_POLL_MS, deadline - Date.now()));
    board = readBoard(dir);
    currentNow = nowIso();
    mutation = claimResource(board, input, currentNow);
    if (mutation.ok)
      return mutation;
  }
  return mutation;
}
function claimResource(board, input, now) {
  const leaseSeconds = input.leaseSeconds && input.leaseSeconds > 0 ? input.leaseSeconds : DEFAULT_LEASE_SECONDS;
  const pruned = pruneBoard(board, now);
  const existing = pruned.claims.find((claim) => claim.resource === input.resource);
  if (existing && existing.holder !== input.holder) {
    return conflict("claim", `resource "${input.resource}" is claimed by "${existing.holder}" until ${existing.expiresAt}; fail-fast (advisory board)`, withUpdatedAt(pruned, now), existing.holder, existing.expiresAt);
  }
  const claim = {
    resource: input.resource,
    holder: input.holder,
    note: input.note ?? null,
    claimedAt: existing?.claimedAt ?? now,
    expiresAt: addSeconds(now, leaseSeconds),
    leaseSeconds
  };
  const claims = existing ? pruned.claims.map((entry) => entry.resource === input.resource ? claim : entry) : [...pruned.claims, claim];
  const next = withUpdatedAt({ ...pruned, claims }, now);
  const verb = existing ? "renewed" : "claimed";
  return success("claim", `${verb} "${input.resource}" for "${input.holder}" until ${claim.expiresAt}`, next, input.holder, claim.expiresAt);
}
function releaseResource(board, input, now) {
  const pruned = pruneBoard(board, now);
  const existing = pruned.claims.find((claim) => claim.resource === input.resource);
  if (!existing) {
    return {
      ok: true,
      status: "not_found",
      action: "release",
      summary: `no claim on "${input.resource}"`,
      holder: null,
      expiresAt: null,
      errors: [],
      board: withUpdatedAt(pruned, now)
    };
  }
  if (existing.holder !== input.holder) {
    return conflict("release", `cannot release "${input.resource}": held by "${existing.holder}" until ${existing.expiresAt}; fail-fast (advisory board)`, withUpdatedAt(pruned, now), existing.holder, existing.expiresAt);
  }
  const claims = pruned.claims.filter((claim) => claim.resource !== input.resource);
  return success("release", `released "${input.resource}" from "${input.holder}"`, withUpdatedAt({ ...pruned, claims }, now), null, null);
}
function acquireEditorHold(board, input, now) {
  const leaseSeconds = input.leaseSeconds && input.leaseSeconds > 0 ? input.leaseSeconds : DEFAULT_HOLD_SECONDS;
  const pruned = pruneBoard(board, now);
  const existing = pruned.editorHold;
  if (existing && existing.holder !== input.holder) {
    return conflict("hold", `Editor hold is held by "${existing.holder}" until ${existing.expiresAt}; fail-fast (one holder at a time)`, withUpdatedAt(pruned, now), existing.holder, existing.expiresAt);
  }
  const editorHold = {
    holder: input.holder,
    note: input.note ?? null,
    acquiredAt: existing?.acquiredAt ?? now,
    expiresAt: addSeconds(now, leaseSeconds),
    leaseSeconds
  };
  const next = withUpdatedAt({ ...pruned, editorHold }, now);
  const verb = existing ? "renewed" : "acquired";
  return success("hold", `${verb} Editor hold for "${input.holder}" until ${editorHold.expiresAt}`, next, input.holder, editorHold.expiresAt);
}
function releaseEditorHold(board, input, now) {
  const pruned = pruneBoard(board, now);
  const existing = pruned.editorHold;
  if (!existing) {
    return {
      ok: true,
      status: "not_found",
      action: "release-hold",
      summary: "no Editor hold is active",
      holder: null,
      expiresAt: null,
      errors: [],
      board: withUpdatedAt(pruned, now)
    };
  }
  if (existing.holder !== input.holder) {
    return conflict("release-hold", `cannot release Editor hold: held by "${existing.holder}" until ${existing.expiresAt}; fail-fast`, withUpdatedAt(pruned, now), existing.holder, existing.expiresAt);
  }
  return success("release-hold", `released Editor hold from "${input.holder}"`, withUpdatedAt({ ...pruned, editorHold: null }, now), null, null);
}
function boardStatus(board, now) {
  const pruned = withUpdatedAt(pruneBoard(board, now), now);
  const hold = pruned.editorHold ? `Editor hold: ${pruned.editorHold.holder}` : "Editor hold: free";
  return {
    ok: true,
    status: "ok",
    action: "status",
    summary: `${pruned.claims.length} claim(s); ${hold}`,
    holder: pruned.editorHold?.holder ?? null,
    expiresAt: pruned.editorHold?.expiresAt ?? null,
    errors: [],
    board: pruned
  };
}
function renderBoardMarkdown(board) {
  const lines = ["# Coordination board", "", `Updated: ${board.updatedAt}`, ""];
  lines.push("## Editor hold", "");
  if (board.editorHold) {
    lines.push(`- **${board.editorHold.holder}** until ${board.editorHold.expiresAt}${board.editorHold.note ? ` — ${board.editorHold.note}` : ""}`);
  } else {
    lines.push("- _free_");
  }
  lines.push("", "## Claims", "");
  if (board.claims.length === 0) {
    lines.push("_none_");
  } else {
    lines.push("| resource | holder | expires | note |");
    lines.push("| --- | --- | --- | --- |");
    for (const claim of board.claims) {
      lines.push(`| ${claim.resource} | ${claim.holder} | ${claim.expiresAt} | ${claim.note ?? ""} |`);
    }
  }
  lines.push("");
  return lines.join(`
`);
}
function writeBoard(dir, board) {
  mkdirSync2(dir, { recursive: true });
  const target = join3(dir, BOARD_FILE);
  const temp = join3(dir, `${BOARD_FILE}.tmp`);
  writeFileSync2(temp, JSON.stringify(board, null, 2) + `
`);
  renameSync(temp, target);
  writeFileSync2(join3(dir, BOARD_MARKDOWN_FILE), renderBoardMarkdown(board));
}
function normalizeBoardVerb(value) {
  if (!value || value.trim() === "")
    return { verb: "status", errors: [] };
  const normalized = value.trim().toLowerCase();
  if (BOARD_VERBS.includes(normalized))
    return { verb: normalized, errors: [] };
  return { verb: "status", errors: [`unknown board verb "${value}"; defaulted to status`] };
}
function runCoordinationBoard(options) {
  const dir = join3(options.opencodeDir, "coordination");
  const now = options.now ?? nowIso();
  const { verb, errors } = normalizeBoardVerb(options.verb);
  const board = readBoard(dir);
  if (verb === "claim") {
    if (!options.resource || !options.holder) {
      const base = makeResult("coordination-board", "refused", "claim requires --resource and --holder", ["claim requires --resource and --holder"]);
      return { ...base, action: "claim", holder: null, expiresAt: null, board };
    }
    const mutation = claimResourceWithWait(dir, {
      resource: options.resource,
      holder: options.holder,
      note: options.note,
      leaseSeconds: options.leaseSeconds,
      waitSeconds: options.waitSeconds
    }, now);
    if (mutation.ok)
      writeBoard(dir, mutation.board);
    return toResult(mutation, errors, options);
  }
  if (verb === "release") {
    if (!options.resource || !options.holder) {
      const base = makeResult("coordination-board", "refused", "release requires --resource and --holder", ["release requires --resource and --holder"]);
      return { ...base, action: "release", holder: null, expiresAt: null, board };
    }
    const mutation = releaseResource(board, { resource: options.resource, holder: options.holder }, now);
    if (mutation.ok)
      writeBoard(dir, mutation.board);
    return toResult(mutation, errors, options);
  }
  if (verb === "hold") {
    if (!options.holder) {
      const base = makeResult("coordination-board", "refused", "hold requires --holder", ["hold requires --holder"]);
      return { ...base, action: "hold", holder: null, expiresAt: null, board };
    }
    const mutation = acquireEditorHold(board, { holder: options.holder, note: options.note, leaseSeconds: options.leaseSeconds }, now);
    if (mutation.ok)
      writeBoard(dir, mutation.board);
    return toResult(mutation, errors, options);
  }
  if (verb === "release-hold") {
    if (!options.holder) {
      const base = makeResult("coordination-board", "refused", "release-hold requires --holder", ["release-hold requires --holder"]);
      return { ...base, action: "release-hold", holder: null, expiresAt: null, board };
    }
    const mutation = releaseEditorHold(board, { holder: options.holder }, now);
    if (mutation.ok)
      writeBoard(dir, mutation.board);
    return toResult(mutation, errors, options);
  }
  const mutation = boardStatus(board, now);
  return toResult(mutation, errors, options);
}
function toResult(mutation, extraErrors, options) {
  const base = makeResult("coordination-board", mutation.status, mutation.summary, [...mutation.errors, ...extraErrors]);
  const result = {
    ...base,
    action: mutation.action,
    holder: mutation.holder,
    expiresAt: mutation.expiresAt,
    board: mutation.board
  };
  if (!mutation.ok)
    result.route = "offline";
  return result;
}

// tools/unity/unity-compose/src/primitive-composition.ts
import { readdirSync as readdirSync2, statSync as statSync3 } from "node:fs";
import { basename as basename2, join as join4 } from "node:path";

// tools/unity/unity-compose/src/yaml.ts
function stripComment(raw) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0;i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (ch === "#" && !inSingle && !inDouble) {
      if (i === 0 || /\s/.test(raw[i - 1]))
        return raw.slice(0, i);
    }
  }
  return raw;
}
function unquote(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2 || trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}
function splitTopLevel2(input, delimiter) {
  const parts = [];
  let depth = 0;
  let current = "";
  let inSingle = false;
  let inDouble = false;
  for (const ch of input) {
    if (inSingle) {
      current += ch;
      if (ch === "'")
        inSingle = false;
      continue;
    }
    if (inDouble) {
      current += ch;
      if (ch === '"')
        inDouble = false;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      current += ch;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      current += ch;
      continue;
    }
    if (ch === "[" || ch === "{")
      depth++;
    if (ch === "]" || ch === "}")
      depth--;
    if (ch === delimiter && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts;
}
function parseInlineArray(raw) {
  const inner = raw.slice(1, -1).trim();
  if (inner === "")
    return [];
  return splitTopLevel2(inner, ",").map((item) => parseScalar(item)).filter((value) => !(typeof value === "string" && value.trim() === ""));
}
function parseInlineObject(raw) {
  const inner = raw.slice(1, -1).trim();
  const obj = {};
  if (inner === "")
    return obj;
  for (const part of splitTopLevel2(inner, ",")) {
    const idx = part.indexOf(":");
    if (idx === -1)
      continue;
    const key = unquote(part.slice(0, idx));
    obj[key] = parseScalar(part.slice(idx + 1));
  }
  return obj;
}
function parseScalar(raw) {
  const text = unquote(stripComment(raw));
  if (text === "")
    return "";
  if (text === "null" || text === "~")
    return null;
  if (text === "true")
    return true;
  if (text === "false")
    return false;
  if (/^-?\d+$/.test(text))
    return Number(text);
  if (/^-?\d+\.\d+$/.test(text))
    return Number(text);
  if (text.startsWith("[") && text.endsWith("]"))
    return parseInlineArray(text);
  if (text.startsWith("{") && text.endsWith("}"))
    return parseInlineObject(text);
  return text;
}
function isSequenceLine(content) {
  return content === "-" || content.startsWith("- ");
}
function parseMapping(lines, start, indent) {
  const obj = {};
  let i = start;
  while (i < lines.length && lines[i].indent === indent && !isSequenceLine(lines[i].content)) {
    const line = lines[i];
    const match = /^([^:]+):\s*(.*)$/.exec(line.content);
    if (!match)
      break;
    const key = unquote(match[1]);
    const rest = match[2];
    if (rest.trim() === "") {
      if (i + 1 < lines.length && lines[i + 1].indent > indent) {
        const child = parseBlock(lines, i + 1, lines[i + 1].indent);
        obj[key] = child.value;
        i = child.next;
      } else {
        obj[key] = null;
        i++;
      }
    } else {
      obj[key] = parseScalar(rest);
      i++;
    }
  }
  return { value: obj, next: i };
}
function parseSequence(lines, start, indent) {
  const arr = [];
  let i = start;
  while (i < lines.length && lines[i].indent === indent && isSequenceLine(lines[i].content)) {
    const line = lines[i];
    const rest = line.content === "-" ? "" : line.content.slice(2);
    if (rest.trim() === "") {
      if (i + 1 < lines.length && lines[i + 1].indent > indent) {
        const child = parseBlock(lines, i + 1, lines[i + 1].indent);
        arr.push(child.value);
        i = child.next;
      } else {
        arr.push(null);
        i++;
      }
      continue;
    }
    const match = /^([^:]+):\s*(.*)$/.exec(rest);
    if (match) {
      const obj = {};
      const key = unquote(match[1]);
      const value = match[2];
      if (value.trim() === "") {
        if (i + 1 < lines.length && lines[i + 1].indent > indent) {
          const child = parseBlock(lines, i + 1, lines[i + 1].indent);
          obj[key] = child.value;
          i = child.next;
        } else {
          obj[key] = null;
          i++;
        }
      } else {
        obj[key] = parseScalar(value);
        i++;
      }
      while (i < lines.length && lines[i].indent > indent && !isSequenceLine(lines[i].content)) {
        const cont = lines[i];
        const contMatch = /^([^:]+):\s*(.*)$/.exec(cont.content);
        if (!contMatch)
          break;
        const contKey = unquote(contMatch[1]);
        const contValue = contMatch[2];
        if (contValue.trim() === "") {
          if (i + 1 < lines.length && lines[i + 1].indent > cont.indent) {
            const child = parseBlock(lines, i + 1, lines[i + 1].indent);
            obj[contKey] = child.value;
            i = child.next;
          } else {
            obj[contKey] = null;
            i++;
          }
        } else {
          obj[contKey] = parseScalar(contValue);
          i++;
        }
      }
      arr.push(obj);
      continue;
    }
    arr.push(parseScalar(rest));
    i++;
  }
  return { value: arr, next: i };
}
function parseBlock(lines, start, indent) {
  if (start >= lines.length)
    return { value: null, next: start };
  if (isSequenceLine(lines[start].content))
    return parseSequence(lines, start, indent);
  return parseMapping(lines, start, indent);
}
function parseYaml(text) {
  const lines = [];
  for (const raw of text.split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed.startsWith("#"))
      continue;
    const content = stripComment(raw).trim();
    if (content === "" || content === "---")
      continue;
    lines.push({ indent: raw.length - raw.trimStart().length, content });
  }
  if (lines.length === 0)
    return null;
  return parseBlock(lines, 0, lines[0].indent).value;
}

// tools/unity/unity-compose/src/primitive-composition.ts
function emptyReport() {
  return { primitives: [], edges: [], conflicts: [], unresolved: [], cycles: [] };
}
function asStrings(value) {
  if (Array.isArray(value))
    return value.filter((item) => typeof item === "string");
  if (typeof value === "string" && value.trim() !== "")
    return [value];
  return [];
}
function toPrimitiveRecord(id, path, parsed) {
  const record = asRecord(parsed);
  const requiresBlock = asRecord(record?.requires);
  return {
    id: str(record, "id") ?? id,
    path,
    summary: str(record, "summary"),
    requires: asStrings(requiresBlock?.primitives),
    events: asStrings(record?.wireThroughEvents ?? record?.events),
    compatiblePrimitives: asStrings(record?.compatiblePrimitives),
    conflictsWith: asStrings(record?.conflictsWith)
  };
}
function discoverPrimitives(dir) {
  const records = [];
  const walk = (current) => {
    let entries;
    try {
      entries = readdirSync2(current);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join4(current, entry);
      let directory = false;
      try {
        directory = statSync3(full).isDirectory();
      } catch {
        continue;
      }
      if (directory) {
        walk(full);
        continue;
      }
      if (entry !== "primitive.yaml" && entry !== "primitive.yml")
        continue;
      const text = readText(full);
      if (text === null)
        continue;
      records.push(toPrimitiveRecord(basename2(current), toPosix(full), parseYaml(text)));
    }
  };
  walk(dir);
  records.sort((a, b) => a.id.localeCompare(b.id));
  return records;
}
function findCycles(records) {
  const known = new Set(records.map((record) => record.id));
  const graph = new Map;
  for (const record of records)
    graph.set(record.id, record.requires.filter((dep) => known.has(dep)));
  const cycles = [];
  const visited = new Set;
  const stack = [];
  const inStack = new Set;
  const visit = (node) => {
    if (inStack.has(node)) {
      const index = stack.indexOf(node);
      if (index !== -1)
        cycles.push([...stack.slice(index), node]);
      return;
    }
    if (visited.has(node))
      return;
    visited.add(node);
    inStack.add(node);
    stack.push(node);
    for (const dep of graph.get(node) ?? [])
      visit(dep);
    stack.pop();
    inStack.delete(node);
  };
  for (const record of records)
    visit(record.id);
  return cycles;
}
function analyzeComposition(records) {
  const ids = new Set(records.map((record) => record.id));
  const edges = [];
  const unresolved = [];
  const conflicts = [];
  const seenPairs = new Set;
  for (const record of records) {
    for (const dep of record.requires) {
      edges.push({ from: record.id, to: dep, kind: "requires" });
      if (!ids.has(dep))
        unresolved.push(`${record.id} requires unknown primitive "${dep}"`);
    }
    for (const event of record.events)
      edges.push({ from: record.id, to: event, kind: "event" });
    for (const compatible of record.compatiblePrimitives) {
      edges.push({ from: record.id, to: compatible, kind: "compatible" });
    }
    for (const conflict of record.conflictsWith) {
      edges.push({ from: record.id, to: conflict, kind: "conflicts" });
      const pair = [record.id, conflict].sort().join("|");
      if (seenPairs.has(pair))
        continue;
      seenPairs.add(pair);
      conflicts.push({ a: record.id, b: conflict, reason: "declared conflictsWith" });
    }
  }
  return { primitives: records, edges, conflicts, unresolved, cycles: findCycles(records) };
}
function defaultPrimitivesDir(options) {
  return join4(options.projectRoot, "xdomains", "game-dev", "unity-3d", "primitives");
}
function runPrimitiveComposition(options) {
  const dir = options.primitivesDir ?? defaultPrimitivesDir(options);
  if (!dirExists(dir)) {
    const base = makeResult("primitive-composition", "unavailable", `no primitives directory at ${toPosix(dir)}`, []);
    return { ...base, primitivesDir: toPosix(dir), report: emptyReport() };
  }
  const records = discoverPrimitives(dir);
  const report = analyzeComposition(records);
  const problems = report.conflicts.length + report.unresolved.length + report.cycles.length;
  const status = problems > 0 ? "observed_locally" : "ok";
  const summary = records.length === 0 ? `no primitive.yaml found under ${toPosix(dir)}` : `${records.length} primitive(s); ${report.edges.length} edge(s), ${report.conflicts.length} conflict(s), ${report.cycles.length} cycle(s), ${report.unresolved.length} unresolved`;
  const base = makeResult("primitive-composition", status, summary, []);
  return { ...base, primitivesDir: toPosix(dir), report };
}

// tools/unity/unity-compose/src/abilities.ts
function runCompose(options) {
  switch (options.ability) {
    case "coordination-board":
      return runCoordinationBoard(options);
    case "primitive-composition":
      return runPrimitiveComposition(options);
    case "contract-aware-design":
      return runContractAwareDesign(options);
    case "ci-status-baseline":
      return runCiStatusBaseline(options);
    default:
      return runCoordinationBoard({ ...options, ability: "coordination-board" });
  }
}

// tools/unity/unity-compose/src/cli.ts
import { join as join5, resolve } from "node:path";

// tools/shared/cli-args.ts
function parseArgs(argv) {
  const out = {};
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith("--") && arg.includes("=")) {
      const eq = arg.indexOf("=");
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
      i++;
      continue;
    }
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        out[key] = next;
        i += 2;
      } else {
        out[key] = true;
        i++;
      }
      continue;
    }
    i++;
  }
  return out;
}
function firstString(args, keys) {
  for (const key of keys) {
    const value = args[key];
    if (typeof value === "string" && value.trim() !== "")
      return value;
  }
  return;
}
function resolveAbility(requested, abilities, fallback) {
  return abilities.includes(requested) ? requested : fallback;
}

// tools/unity/unity-compose/src/cli.ts
function resolveOptions(argv) {
  const args = parseArgs(argv);
  const projectRoot = resolve(String(args["project-root"] || process.cwd()));
  const opencodeDir = resolve(String(args["opencode-dir"] || join5(projectRoot, ".opencode")));
  const requested = String(args.ability || "coordination-board");
  const ability = resolveAbility(requested, COMPOSE_ABILITIES, "coordination-board");
  const leaseRaw = args["lease-seconds"] ?? args.leaseSeconds;
  const leaseSeconds = leaseRaw === undefined ? undefined : parsePositiveInt(leaseRaw, 0);
  const waitRaw = args["wait-seconds"] ?? args.waitSeconds;
  const waitSeconds = waitRaw === undefined ? undefined : parsePositiveInt(waitRaw, 0);
  return {
    projectRoot,
    opencodeDir,
    ability,
    json: Boolean(args.json),
    list: Boolean(args.list),
    verb: firstString(args, ["verb", "operation"]),
    resource: firstString(args, ["resource", "scope"]),
    holder: firstString(args, ["holder", "agent"]),
    note: firstString(args, ["note"]),
    leaseSeconds: leaseSeconds || undefined,
    waitSeconds: waitSeconds || undefined,
    now: firstString(args, ["now"]),
    primitivesDir: firstString(args, ["primitives-dir", "primitivesDir"]),
    capabilitiesDir: firstString(args, ["capabilities-dir", "capabilitiesDir"]),
    schema: firstString(args, ["schema"]),
    source: firstString(args, ["source"]),
    cliCommand: firstString(args, ["unity-cli", "unityCli"]) ?? "unity"
  };
}

// tools/unity/unity-compose/src/index.ts
function render(result) {
  const lines = [`[${result.ability}] ${result.status} — ${result.summary}`];
  lines.push(`  route: ${result.route} · mode: ${result.mode}`);
  if ("action" in result && "board" in result) {
    lines.push(`  action: ${result.action} · claims: ${result.board.claims.length}`);
    if (result.holder)
      lines.push(`  holder: ${result.holder} until ${result.expiresAt ?? "n/a"}`);
    for (const claim of result.board.claims)
      lines.push(`  claim ${claim.resource} → ${claim.holder} (until ${claim.expiresAt})`);
    if (result.board.editorHold)
      lines.push(`  editor hold: ${result.board.editorHold.holder} until ${result.board.editorHold.expiresAt}`);
  }
  if ("report" in result) {
    lines.push(`  primitives: ${result.report.primitives.length} · edges: ${result.report.edges.length}`);
    for (const conflict of result.report.conflicts)
      lines.push(`  conflict ${conflict.a} ↔ ${conflict.b} (${conflict.reason})`);
    for (const unresolved of result.report.unresolved)
      lines.push(`  unresolved: ${unresolved}`);
  }
  if ("results" in result && "checked" in result) {
    lines.push(`  checked: ${result.checked} · valid: ${result.valid} · invalid: ${result.invalid}`);
    for (const check of result.results) {
      if (!check.ok)
        lines.push(`  invalid ${check.id}: ${check.errors.join("; ")}`);
    }
  }
  if ("baselinePath" in result) {
    lines.push(`  action: ${result.action} · baseline: ${result.baseline?.status ?? "none"}`);
  }
  for (const error of result.errors)
    lines.push(`  error: ${error}`);
  return lines.join(`
`);
}
runCli({ abilities: COMPOSE_ABILITIES, resolveOptions, run: runCompose, render });
