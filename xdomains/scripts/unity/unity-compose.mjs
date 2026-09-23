// tools/shared/cli-bootstrap.ts
function isThenable(value) {
  return typeof value?.then === "function";
}
function runCli(config) {
  const argv = config.argv ?? process.argv.slice(2);
  const write = config.write ?? ((text) => process.stdout.write(text));
  let options;
  try {
    options = config.resolveOptions(argv);
  } catch (error) {
    write(`${error instanceof Error ? error.message : String(error)}
`);
    process.exitCode = 2;
    return;
  }
  if (options.list) {
    if (config.abilities.length > 0)
      write(config.abilities.join(`
`) + `
`);
    return;
  }
  const emit = (result) => {
    if (options.json) {
      write(JSON.stringify(result, null, 2) + `
`);
      return;
    }
    write(config.render(result) + `
`);
  };
  let result;
  try {
    result = config.run(options);
  } catch (error) {
    write(`${error instanceof Error ? error.message : String(error)}
`);
    process.exitCode = 1;
    return;
  }
  if (isThenable(result)) {
    result.then(emit).catch((error) => {
      write(`${error instanceof Error ? error.message : String(error)}
`);
      process.exitCode = 1;
    });
    return;
  }
  emit(result);
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
  "ci-status-baseline",
  "plan-feature",
  "test-plan",
  "workflow-catalog"
];
var COMPOSE_ABILITIES = [...COMPOSE_ABILITY_NAMES];
var COMPOSE_MODES = {
  "coordination-board": "offline",
  "primitive-composition": "offline",
  "contract-aware-design": "offline",
  "ci-status-baseline": "both",
  "plan-feature": "offline",
  "test-plan": "offline",
  "workflow-catalog": "offline"
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
      approved: options.approved ?? false,
      writesState: options.writesState ?? false,
      advisory: options.advisory ?? false
    }
  };
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
    const base = makeResult("ci-status-baseline", "recorded", `recorded CI baseline: ${baseline.status}`, [], { writesState: true });
    return { ...base, action, baselinePath: toPosix(path), baseline };
  }
  const baseline = readBaseline(path);
  if (!baseline) {
    const base = makeResult("ci-status-baseline", "not_found", `no CI baseline at ${toPosix(path)}`, [], { writesState: true });
    return { ...base, action, baselinePath: toPosix(path), baseline: null };
  }
  const base = makeResult("ci-status-baseline", "ok", `CI baseline: ${baseline.status} (recorded ${baseline.recordedAt})`, [], { writesState: true });
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
  const scalar = tryParseJson(trimmed);
  if (scalar !== undefined && (typeof scalar !== "object" || scalar === null)) {
    return scalar;
  }
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
  const trimmed = collected.map((line) => line.trim()).filter((line) => line !== "" && !line.startsWith("#"));
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
function frontmatterString(fm, key) {
  const value = fm[key];
  return typeof value === "string" ? value : undefined;
}
function frontmatterStringArray(fm, key) {
  const value = fm[key];
  if (!Array.isArray(value))
    return;
  return value.filter((item) => typeof item === "string");
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
var COORDINATION_SAFETY = { advisory: true, writesState: true };
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
var MAX_WAIT_SECONDS = 60;
function clampWaitSeconds(waitSeconds) {
  return Math.max(0, Math.min(waitSeconds ?? 0, MAX_WAIT_SECONDS));
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}
async function claimResourceWithWait(dir, input, now) {
  let board = readBoard(dir);
  let currentNow = now;
  let mutation = claimResource(board, input, currentNow);
  const waitSeconds = clampWaitSeconds(input.waitSeconds);
  if (mutation.ok || mutation.status !== "conflict" || waitSeconds <= 0)
    return mutation;
  const deadline = Date.now() + waitSeconds * 1000;
  while (Date.now() < deadline) {
    await sleep(Math.min(CLAIM_POLL_MS, deadline - Date.now()));
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
async function runCoordinationBoard(options) {
  const dir = join3(options.opencodeDir, "coordination");
  const now = options.now ?? nowIso();
  const { verb, errors } = normalizeBoardVerb(options.verb);
  const board = readBoard(dir);
  if (verb === "claim") {
    if (!options.resource || !options.holder) {
      const base = makeResult("coordination-board", "refused", "claim requires --resource and --holder", ["claim requires --resource and --holder"], COORDINATION_SAFETY);
      return { ...base, action: "claim", holder: null, expiresAt: null, board };
    }
    const mutation = await claimResourceWithWait(dir, {
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
      const base = makeResult("coordination-board", "refused", "release requires --resource and --holder", ["release requires --resource and --holder"], COORDINATION_SAFETY);
      return { ...base, action: "release", holder: null, expiresAt: null, board };
    }
    const mutation = releaseResource(board, { resource: options.resource, holder: options.holder }, now);
    if (mutation.ok)
      writeBoard(dir, mutation.board);
    return toResult(mutation, errors, options);
  }
  if (verb === "hold") {
    if (!options.holder) {
      const base = makeResult("coordination-board", "refused", "hold requires --holder", ["hold requires --holder"], COORDINATION_SAFETY);
      return { ...base, action: "hold", holder: null, expiresAt: null, board };
    }
    const mutation = acquireEditorHold(board, { holder: options.holder, note: options.note, leaseSeconds: options.leaseSeconds }, now);
    if (mutation.ok)
      writeBoard(dir, mutation.board);
    return toResult(mutation, errors, options);
  }
  if (verb === "release-hold") {
    if (!options.holder) {
      const base = makeResult("coordination-board", "refused", "release-hold requires --holder", ["release-hold requires --holder"], COORDINATION_SAFETY);
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
  const base = makeResult("coordination-board", mutation.status, mutation.summary, [...mutation.errors, ...extraErrors], COORDINATION_SAFETY);
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

// tools/unity/unity-compose/src/plan-feature.ts
import { mkdirSync as mkdirSync3, rmSync, writeFileSync as writeFileSync3 } from "node:fs";
import { join as join4 } from "node:path";

// tools/shared/slug.ts
var SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function isValidSlug(value) {
  return SLUG_PATTERN.test(value);
}

// tools/unity/studio-config/src/types.ts
var STUDIO_MODES = ["lean", "full"];
var REVIEW_INTENSITIES = ["full", "lean", "solo"];
var MODEL_TIERS = ["router", "lead", "specialist"];
var UI_STACKS = ["uitk", "ugui", "mixed"];
var STUDIO_CONFIG_SCHEMA_VERSION = 1;
var DEFAULT_STUDIO_CONFIG = {
  schemaVersion: STUDIO_CONFIG_SCHEMA_VERSION,
  studioMode: "lean",
  reviewIntensity: "full",
  uiStack: "uitk",
  toggles: { tdd: false, ftf: false, unitySkills: false },
  patterns: [],
  packages: [],
  modelTiers: {}
};

// tools/unity/studio-config/src/config.ts
var KNOWN_KEYS = new Set([
  "$schema",
  "schemaVersion",
  "studioMode",
  "reviewIntensity",
  "uiStack",
  "toggles",
  "patterns",
  "packages",
  "modelTiers"
]);
var KNOWN_TOGGLE_KEYS = new Set(["tdd", "ftf", "unitySkills"]);
function defaultStudioConfig() {
  return {
    ...DEFAULT_STUDIO_CONFIG,
    toggles: { ...DEFAULT_STUDIO_CONFIG.toggles },
    patterns: [],
    packages: [],
    modelTiers: { ...DEFAULT_STUDIO_CONFIG.modelTiers }
  };
}
function parseStringArray(value, field, problems) {
  if (value === undefined)
    return [];
  if (!Array.isArray(value)) {
    problems.push({ field, message: "expected an array of strings" });
    return [];
  }
  const out = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim() !== "") {
      const id = item.trim();
      if (!out.includes(id))
        out.push(id);
    } else {
      problems.push({ field, message: `ignored non-string entry ${JSON.stringify(item)}` });
    }
  }
  return out;
}
function parseMode(value, problems) {
  if (value === undefined)
    return DEFAULT_STUDIO_CONFIG.studioMode;
  if (typeof value === "string" && STUDIO_MODES.includes(value)) {
    return value;
  }
  problems.push({ field: "studioMode", message: `expected one of ${STUDIO_MODES.join("|")}, got ${JSON.stringify(value)}` });
  return DEFAULT_STUDIO_CONFIG.studioMode;
}
function parseIntensity(value, problems) {
  if (value === undefined)
    return DEFAULT_STUDIO_CONFIG.reviewIntensity;
  if (typeof value === "string" && REVIEW_INTENSITIES.includes(value)) {
    return value;
  }
  problems.push({
    field: "reviewIntensity",
    message: `expected one of ${REVIEW_INTENSITIES.join("|")}, got ${JSON.stringify(value)}`
  });
  return DEFAULT_STUDIO_CONFIG.reviewIntensity;
}
function parseUiStack(value, problems) {
  if (value === undefined)
    return DEFAULT_STUDIO_CONFIG.uiStack;
  if (typeof value === "string" && UI_STACKS.includes(value)) {
    return value;
  }
  problems.push({ field: "uiStack", message: `expected one of ${UI_STACKS.join("|")}, got ${JSON.stringify(value)}` });
  return DEFAULT_STUDIO_CONFIG.uiStack;
}
function parseToggles(value, problems) {
  const toggles = { ...DEFAULT_STUDIO_CONFIG.toggles };
  if (value === undefined)
    return toggles;
  const record = asRecord(value);
  if (!record) {
    problems.push({ field: "toggles", message: "expected an object with boolean tdd/ftf/unitySkills flags" });
    return toggles;
  }
  for (const key of Object.keys(record)) {
    if (!KNOWN_TOGGLE_KEYS.has(key))
      problems.push({ field: `toggles.${key}`, message: "unknown toggle" });
  }
  for (const key of KNOWN_TOGGLE_KEYS) {
    const flag = record[key];
    if (flag === undefined)
      continue;
    if (typeof flag === "boolean")
      toggles[key] = flag;
    else
      problems.push({ field: `toggles.${key}`, message: `expected a boolean, got ${JSON.stringify(flag)}` });
  }
  return toggles;
}
function parseModelTiers(value, problems) {
  const tiers = {};
  if (value === undefined)
    return tiers;
  const record = asRecord(value);
  if (!record) {
    problems.push({
      field: "modelTiers",
      message: `expected an object mapping ${MODEL_TIERS.join("|")} to a model id`
    });
    return tiers;
  }
  for (const key of Object.keys(record)) {
    if (!MODEL_TIERS.includes(key)) {
      problems.push({ field: `modelTiers.${key}`, message: `unknown tier; expected one of ${MODEL_TIERS.join("|")}` });
      continue;
    }
    const model = record[key];
    if (typeof model !== "string" || model.trim() === "") {
      problems.push({
        field: `modelTiers.${key}`,
        message: `expected a non-empty model id string, got ${JSON.stringify(model)}`
      });
      continue;
    }
    tiers[key] = model.trim();
  }
  return tiers;
}
function parseStudioConfig(value) {
  const problems = [];
  const record = asRecord(value);
  if (!record) {
    problems.push({ field: "$", message: "config must be a JSON object" });
    return { config: defaultStudioConfig(), problems };
  }
  for (const key of Object.keys(record)) {
    if (!KNOWN_KEYS.has(key))
      problems.push({ field: key, message: "unknown property" });
  }
  let schemaVersion = DEFAULT_STUDIO_CONFIG.schemaVersion;
  if (record.schemaVersion !== undefined) {
    if (typeof record.schemaVersion !== "number" || !Number.isFinite(record.schemaVersion)) {
      problems.push({ field: "schemaVersion", message: `expected a number, got ${JSON.stringify(record.schemaVersion)}` });
    } else if (record.schemaVersion !== STUDIO_CONFIG_SCHEMA_VERSION) {
      problems.push({
        field: "schemaVersion",
        message: `unsupported schema version ${JSON.stringify(record.schemaVersion)}, expected ${STUDIO_CONFIG_SCHEMA_VERSION}`
      });
    } else {
      schemaVersion = record.schemaVersion;
    }
  }
  const config = {
    schemaVersion,
    studioMode: parseMode(record.studioMode, problems),
    reviewIntensity: parseIntensity(record.reviewIntensity, problems),
    uiStack: parseUiStack(record.uiStack, problems),
    toggles: parseToggles(record.toggles, problems),
    patterns: parseStringArray(record.patterns, "patterns", problems),
    packages: parseStringArray(record.packages, "packages", problems),
    modelTiers: parseModelTiers(record.modelTiers, problems)
  };
  return { config, problems };
}
function loadStudioConfig(path) {
  const text = readText(path);
  if (text === null)
    return { present: false, path, config: defaultStudioConfig(), problems: [] };
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      present: true,
      path,
      config: defaultStudioConfig(),
      problems: [{ field: "$", message: `invalid JSON: ${error instanceof Error ? error.message : String(error)}` }]
    };
  }
  const { config, problems } = parseStudioConfig(parsed);
  return { present: true, path, config, problems };
}

// tools/unity/unity-compose/src/plan-feature.ts
var PLAN_DIR = "plans";
var LOOPBACK_SUFFIX = ".loopback.json";
var PLAN_SCHEMA_VERSION = 1;
var PLAN_SECTIONS = [
  "Context",
  "Implementation Design",
  "Test Cases",
  "Testing Decisions",
  "Testability Assessment",
  "Known Trade-offs",
  "Development Workflow"
];
var NOT_PROVIDED = "_Not provided._";
var NONE_RECORDED = "- None recorded.";
var DEVELOPMENT_WORKFLOW = [
  "Follow the `tdd` loop rules:",
  "",
  "1. **Red before green.** Write the failing test first, then only enough code to pass it.",
  "2. **One vertical slice at a time.** One seam, one test, one minimal implementation per cycle.",
  "3. **Tests at pre-agreed public seams only.** Confirm the seams before writing any test.",
  "4. **Refactoring belongs to review**, not the red → green loop.",
  "",
  "Reject these test anti-patterns:",
  "",
  "- **Implementation-coupled** — mocks internal collaborators, tests private methods, or observes through a side channel.",
  "- **Tautological** — the assertion recomputes the expected value the way the code does; expected values must come from an independent source of truth.",
  "- **Horizontally sliced** — all tests written before any implementation; work in vertical tracer-bullet slices instead."
].join(`
`);
function plansDir(options) {
  return join4(options.opencodeDir, PLAN_DIR);
}
function planPath(options, slug) {
  return join4(plansDir(options), `${slug}.md`);
}
function loopbackPath(options, slug) {
  return join4(plansDir(options), `${slug}${LOOPBACK_SUFFIX}`);
}
function normalizeVerdict(value) {
  const text = (value ?? "").trim().toUpperCase();
  return text === "PASS" || text === "WARN" || text === "FAIL" ? text : null;
}
function renderPlanArtifact(artifact) {
  return [
    `# Plan: ${artifact.feature}`,
    `## Context

${artifact.context}`,
    `## Implementation Design

${artifact.implementationDesign}`,
    `## Test Cases

${artifact.testCases}`,
    `## Testing Decisions

${artifact.testingDecisions}`,
    `## Testability Assessment

TESTABILITY: ${artifact.testability}`,
    `## Known Trade-offs

${artifact.tradeOffs}`,
    `## Development Workflow

${artifact.developmentWorkflow}`
  ].join(`

`) + `
`;
}
function validatePlanArtifact(markdown) {
  const errors = [];
  let cursor = -1;
  for (const section of PLAN_SECTIONS) {
    const index = markdown.indexOf(`## ${section}`);
    if (index === -1) {
      errors.push(`missing section: ${section}`);
      continue;
    }
    if (index < cursor)
      errors.push(`section out of order: ${section}`);
    cursor = index;
  }
  return { ok: errors.length === 0, errors };
}
function tradeOffsBody(options, verdict) {
  const base = (options.tradeOffs ?? "").trim();
  if (verdict !== "WARN")
    return base || NONE_RECORDED;
  const warning = "- Testability WARN: the test-designer reported testability issues; resolve them before implementation.";
  return base ? `${base}
${warning}` : warning;
}
function readLoopbackAttempts(options, slug) {
  const state = readJson(loopbackPath(options, slug));
  if (num(state, "schemaVersion") !== PLAN_SCHEMA_VERSION)
    return 0;
  return num(state, "attempts") ?? 0;
}
function writeLoopback(options, slug, attempts) {
  const state = {
    schemaVersion: PLAN_SCHEMA_VERSION,
    feature: slug,
    attempts,
    updatedAt: nowIso()
  };
  writeJson(loopbackPath(options, slug), state);
}
function clearLoopback(options, slug) {
  try {
    rmSync(loopbackPath(options, slug), { force: true });
  } catch {}
}
function refuse(slug, target, testability, message) {
  const base = makeResult("plan-feature", "refused", message, [message], { writesState: true });
  return {
    ...base,
    action: "refuse",
    feature: slug,
    planPath: target,
    testability,
    attempt: 0,
    written: false,
    instruction: null
  };
}
function runPlanFeature(options) {
  const slug = (options.feature ?? "").trim();
  const target = slug ? toPosix(planPath(options, slug)) : toPosix(plansDir(options));
  if (!slug)
    return refuse(null, target, null, "a --feature <slug> is required");
  if (!isValidSlug(slug)) {
    return refuse(slug, target, null, `invalid feature slug "${slug}"; use kebab-case (a-z, 0-9, -)`);
  }
  const load = loadStudioConfig(join4(options.opencodeDir, "unity-studio.json"));
  if (!load.config.toggles.tdd) {
    return refuse(slug, target, null, "TDD is off (.opencode/unity-studio.json toggles.tdd=false); plan-feature is TDD-gated. Enable the toggle to plan test-first — TDD off still requires tests, just not first.");
  }
  const verdict = normalizeVerdict(options.testability);
  if (!verdict) {
    return refuse(slug, target, null, "a --testability verdict is required (PASS|WARN|FAIL)");
  }
  const testCases = options.testCases ?? "";
  if (testCases.trim() === "") {
    return refuse(slug, target, verdict, "Test Cases are required (--test-cases); the artifact carries them verbatim from test-designer");
  }
  if (verdict === "FAIL") {
    const attempts = readLoopbackAttempts(options, slug);
    if (attempts < 1) {
      writeLoopback(options, slug, 1);
      const base = makeResult("plan-feature", "loopback", `Testability FAIL for "${slug}"; one retry remains`, [], {
        writesState: true
      });
      return {
        ...base,
        action: "loopback",
        feature: slug,
        planPath: target,
        testability: verdict,
        attempt: 1,
        written: false,
        instruction: "Revise the Implementation Design to address the testability issues, then re-run plan-feature. This is the one permitted retry."
      };
    }
    clearLoopback(options, slug);
    const base = makeResult("plan-feature", "aborted", `Testability FAIL persists for "${slug}" after one retry; aborting`, [], {
      writesState: true
    });
    return {
      ...base,
      action: "abort",
      feature: slug,
      planPath: target,
      testability: verdict,
      attempt: attempts + 1,
      written: false,
      instruction: "Abort: the revised design still fails testability. Escalate to the user with the testability issues."
    };
  }
  clearLoopback(options, slug);
  const artifact = {
    feature: slug,
    context: (options.context ?? "").trim() || NOT_PROVIDED,
    implementationDesign: (options.design ?? "").trim() || NOT_PROVIDED,
    testCases,
    testingDecisions: (options.testingDecisions ?? "").trim() || NOT_PROVIDED,
    testability: verdict,
    tradeOffs: tradeOffsBody(options, verdict),
    developmentWorkflow: DEVELOPMENT_WORKFLOW
  };
  const markdown = renderPlanArtifact(artifact);
  const validation = validatePlanArtifact(markdown);
  if (!validation.ok) {
    return refuse(slug, target, verdict, `assembled plan failed validation: ${validation.errors.join("; ")}`);
  }
  const path = planPath(options, slug);
  mkdirSync3(plansDir(options), { recursive: true });
  writeFileSync3(path, markdown);
  const base = makeResult("plan-feature", "ok", `wrote plan artifact for "${slug}" (TESTABILITY: ${verdict})`, [], {
    writesState: true
  });
  return {
    ...base,
    action: "write",
    feature: slug,
    planPath: toPosix(path),
    testability: verdict,
    attempt: 0,
    written: true,
    instruction: null
  };
}

// tools/unity/unity-compose/src/primitive-composition.ts
import { readdirSync as readdirSync2, statSync as statSync3 } from "node:fs";
import { basename as basename2, join as join5 } from "node:path";

// tools/shared/yaml.ts
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
function isContinuationLine(line, indent) {
  return Boolean(line && line.indent > indent && !isSequenceLine(line.content) && !/^[A-Za-z_][A-Za-z0-9_.-]*:(\s|$)/.test(line.content));
}
function foldContinuations(lines, start, indent, value) {
  if (typeof value !== "string")
    return { value, next: start };
  let folded = value;
  let i = start;
  while (isContinuationLine(lines[i], indent)) {
    folded = `${folded} ${lines[i].content}`;
    i++;
  }
  return { value: folded, next: i };
}
function parseMapping(lines, start, indent) {
  const obj = {};
  let i = start;
  while (i < lines.length) {
    if (lines[i].indent < indent)
      break;
    if (lines[i].indent > indent) {
      i++;
      continue;
    }
    if (isSequenceLine(lines[i].content))
      break;
    const match = /^([A-Za-z_][A-Za-z0-9_.-]*):(?:\s+(.*)|)$/.exec(lines[i].content);
    if (!match) {
      i++;
      continue;
    }
    const key = unquote(match[1]);
    const rest = match[2] ?? "";
    if (rest.trim() === "") {
      const next = lines[i + 1];
      if (next && (next.indent > indent || next.indent === indent && isSequenceLine(next.content))) {
        const child = parseBlock(lines, i + 1, next.indent);
        obj[key] = child.value;
        i = child.next;
      } else {
        obj[key] = null;
        i++;
      }
    } else {
      const folded = foldContinuations(lines, i + 1, indent, parseScalar(rest));
      obj[key] = folded.value;
      i = folded.next;
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
    const match = /^([A-Za-z_][A-Za-z0-9_.-]*):(?:\s+(.*)|)$/.exec(rest);
    if (match) {
      const obj = {};
      const key = unquote(match[1]);
      const value = match[2] ?? "";
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
        const contMatch = /^([A-Za-z_][A-Za-z0-9_.-]*):(?:\s+(.*)|)$/.exec(cont.content);
        if (!contMatch)
          break;
        const contKey = unquote(contMatch[1]);
        const contValue = contMatch[2] ?? "";
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
    const folded = foldContinuations(lines, i + 1, indent, parseScalar(rest));
    arr.push(folded.value);
    i = folded.next;
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
    events: asStrings(record?.wireThroughEvents ?? record?.wire_through_events ?? record?.events),
    compatiblePrimitives: asStrings(record?.compatiblePrimitives ?? record?.compatible_primitives),
    conflictsWith: asStrings(record?.conflictsWith ?? record?.conflicts_with)
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
      const full = join5(current, entry);
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
      if (!ids.has(conflict))
        unresolved.push(`${record.id} conflicts with unknown primitive "${conflict}"`);
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
  return join5(options.projectRoot, "xdomains", "game-dev", "unity-3d", "primitives");
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

// tools/unity/unity-compose/src/test-plan.ts
import { mkdirSync as mkdirSync4, writeFileSync as writeFileSync4 } from "node:fs";
import { join as join6 } from "node:path";

// tools/shared/text.ts
function canonicalizeText(text) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

// tools/unity/unity-compose/src/test-plan.ts
var TEST_PLAN_DIR = "test-plans";
var TEST_PLAN_SCHEMA_VERSION = 1;
function testPlansDir(options) {
  return join6(options.opencodeDir, TEST_PLAN_DIR);
}
function testPlanPath(options, slug) {
  return join6(testPlansDir(options), `${slug}.md`);
}
function commandsDir(options) {
  return options.commandsDir ?? options.capabilitiesDir ?? defaultCapabilitiesDir(options);
}
function primitivesDir(options) {
  return options.primitivesDir ?? defaultPrimitivesDir(options);
}
function resolveFeatureAbilities(options) {
  if (options.planAbilities && options.planAbilities.length > 0) {
    return { abilities: options.planAbilities, error: null };
  }
  return { abilities: [], error: "no --abilities supplied (comma-separated capability or primitive ids)" };
}
function yamlStringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
function readCapabilitySection(options, ability) {
  const commandPath = join6(commandsDir(options), `${ability}.md`);
  const commandText = readText(commandPath);
  if (commandText !== null) {
    const frontmatter = parseFrontmatter(commandText);
    const steps = frontmatterStringArray(frontmatter, "testPlan") ?? [];
    return {
      ability,
      id: frontmatterString(frontmatter, "id") ?? ability,
      summary: frontmatterString(frontmatter, "summary") ?? null,
      steps: [...steps],
      problems: steps.length === 0 ? ["no testPlan declared in the capability contract"] : []
    };
  }
  const primitivePath = join6(primitivesDir(options), ability, "primitive.yaml");
  const primitiveText = readText(primitivePath);
  if (primitiveText !== null) {
    const data = asRecord(parseYaml(primitiveText));
    const steps = yamlStringArray(data?.testPlan ?? data?.test_plan);
    return {
      ability,
      id: typeof data?.id === "string" ? data.id : ability,
      summary: typeof data?.summary === "string" ? data.summary : null,
      steps,
      problems: steps.length === 0 ? ["no testPlan declared in the primitive contract"] : []
    };
  }
  return {
    ability,
    id: null,
    summary: null,
    steps: [],
    problems: [`capability not found at ${toPosix(commandPath)} or ${toPosix(primitivePath)}`]
  };
}
function renderTestPlan(artifact) {
  const lines = [
    `# Test Plan: ${artifact.feature}`,
    "",
    "Generated from the capability contract `testPlan` fields — the contract is the single source of truth."
  ];
  for (const section of artifact.sections) {
    lines.push("", `## ${section.ability}`, "");
    lines.push(section.summary ?? "_No summary declared._");
    if (section.steps.length > 0) {
      lines.push("");
      for (const step of section.steps)
        lines.push(`- [ ] ${step}`);
    }
    for (const problem of section.problems)
      lines.push("", `> Problem: ${problem}`);
  }
  if (artifact.duplicateSteps.length > 0) {
    lines.push("", "## Duplicate Steps Dropped", "");
    lines.push("Declared by more than one capability; shown once in the checklist above:");
    for (const step of artifact.duplicateSteps)
      lines.push(`- ${step}`);
  }
  lines.push("");
  return lines.join(`
`);
}
function runTestPlan(options) {
  const slug = (options.feature ?? "").trim();
  const target = slug ? toPosix(testPlanPath(options, slug)) : toPosix(testPlansDir(options));
  const refuse = (message) => {
    const base = makeResult("test-plan", "refused", message, [message], { writesState: true });
    return {
      ...base,
      action: "refuse",
      feature: slug || null,
      planPath: target,
      written: false,
      sections: 0,
      checklist: 0,
      problems: [message]
    };
  };
  if (!slug)
    return refuse("a --feature <slug> is required");
  if (!isValidSlug(slug))
    return refuse(`invalid feature slug "${slug}"; use kebab-case (a-z, 0-9, -)`);
  const resolved = resolveFeatureAbilities(options);
  if (resolved.error)
    return refuse(resolved.error);
  if (resolved.abilities.length === 0)
    return refuse(`no abilities resolved for feature "${slug}"`);
  const sections = resolved.abilities.map((ability) => readCapabilitySection(options, ability));
  const seen = new Set;
  const checklist = [];
  const duplicateSteps = [];
  for (const section of sections) {
    const kept = [];
    for (const step of section.steps) {
      const key = canonicalizeText(step);
      if (seen.has(key)) {
        duplicateSteps.push(step);
        continue;
      }
      seen.add(key);
      kept.push(step);
      checklist.push(step);
    }
    section.steps = kept;
  }
  const problems = sections.flatMap((section) => section.problems.map((problem) => `${section.ability}: ${problem}`));
  const artifact = {
    schemaVersion: TEST_PLAN_SCHEMA_VERSION,
    generatedAt: nowIso(),
    feature: slug,
    abilities: resolved.abilities,
    sections,
    checklist,
    duplicateSteps,
    problems
  };
  const path = testPlanPath(options, slug);
  mkdirSync4(testPlansDir(options), { recursive: true });
  writeFileSync4(path, renderTestPlan(artifact));
  const status = problems.length > 0 ? "observed_locally" : "ok";
  const summary = `wrote test plan for "${slug}" (${sections.length} capability section(s), ${checklist.length} checklist step(s))`;
  const base = makeResult("test-plan", status, summary, problems, { writesState: true });
  return {
    ...base,
    action: "write",
    feature: slug,
    planPath: toPosix(path),
    written: true,
    sections: sections.length,
    checklist: checklist.length,
    problems
  };
}

// tools/unity/unity-compose/src/workflow-catalog.ts
import { existsSync as existsSync2, readdirSync as readdirSync4 } from "node:fs";
import { basename as basename3, join as join8 } from "node:path";

// tools/unity/unity-compose/src/recipes.ts
import { readdirSync as readdirSync3, statSync as statSync4 } from "node:fs";
import { join as join7, relative } from "node:path";
var RECIPE_SCHEMA_VERSION = 1;
var RECIPE_ID_PATTERN = "^[a-z0-9]+(?:-[a-z0-9]+)*$";
var RECIPE_PHASE_TYPES = ["serial", "parallel"];
var RECIPE_STEP_KINDS = ["agent", "manual", "command", "cli", "ability", "report"];
var RECIPE_PHASE_KEYS = ["id", "type", "description", "dependsOn", "steps"];
var RECIPE_STEP_KEYS = [
  "id",
  "kind",
  "description",
  "command",
  "abilities",
  "agents",
  "gates",
  "artifact"
];
var RECIPE_ARTIFACT_KEYS = ["glob", "pattern", "minCount", "note"];
var RECIPE_REQUIRED_FIELDS = ["schemaVersion", "id", "name", "description", "version", "phases"];
var PHASE_REQUIRED_FIELDS = ["id", "type", "description", "steps"];
var STEP_REQUIRED_FIELDS = ["id", "kind", "description"];
function isMissing2(value) {
  if (value === undefined || value === null)
    return true;
  if (typeof value === "string" && value.trim() === "")
    return true;
  if (Array.isArray(value) && value.length === 0)
    return true;
  return false;
}
function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
function requireFields(record, label, fields, errors) {
  const prefix = label ? `${label} ` : "";
  for (const key of fields) {
    if (isMissing2(record[key]))
      errors.push(`${prefix}missing required field: ${key}`);
  }
}
function validateUniqueId(id, seen, errors, kind, where) {
  if (!id)
    return;
  if (seen.has(id))
    errors.push(where ? `duplicate ${kind} id "${id}" in ${where}` : `duplicate ${kind} id "${id}"`);
  seen.add(id);
}
function rejectUnknownKeys(record, label, allowed, errors) {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key))
      errors.push(`${label} has unknown key "${key}"`);
  }
}
function validateArtifact(value, label, errors) {
  if (value === undefined)
    return;
  const artifact = asRecord(value);
  if (!artifact) {
    errors.push(`${label} artifact must be an object`);
    return;
  }
  rejectUnknownKeys(artifact, `${label} artifact`, RECIPE_ARTIFACT_KEYS, errors);
  if (artifact.glob === undefined && artifact.note === undefined) {
    errors.push(`${label} artifact must declare "glob" (machine-evaluable) or "note" (fallback)`);
  }
  if (artifact.glob !== undefined && artifact.note !== undefined) {
    errors.push(`${label} artifact must not combine "glob" (machine-evaluable) with "note" (fallback)`);
  }
  if (artifact.glob !== undefined && (typeof artifact.glob !== "string" || artifact.glob.trim() === "")) {
    errors.push(`${label} artifact.glob must be a non-empty string`);
  }
  if (artifact.pattern !== undefined && typeof artifact.pattern !== "string") {
    errors.push(`${label} artifact.pattern must be a string`);
  }
  if (artifact.note !== undefined && typeof artifact.note !== "string") {
    errors.push(`${label} artifact.note must be a string`);
  }
  if (artifact.minCount !== undefined && (!Number.isInteger(artifact.minCount) || artifact.minCount < 1)) {
    errors.push(`${label} artifact.minCount must be a positive integer`);
  }
  if ((artifact.pattern !== undefined || artifact.minCount !== undefined) && artifact.glob === undefined) {
    errors.push(`${label} artifact.pattern/minCount require artifact.glob`);
  }
}
function validateRecipe(data) {
  const errors = [];
  const root = asRecord(data);
  if (!root)
    return { ok: false, errors: ["recipe must be a JSON object"] };
  requireFields(root, "", RECIPE_REQUIRED_FIELDS, errors);
  if (root.schemaVersion !== undefined && root.schemaVersion !== RECIPE_SCHEMA_VERSION) {
    errors.push(`unsupported schemaVersion: expected ${RECIPE_SCHEMA_VERSION}, got ${JSON.stringify(root.schemaVersion)}`);
  }
  if (root.id !== undefined && (typeof root.id !== "string" || !new RegExp(RECIPE_ID_PATTERN).test(root.id))) {
    errors.push(`invalid id: expected kebab-case matching ${RECIPE_ID_PATTERN}, got ${JSON.stringify(root.id)}`);
  }
  if (root.version !== undefined && (typeof root.version !== "string" || !/^\d+\.\d+\.\d+$/.test(root.version))) {
    errors.push(`invalid version: expected MAJOR.MINOR.PATCH, got ${JSON.stringify(root.version)}`);
  }
  const phases = root.phases;
  if (phases === undefined)
    return { ok: errors.length === 0, errors };
  if (!Array.isArray(phases)) {
    errors.push("invalid phases: expected array");
    return { ok: false, errors };
  }
  const phaseIds = new Set;
  phases.forEach((phaseRaw, i) => {
    const where = `phase[${i}]`;
    const phase = asRecord(phaseRaw);
    if (!phase) {
      errors.push(`${where} must be an object`);
      return;
    }
    const id = typeof phase.id === "string" ? phase.id : null;
    const label = id ? `phase "${id}"` : where;
    requireFields(phase, label, PHASE_REQUIRED_FIELDS, errors);
    validateUniqueId(id, phaseIds, errors, "phase");
    rejectUnknownKeys(phase, label, RECIPE_PHASE_KEYS, errors);
    if (phase.type !== undefined && !RECIPE_PHASE_TYPES.includes(phase.type)) {
      errors.push(`${label} has unknown type ${JSON.stringify(phase.type)}: expected one of ${RECIPE_PHASE_TYPES.join("|")}`);
    }
    if (phase.dependsOn !== undefined && !isStringArray(phase.dependsOn)) {
      errors.push(`${label} dependsOn must be an array of phase ids`);
    }
    if (phase.steps === undefined)
      return;
    if (!Array.isArray(phase.steps)) {
      errors.push(`${label} steps must be an array`);
      return;
    }
    const stepIds = new Set;
    phase.steps.forEach((stepRaw, j) => {
      const step = asRecord(stepRaw);
      if (!step) {
        errors.push(`${label} step[${j}] must be an object`);
        return;
      }
      const stepId = typeof step.id === "string" ? step.id : null;
      const stepLabel = stepId ? `${label} step "${stepId}"` : `${label} step[${j}]`;
      requireFields(step, stepLabel, STEP_REQUIRED_FIELDS, errors);
      validateUniqueId(stepId, stepIds, errors, "step", label);
      rejectUnknownKeys(step, stepLabel, RECIPE_STEP_KEYS, errors);
      if (step.kind !== undefined && !RECIPE_STEP_KINDS.includes(step.kind)) {
        errors.push(`${stepLabel} has unknown kind ${JSON.stringify(step.kind)}: expected one of ${RECIPE_STEP_KINDS.join("|")}`);
      }
      if (step.command !== undefined && typeof step.command !== "string")
        errors.push(`${stepLabel} command must be a string`);
      for (const key of ["abilities", "agents", "gates"]) {
        if (step[key] !== undefined && !isStringArray(step[key]))
          errors.push(`${stepLabel} ${key} must be an array of strings`);
      }
      validateArtifact(step.artifact, stepLabel, errors);
    });
  });
  phases.forEach((phaseRaw, i) => {
    const phase = asRecord(phaseRaw);
    if (!phase || !isStringArray(phase.dependsOn))
      return;
    const id = typeof phase.id === "string" ? phase.id : `phase[${i}]`;
    for (const dependency of phase.dependsOn) {
      if (!phaseIds.has(dependency))
        errors.push(`phase "${id}" dependsOn unknown phase "${dependency}"`);
    }
  });
  return { ok: errors.length === 0, errors };
}
function globToRegExp(pattern) {
  let source = "";
  for (let i = 0;i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === "*") {
      if (pattern[i + 1] === "*") {
        i += 1;
        if (pattern[i + 1] === "/") {
          i += 1;
          source += "(?:.*/)?";
        } else {
          source += ".*";
        }
      } else {
        source += "[^/]*";
      }
    } else if (char === "?") {
      source += "[^/]";
    } else if (".+^${}()|[]\\".includes(char)) {
      source += `\\${char}`;
    } else {
      source += char;
    }
  }
  return new RegExp(`^${source}$`);
}
function literalBase(pattern) {
  const firstWildcard = pattern.search(/[*?]/);
  const prefix = firstWildcard === -1 ? pattern : pattern.slice(0, firstWildcard);
  const slash = prefix.lastIndexOf("/");
  return slash === -1 ? "" : prefix.slice(0, slash);
}
var MAX_GLOB_MATCHES = 20000;
function makeProjectGlob(projectRoot) {
  return (pattern, { cwd }) => {
    const root = cwd || projectRoot;
    const base = literalBase(toPosix(pattern));
    const baseDir = base ? join7(root, base) : root;
    if (!dirExists(baseDir))
      return [];
    const matcher = globToRegExp(toPosix(pattern));
    const matches = [];
    const walk = (dir) => {
      let entries;
      try {
        entries = readdirSync3(dir);
      } catch {
        return;
      }
      for (const entry of entries) {
        if (matches.length >= MAX_GLOB_MATCHES)
          return;
        const full = join7(dir, entry);
        let directory = false;
        try {
          directory = statSync4(full).isDirectory();
        } catch {
          continue;
        }
        if (directory) {
          walk(full);
          continue;
        }
        const rel = toPosix(relative(root, full));
        if (matcher.test(rel))
          matches.push(rel);
      }
    };
    walk(baseDir);
    return matches;
  };
}
function evaluateArtifactCheck(check, context) {
  if (!check || typeof check.glob !== "string" || check.glob.trim() === "")
    return "undetectable";
  const glob = context.glob ?? makeProjectGlob(context.projectRoot);
  let matches;
  try {
    matches = glob(check.glob, { cwd: context.projectRoot });
  } catch {
    return "undetectable";
  }
  if (!Array.isArray(matches))
    return "undetectable";
  const minCount = typeof check.minCount === "number" && Number.isInteger(check.minCount) && check.minCount > 0 ? check.minCount : 1;
  if (typeof check.pattern !== "string" || check.pattern === "") {
    return matches.length >= minCount ? "met" : "unmet";
  }
  let matcher;
  try {
    matcher = new RegExp(check.pattern);
  } catch {
    return "undetectable";
  }
  const readFile = context.readFile ?? ((path) => readText(join7(context.projectRoot, path)));
  let satisfied = 0;
  for (const file of matches) {
    let content;
    try {
      content = readFile(file);
    } catch {
      return "undetectable";
    }
    if (typeof content === "string" && matcher.test(content))
      satisfied += 1;
  }
  return satisfied >= minCount ? "met" : "unmet";
}

// tools/unity/unity-compose/src/workflow-catalog.ts
var CATALOG_SCHEMA_VERSION = 1;
var CATALOG_REQUIRED_FIELDS = ["schemaVersion", "id", "name", "description", "phases"];
var CATALOG_PHASE_REQUIRED_FIELDS = ["id", "label", "description", "steps"];
var CATALOG_STEP_REQUIRED_FIELDS = ["id", "name", "command", "description"];
function validateWorkflowCatalog(data) {
  const errors = [];
  const root = asRecord(data);
  if (!root)
    return { ok: false, errors: ["workflow catalog must be a JSON object"] };
  requireFields(root, "", CATALOG_REQUIRED_FIELDS, errors);
  if (root.schemaVersion !== undefined && root.schemaVersion !== CATALOG_SCHEMA_VERSION) {
    errors.push(`unsupported schemaVersion: expected ${CATALOG_SCHEMA_VERSION}, got ${JSON.stringify(root.schemaVersion)}`);
  }
  const phases = root.phases;
  if (phases === undefined)
    return { ok: errors.length === 0, errors };
  if (!Array.isArray(phases)) {
    errors.push("invalid phases: expected array");
    return { ok: false, errors };
  }
  const phaseIds = new Set;
  phases.forEach((phaseRaw, i) => {
    const where = `phase[${i}]`;
    const phase = asRecord(phaseRaw);
    if (!phase) {
      errors.push(`${where} must be an object`);
      return;
    }
    const id = typeof phase.id === "string" ? phase.id : null;
    const label = id ? `phase "${id}"` : where;
    requireFields(phase, label, CATALOG_PHASE_REQUIRED_FIELDS, errors);
    validateUniqueId(id, phaseIds, errors, "phase");
    if (phase.nextPhase !== undefined && phase.nextPhase !== null && typeof phase.nextPhase !== "string") {
      errors.push(`${label} nextPhase must be a string or null`);
    }
    if (phase.steps === undefined)
      return;
    if (!Array.isArray(phase.steps)) {
      errors.push(`${label} steps must be an array`);
      return;
    }
    const stepIds = new Set;
    phase.steps.forEach((stepRaw, j) => {
      const step = asRecord(stepRaw);
      if (!step) {
        errors.push(`${label} step[${j}] must be an object`);
        return;
      }
      const stepId = typeof step.id === "string" ? step.id : null;
      const stepLabel = stepId ? `${label} step "${stepId}"` : `${label} step[${j}]`;
      requireFields(step, stepLabel, CATALOG_STEP_REQUIRED_FIELDS, errors);
      if (typeof step.required !== "boolean")
        errors.push(`${stepLabel} missing required field: required`);
      validateUniqueId(stepId, stepIds, errors, "step", label);
      for (const key of ["name", "command", "description"]) {
        if (step[key] !== undefined && typeof step[key] !== "string")
          errors.push(`${stepLabel} ${key} must be a string`);
      }
      if (step.repeatable !== undefined && typeof step.repeatable !== "boolean")
        errors.push(`${stepLabel} repeatable must be a boolean`);
      validateArtifact(step.artifact, stepLabel, errors);
    });
  });
  phases.forEach((phaseRaw, i) => {
    const phase = asRecord(phaseRaw);
    if (!phase)
      return;
    const id = typeof phase.id === "string" ? phase.id : `phase[${i}]`;
    const next = phase.nextPhase;
    if (typeof next !== "string")
      return;
    if (!phaseIds.has(next))
      errors.push(`phase "${id}" nextPhase names unknown phase "${next}"`);
    if (next === phase.id)
      errors.push(`phase "${id}" nextPhase must not reference itself`);
  });
  return { ok: errors.length === 0, errors };
}
function defaultXdomainsPath(options, ...rel) {
  const installed = join8(options.opencodeDir, "xdomains", ...rel);
  return existsSync2(installed) ? installed : join8(options.projectRoot, "xdomains", ...rel);
}
function defaultCatalogPath(options) {
  return defaultXdomainsPath(options, "context", "workflow-catalog.json");
}
function defaultRecipesDir(options) {
  return defaultXdomainsPath(options, "game-dev", "unity-3d", "recipes");
}
function readRecipes(dir) {
  let entries;
  try {
    entries = readdirSync4(dir);
  } catch {
    return [];
  }
  return entries.filter((entry) => entry.endsWith(".json")).sort().map((entry) => {
    const path = join8(dir, entry);
    const data = readJson(path);
    const record = asRecord(data);
    const id = typeof record?.id === "string" ? record.id : basename3(entry, ".json");
    if (data === null)
      return { id, path: toPosix(path), valid: false, errors: [`unreadable recipe: ${toPosix(path)}`] };
    const validation = validateRecipe(data);
    return { id, path: toPosix(path), valid: validation.ok, errors: validation.errors };
  });
}
function evaluatePhases(catalog, projectRoot) {
  return catalog.phases.map((phase) => {
    const steps = phase.steps.map((step) => {
      const outcome = step.artifact ? evaluateArtifactCheck(step.artifact, { projectRoot }) : "undetectable";
      return {
        id: step.id,
        name: step.name,
        command: step.command,
        required: step.required,
        outcome,
        blocking: step.required && outcome !== "met"
      };
    });
    const complete = steps.every((step) => !step.blocking);
    return { id: phase.id, label: phase.label, nextPhase: phase.nextPhase, complete, steps };
  });
}
function firstBlocking(phases) {
  for (const phase of phases) {
    for (const step of phase.steps) {
      if (step.blocking)
        return { phaseId: phase.id, step };
    }
  }
  return null;
}
function runWorkflowCatalog(options) {
  const catalogPath = options.catalog ?? defaultCatalogPath(options);
  const recipesDir = options.recipesDir ?? defaultRecipesDir(options);
  const recipes = readRecipes(recipesDir);
  const base = { catalogPath: toPosix(catalogPath), recipesDir: toPosix(recipesDir), recipes };
  const raw = readJson(catalogPath);
  if (raw === null) {
    const result = makeResult("workflow-catalog", "unavailable", `no workflow catalog at ${toPosix(catalogPath)}`, []);
    return { ...result, ...base, catalogValid: false, catalogErrors: [], phases: [], currentPhase: null, nextCommand: null, nextStepId: null };
  }
  const validation = validateWorkflowCatalog(raw);
  if (!validation.ok) {
    const result = makeResult("workflow-catalog", "observed_locally", `workflow catalog invalid: ${validation.errors.length} error(s)`, validation.errors);
    return { ...result, ...base, catalogValid: false, catalogErrors: validation.errors, phases: [], currentPhase: null, nextCommand: null, nextStepId: null };
  }
  const catalog = raw;
  const phases = evaluatePhases(catalog, options.projectRoot);
  const blocking = firstBlocking(phases);
  const invalidRecipes = recipes.filter((recipe) => !recipe.valid);
  const status = invalidRecipes.length > 0 ? "observed_locally" : "ok";
  const blockingNote = blocking ? `next: ${blocking.step.command} (required step "${blocking.step.id}" is ${blocking.step.outcome})` : "all machine-checkable phases complete";
  const summary = invalidRecipes.length > 0 ? `catalog valid; ${invalidRecipes.length}/${recipes.length} recipe(s) invalid` : `catalog valid; ${recipes.length} recipe(s) valid; ${blockingNote}`;
  const result = makeResult("workflow-catalog", status, summary, invalidRecipes.flatMap((recipe) => recipe.errors.map((error) => `recipe "${recipe.id}": ${error}`)));
  return {
    ...result,
    ...base,
    catalogValid: true,
    catalogErrors: validation.errors,
    phases,
    currentPhase: blocking?.phaseId ?? null,
    nextCommand: blocking?.step.command ?? null,
    nextStepId: blocking?.step.id ?? null
  };
}

// tools/unity/unity-compose/src/abilities.ts
async function runCompose(options) {
  switch (options.ability) {
    case "coordination-board":
      return runCoordinationBoard(options);
    case "primitive-composition":
      return runPrimitiveComposition(options);
    case "contract-aware-design":
      return runContractAwareDesign(options);
    case "ci-status-baseline":
      return runCiStatusBaseline(options);
    case "plan-feature":
      return runPlanFeature(options);
    case "test-plan":
      return runTestPlan(options);
    case "workflow-catalog":
      return runWorkflowCatalog(options);
    default: {
      const exhaustive = options.ability;
      throw new Error(`unsupported Compose ability: ${String(exhaustive)}`);
    }
  }
}

// tools/unity/unity-compose/src/cli.ts
import { join as join9, resolve } from "node:path";

// tools/shared/cli-args.ts
function isFlag(token) {
  return token.startsWith("--");
}
function parseArgs(argv) {
  const values = {};
  const positional = [];
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (isFlag(arg) && arg.includes("=")) {
      const eq = arg.indexOf("=");
      values[arg.slice(2, eq)] = arg.slice(eq + 1);
      i++;
      continue;
    }
    if (isFlag(arg)) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !isFlag(next)) {
        values[key] = next;
        i += 2;
      } else {
        values[key] = true;
        i++;
      }
      continue;
    }
    positional.push(arg);
    i++;
  }
  return { values, positional };
}
function rejectPositionals(positional) {
  if (positional.length === 0)
    return;
  throw new Error(`unexpected positional argument(s): ${positional.join(" ")}; use --flag value pairs`);
}
function firstString(args, keys) {
  for (const key of keys) {
    const value = args[key];
    if (typeof value === "string" && value.trim() !== "")
      return value;
  }
  return;
}
function parseCommaList(value) {
  if (value === undefined)
    return;
  return value.split(",").map((token) => token.trim()).filter((token) => token !== "");
}
function resolveAbility(requested, abilities, fallback) {
  return abilities.includes(requested) ? requested : fallback;
}
function parseOptionalPositiveInt(value) {
  if (value === undefined || value === null || value === "")
    return;
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0)
    return;
  return Math.floor(parsed);
}

// tools/unity/unity-compose/src/cli.ts
function resolveOptions(argv) {
  const { values: args, positional } = parseArgs(argv);
  rejectPositionals(positional);
  const projectRoot = resolve(String(args["project-root"] || process.cwd()));
  const opencodeDir = resolve(String(args["opencode-dir"] || join9(projectRoot, ".opencode")));
  const requested = String(args.ability || "coordination-board");
  const ability = resolveAbility(requested, COMPOSE_ABILITIES, "coordination-board");
  const leaseRaw = args["lease-seconds"] ?? args.leaseSeconds;
  const waitRaw = args["wait-seconds"] ?? args.waitSeconds;
  const planAbilities = parseCommaList(firstString(args, ["abilities", "plan-abilities", "planAbilities"]));
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
    leaseSeconds: parseOptionalPositiveInt(leaseRaw),
    waitSeconds: parseOptionalPositiveInt(waitRaw),
    now: firstString(args, ["now"]),
    primitivesDir: firstString(args, ["primitives-dir", "primitivesDir"]),
    capabilitiesDir: firstString(args, ["capabilities-dir", "capabilitiesDir"]),
    schema: firstString(args, ["schema"]),
    source: firstString(args, ["source"]),
    cliCommand: firstString(args, ["unity-cli", "unityCli"]) ?? "unity",
    feature: firstString(args, ["feature", "slug"]),
    context: firstString(args, ["context"]),
    design: firstString(args, ["design"]),
    testCases: firstString(args, ["test-cases", "testCases"]),
    testingDecisions: firstString(args, ["testing-decisions", "testingDecisions"]),
    testability: firstString(args, ["testability"]),
    tradeOffs: firstString(args, ["trade-offs", "tradeOffs"]),
    planAbilities,
    commandsDir: firstString(args, ["commands-dir", "commandsDir"]),
    catalog: firstString(args, ["catalog"]),
    recipesDir: firstString(args, ["recipes-dir", "recipesDir"])
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
  if ("checklist" in result && "planPath" in result) {
    lines.push(`  action: ${result.action} · feature: ${result.feature ?? "n/a"} · sections: ${result.sections} · checklist: ${result.checklist} · written: ${result.written}`);
    for (const problem of result.problems)
      lines.push(`  problem: ${problem}`);
  }
  if ("planPath" in result && "testability" in result) {
    lines.push(`  action: ${result.action} · feature: ${result.feature ?? "n/a"} · testability: ${result.testability ?? "n/a"} · written: ${result.written}`);
    if (result.instruction)
      lines.push(`  instruction: ${result.instruction}`);
  }
  if ("phases" in result && "catalogValid" in result) {
    const valid = result.recipes.filter((recipe) => recipe.valid).length;
    lines.push(`  catalog: ${result.catalogPath} · valid: ${result.catalogValid} · recipes: ${valid}/${result.recipes.length}`);
    for (const phase of result.phases) {
      const met = phase.steps.filter((step) => step.outcome === "met").length;
      lines.push(`  phase ${phase.id}: ${met}/${phase.steps.length} met${phase.complete ? " · complete" : ""}`);
      for (const step of phase.steps) {
        if (step.outcome === "unmet")
          lines.push(`    unmet ${step.id} -> ${step.command}`);
      }
    }
    if (result.nextCommand)
      lines.push(`  next: ${result.nextCommand} (${result.currentPhase ?? "n/a"})`);
  }
  for (const error of result.errors)
    lines.push(`  error: ${error}`);
  return lines.join(`
`);
}
runCli({ abilities: COMPOSE_ABILITIES, resolveOptions, run: runCompose, render });
