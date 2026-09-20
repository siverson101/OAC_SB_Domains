// tools/shared/cli-bootstrap.ts
function isThenable(value) {
  return typeof value?.then === "function";
}
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
  const emit = (result) => {
    if (options.json) {
      write(JSON.stringify(result, null, 2) + `
`);
      return;
    }
    write(config.render(result) + `
`);
  };
  const result = config.run(options);
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

// tools/unity/unity-verify/src/abilities.ts
import { join as join6 } from "node:path";

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

// tools/shared/toolchain.ts
import { spawnSync } from "node:child_process";
function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    cwd: opts.cwd,
    encoding: "utf8",
    timeout: opts.timeout ?? 20000,
    windowsHide: true
  });
  return {
    ok: res.status === 0,
    stdout: (res.stdout ?? "").trim(),
    stderr: (res.stderr ?? "").trim(),
    status: res.status
  };
}
function findExecutable(name) {
  const finder = process.platform === "win32" ? "where" : "which";
  const res = run(finder, [name]);
  if (!res.ok || !res.stdout)
    return null;
  return res.stdout.split(/\r?\n/)[0]?.trim() || null;
}

// tools/shared/tool-routing.ts
function liveAvailable(channel) {
  if (!channel)
    return false;
  try {
    return channel.available() === true;
  } catch {
    return false;
  }
}
function selectRoute(caps) {
  if (caps.localOnly) {
    return { route: "local", reason: "local-only capability; plain filesystem/process work" };
  }
  if (liveAvailable(caps.live) && caps.live) {
    return {
      route: "live",
      reason: `Unity CLI ${caps.live.transport} channel available; live Editor`,
      transport: caps.live.transport
    };
  }
  if (caps.cliAvailable) {
    return { route: "batch", reason: "Unity CLI available; batch execution" };
  }
  return { route: "offline", reason: "no Unity CLI live channel; on-disk readers" };
}

// tools/unity/gather-unity-context/src/producers.ts
function runCli2(cliCommand, args, timeout = 30000) {
  const res = run(cliCommand, args, { timeout });
  let parsed = null;
  try {
    parsed = JSON.parse(res.stdout);
  } catch {
    parsed = null;
  }
  return {
    success: parsed?.success === true && res.ok,
    command: parsed?.command,
    route: selectRoute({ live: null, cliAvailable: parsed != null }).route,
    data: parsed?.data ?? null,
    errors: parsed?.errors ?? (res.ok ? [] : [{ message: res.stderr || res.stdout || `exit ${res.status}` }]),
    warnings: parsed?.warnings ?? [],
    raw: res.stdout || res.stderr
  };
}

// tools/unity/gather-unity-context/src/editor.ts
function findLiveInstance(projectRoot, cliCommand) {
  const env = runCli2(cliCommand, [
    "status",
    "--json",
    "--no-banner",
    "--quiet",
    "--non-interactive",
    "--project-path",
    projectRoot
  ]);
  const instances = env.data?.instances ?? [];
  return instances.find((i) => (i.project ?? "").toLowerCase() === projectRoot.toLowerCase()) ?? null;
}

// tools/unity/gather-unity-context/src/gate.ts
import { join as join2 } from "node:path";

// tools/unity/gather-unity-context/src/scratch.ts
import { existsSync as existsSync2, mkdirSync as mkdirSync2, rmSync, writeFileSync as writeFileSync2 } from "node:fs";
import { join } from "node:path";
function scratchPath(dir, name) {
  return join(dir, name);
}
function writeScratchJson(dir, name, value) {
  const path = scratchPath(dir, name);
  writeFileSync2(path, JSON.stringify(value, null, 2) + `
`);
  return path;
}

// tools/unity/gather-unity-context/src/gate.ts
var EMPTY_COUNTS = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  inconclusive: 0,
  result: "Unknown"
};
function parseNUnit(xml) {
  const match = /<test-run\b[^>]*>/.exec(xml);
  if (!match)
    return { ...EMPTY_COUNTS };
  const attr = (name) => {
    const m = new RegExp(`${name}="(\\d+)"`).exec(match[0]);
    return m ? Number(m[1]) : 0;
  };
  const resultMatch = /result="([^"]+)"/.exec(match[0]);
  return {
    total: attr("total"),
    passed: attr("passed"),
    failed: attr("failed"),
    skipped: attr("skipped"),
    inconclusive: attr("inconclusive"),
    result: resultMatch ? resultMatch[1] : "Unknown"
  };
}
function runLiveTest(options, mode) {
  const env = runCli2(options.cliCommand, [
    "command",
    "run_tests",
    "--mode",
    mode,
    "--json",
    "--no-banner",
    "--quiet",
    "--non-interactive",
    "--project-path",
    options.projectRoot,
    "--timeout",
    "600"
  ], 900000);
  const artifact = writeScratchJson(options.scratchDir, `run-tests-${mode}.json`, env);
  const summary = env.data?.result?.Summary;
  const counts = summary ? {
    total: summary.Total ?? 0,
    passed: summary.Passed ?? 0,
    failed: summary.Failed ?? 0,
    skipped: summary.Skipped ?? 0,
    inconclusive: summary.Inconclusive ?? 0,
    result: (summary.Failed ?? 0) > 0 ? "Failed" : "Passed"
  } : { ...EMPTY_COUNTS };
  return {
    mode,
    source: "live-editor",
    status: env.success && counts.failed === 0 ? "passed" : "failed",
    exitCode: null,
    counts,
    artifact
  };
}
function runBatchTest(options, mode) {
  const output = join2(options.scratchDir, `${mode.toLowerCase()}-results.xml`);
  const res = run(options.cliCommand, ["test", options.projectRoot, "--mode", mode, "--output", output, "--no-banner", "--quiet", "--non-interactive"], { timeout: 900000 });
  const counts = parseNUnit(readText(output) ?? "");
  return {
    mode,
    source: "batch-editor",
    status: res.ok && counts.failed === 0 ? "passed" : "failed",
    exitCode: res.status,
    counts,
    artifact: output
  };
}
function runTestMode(options, mode, instance) {
  if (instance)
    return runLiveTest(options, mode);
  return runBatchTest(options, mode === "editor" ? "EditMode" : "PlayMode");
}

// tools/unity/unity-verify/src/checkpoint.ts
import { join as join5 } from "node:path";

// tools/unity/gather-unity-context/src/offline.ts
import { readdirSync, statSync as statSync2 } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname as dirname2, isAbsolute, join as join3, relative } from "node:path";
var OFFLINE_ROUTE = selectRoute({ live: null, cliAvailable: false }).route;
function makeBase(status, errors = []) {
  return { schemaVersion: 1, generatedAt: nowIso(), status, route: OFFLINE_ROUTE, errors };
}
function errMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function statInfo(path) {
  try {
    const st = statSync2(path);
    return { mtimeUtc: new Date(st.mtimeMs).toISOString(), sizeBytes: st.size };
  } catch {
    return null;
  }
}
var WALK_EXCLUDES = new Set([
  "library",
  "temp",
  "obj",
  "logs",
  "build",
  "builds",
  "usersettings",
  "node_modules",
  ".git",
  ".vs",
  ".idea",
  "bin"
]);
function walkFiles(root, match, maxDepth = 16) {
  const out = [];
  const walk = (dir, depth) => {
    if (depth > maxDepth)
      return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join3(dir, entry.name);
      if (entry.isDirectory()) {
        if (WALK_EXCLUDES.has(entry.name.toLowerCase()))
          continue;
        walk(full, depth + 1);
        continue;
      }
      if (entry.isFile() && match(entry.name, full))
        out.push(full);
    }
  };
  walk(root, 0);
  return out;
}
function editorLogPaths() {
  const home = homedir();
  if (process.platform === "win32") {
    const local = process.env.LOCALAPPDATA || join3(home, "AppData", "Local");
    return [
      join3(local, "Unity", "Editor", "Editor.log"),
      join3(local, "Unity", "Editor", "Editor-prev.log")
    ];
  }
  if (process.platform === "darwin") {
    return [
      join3(home, "Library", "Logs", "Unity", "Editor.log"),
      join3(home, "Library", "Logs", "Unity", "Editor-prev.log")
    ];
  }
  return [
    join3(home, ".config", "unity3d", "Editor.log"),
    join3(home, ".config", "unity3d", "Editor-prev.log")
  ];
}
function readEditorLogAuthorship(logPaths) {
  for (const logPath of logPaths) {
    const info = statInfo(logPath);
    const text = readText(logPath);
    if (!info && !text)
      continue;
    const versionMatch = text?.match(/Initialize engine version:\s*([^\s(]+)/) ?? text?.match(/(\d{4}\.\d+\.\d+[abfp]\d+)/);
    const compileLines = (text ?? "").split(/\r?\n/).filter((line) => /script compilation|finished compiling|compilation took|begin monomanager reloadassembly/i.test(line));
    return {
      logPath: toPosix(logPath),
      mtimeUtc: info?.mtimeUtc ?? null,
      editorVersion: versionMatch ? versionMatch[1] : null,
      lastCompileLine: compileLines.length > 0 ? compileLines[compileLines.length - 1].trim() : null
    };
  }
  return null;
}
function produceCompileState(input, logPaths = editorLogPaths()) {
  const errors = [];
  const assembliesDir = join3(input.projectRoot, "Library", "ScriptAssemblies");
  const libraryPresent = dirExists(assembliesDir);
  const assemblies = [];
  if (libraryPresent) {
    let names = [];
    try {
      names = readdirSync(assembliesDir);
    } catch (error) {
      errors.push(errMessage(error));
    }
    for (const name of names) {
      if (!name.toLowerCase().endsWith(".dll"))
        continue;
      const full = join3(assembliesDir, name);
      const info = statInfo(full);
      if (!info)
        continue;
      assemblies.push({ name, path: toPosix(relative(input.projectRoot, full)), ...info });
    }
  }
  assemblies.sort((a, b) => b.mtimeUtc.localeCompare(a.mtimeUtc));
  const newestAssembly = assemblies[0] ? { name: assemblies[0].name, mtimeUtc: assemblies[0].mtimeUtc } : null;
  let newestScript = null;
  for (const full of walkFiles(input.assetFolder, (name) => name.toLowerCase().endsWith(".cs"))) {
    const info = statInfo(full);
    if (!info)
      continue;
    if (!newestScript || info.mtimeUtc > newestScript.mtimeUtc) {
      newestScript = { path: toPosix(relative(input.projectRoot, full)), mtimeUtc: info.mtimeUtc };
    }
  }
  const editorLogAuthorship = readEditorLogAuthorship(logPaths);
  const recentCompile = editorLogAuthorship?.lastCompileLine != null;
  let stale = null;
  let staleReason = null;
  let noOpRecompile = null;
  if (newestAssembly && newestScript) {
    stale = newestScript.mtimeUtc > newestAssembly.mtimeUtc;
    noOpRecompile = stale && recentCompile ? true : null;
  } else if (!newestAssembly && newestScript) {
    stale = true;
  } else if (newestAssembly && !newestScript) {
    staleReason = "no .cs script evidence under Assets; staleness not determinable";
  } else {
    staleReason = "no assemblies and no script evidence; staleness not determinable";
  }
  const status = libraryPresent ? "observed_locally" : "unavailable";
  return {
    ...makeBase(status, errors),
    libraryPresent,
    scriptAssembliesDir: "Library/ScriptAssemblies",
    assemblyCount: assemblies.length,
    assemblies,
    newestAssembly,
    newestScript,
    stale,
    staleReason,
    noOpRecompile,
    editorLogAuthorship
  };
}
function classifyLogLine(line) {
  if (/\berror\s+(CS|BC|IDE)\d+/i.test(line))
    return "error";
  if (/\[error\]/i.test(line))
    return "error";
  if (/\berror\b\s*[:=]/i.test(line))
    return "error";
  if (/\bexception\b/i.test(line) && !/\bcaught\b/i.test(line))
    return "error";
  if (/\bwarning\s+(CS|BC|IDE)\d+/i.test(line))
    return "warning";
  if (/\[warning\]/i.test(line))
    return "warning";
  if (/\bwarning\b\s*[:=]/i.test(line))
    return "warning";
  return null;
}
function pushCapped(list, item, cap) {
  list.push(item);
  if (list.length > cap)
    list.shift();
}
function digestLogFile(logPath) {
  const info = statInfo(logPath);
  const text = readText(logPath);
  if (!info && !text)
    return null;
  const lines = text ? text.split(/\r?\n/) : [];
  let errorCount = 0;
  let warningCount = 0;
  const recentErrors = [];
  const recentWarnings = [];
  lines.forEach((line, index) => {
    const kind = classifyLogLine(line);
    if (!kind)
      return;
    const message = { level: kind, line: index + 1, text: line.trim() };
    if (kind === "error") {
      errorCount++;
      pushCapped(recentErrors, message, 10);
    } else {
      warningCount++;
      pushCapped(recentWarnings, message, 10);
    }
  });
  return {
    path: toPosix(logPath),
    exists: info != null,
    mtimeUtc: info?.mtimeUtc ?? null,
    sizeBytes: info?.sizeBytes ?? null,
    lineCount: lines.length,
    errorCount,
    warningCount,
    recentErrors,
    recentWarnings
  };
}
function produceLogDigest(input, logPaths = editorLogPaths()) {
  const errors = [];
  const logs = [];
  for (const logPath of logPaths) {
    const entry = digestLogFile(logPath);
    if (entry)
      logs.push(entry);
  }
  const errorCount = logs.reduce((sum, log) => sum + log.errorCount, 0);
  const warningCount = logs.reduce((sum, log) => sum + log.warningCount, 0);
  const recentMessages = logs.flatMap((log) => [...log.recentErrors, ...log.recentWarnings]).slice(-20);
  const status = logs.length > 0 ? "observed_locally" : "unavailable";
  return { ...makeBase(status, errors), logCount: logs.length, errorCount, warningCount, logs, recentMessages };
}

// tools/unity/unity-verify/src/types.ts
var VERIFY_ABILITY_NAMES = [
  "compile-and-verify-project",
  "run-edit-mode-tests",
  "run-play-mode-tests",
  "gate-review"
];
var VERIFY_ABILITIES = [...VERIFY_ABILITY_NAMES];
var VERIFY_MODES = {
  "compile-and-verify-project": "both",
  "run-edit-mode-tests": "both",
  "run-play-mode-tests": "both",
  "gate-review": "offline"
};
// tools/shared/json-helpers.ts
function asRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}
function asArray(value) {
  return Array.isArray(value) ? value : [];
}
function str(obj, key) {
  const value = obj?.[key];
  return typeof value === "string" ? value : null;
}
function bool(obj, key) {
  const value = obj?.[key];
  return typeof value === "boolean" ? value : null;
}

// tools/unity/unity-verify/src/shared.ts
import { join as join4 } from "node:path";

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

// tools/unity/unity-verify/src/shared.ts
function projectDataDir(options) {
  return join4(options.opencodeDir, "project-data");
}
function makeResult(ability, status, summary, errors, route, requiresEditor = false) {
  return {
    ...makeEnvelope({ ability, family: "verify", mode: "offline", status, summary, errors, route }),
    safetyGate: { mutates: false, requiresEditor },
    checkpoint: null,
    delta: {
      computed: false,
      newIssues: null,
      resolvedIssues: null,
      validateScanFailed: false,
      compilePending: false,
      reasons: ["no delta computed"]
    }
  };
}
var DEFAULT_COMPILE = {
  status: "observed_locally",
  stale: false,
  noOpRecompile: null,
  assemblyCount: 1,
  newestAssemblyMtimeUtc: null,
  newestScriptMtimeUtc: null
};
function makeSnapshot(overrides = {}) {
  return {
    capturedAt: overrides.capturedAt ?? nowIso(),
    compile: { ...DEFAULT_COMPILE, ...overrides.compile ?? {} },
    issues: overrides.issues ?? [],
    tests: { editMode: null, playMode: null, ...overrides.tests ?? {} },
    gateResult: overrides.gateResult ?? null
  };
}
function issueKey(issue) {
  return `${issue.kind}:${issue.id}`;
}

// tools/unity/unity-verify/src/delta.ts
var MAX_ISSUES = 50;
function normalizeMessage(text) {
  return text.replace(/\s+/g, " ").trim();
}
function pushIssue(issues, seen, issue) {
  if (issues.length >= MAX_ISSUES)
    return;
  const key = issueKey(issue);
  if (seen.has(key))
    return;
  seen.add(key);
  issues.push(issue);
}
function collectIssues(sources) {
  const issues = [];
  const seen = new Set;
  for (const raw of sources.logErrors ?? []) {
    const message = normalizeMessage(raw);
    if (message === "")
      continue;
    pushIssue(issues, seen, { kind: "compile", id: message, message });
  }
  for (const failure of sources.testFailures ?? []) {
    if (failure.count <= 0)
      continue;
    pushIssue(issues, seen, {
      kind: failure.kind,
      id: "failing-tests",
      message: failure.message ?? `${failure.count} failing test(s)`
    });
  }
  return issues;
}
function isCompileUnavailable(compile) {
  if (!compile)
    return true;
  return compile.status === "unavailable";
}
function compilePending(compile) {
  if (!compile || compile.status === "unavailable")
    return false;
  if (compile.stale === true)
    return true;
  if (compile.noOpRecompile === true)
    return true;
  if (compile.assemblyCount === 0)
    return true;
  return false;
}
function computeDelta(before, after, scan = { ok: true }) {
  const reasons = [];
  const validateScanFailed = !scan.ok || after === null || isCompileUnavailable(after?.compile);
  const pending = !validateScanFailed && compilePending(after?.compile);
  if (before === null)
    reasons.push("no checkpoint captured; delta not computed");
  if (after === null)
    reasons.push("no post-mutation scan; delta not computed");
  if (!scan.ok)
    reasons.push(...scan.errors ?? [], "validate scan failed; delta not computed");
  if (after !== null && isCompileUnavailable(after.compile)) {
    reasons.push("compile state unavailable; validate scan could not observe the compiler");
  }
  if (pending) {
    reasons.push("compile pending: assemblies may be stale or the compiler no-op’d; delta not computed");
  }
  const computed = before !== null && after !== null && !validateScanFailed && !pending;
  if (!computed) {
    return {
      computed: false,
      newIssues: null,
      resolvedIssues: null,
      validateScanFailed,
      compilePending: pending,
      reasons
    };
  }
  const beforeKeys = new Set(before.issues.map(issueKey));
  const afterKeys = new Set(after.issues.map(issueKey));
  return {
    computed: true,
    newIssues: after.issues.filter((issue) => !beforeKeys.has(issueKey(issue))),
    resolvedIssues: before.issues.filter((issue) => !afterKeys.has(issueKey(issue))),
    validateScanFailed: false,
    compilePending: false,
    reasons: []
  };
}
function notComputedDelta(reason) {
  return {
    computed: false,
    newIssues: null,
    resolvedIssues: null,
    validateScanFailed: false,
    compilePending: false,
    reasons: [reason]
  };
}

// tools/unity/unity-verify/src/checkpoint.ts
function assetFolderFor(options) {
  const scan = readJson(join5(options.opencodeDir, "project-data", "scan-result.json"));
  return scan?.assetFolder || join5(options.projectRoot, "Assets");
}
function buildSnapshot(sources) {
  const compile = sources.compileState ?? null;
  const logErrors = (sources.logDigest?.logs ?? []).flatMap((log) => log.recentErrors.map((message) => message.text));
  const tests = {
    editMode: sources.testCounts?.editMode ?? null,
    playMode: sources.testCounts?.playMode ?? null
  };
  const testFailures = [];
  if (tests.editMode && tests.editMode.failed > 0) {
    testFailures.push({ kind: "editMode", count: tests.editMode.failed });
  }
  if (tests.playMode && tests.playMode.failed > 0) {
    testFailures.push({ kind: "playMode", count: tests.playMode.failed });
  }
  return makeSnapshot({
    capturedAt: nowIso(),
    compile: {
      status: compile?.status ?? null,
      stale: compile?.stale ?? null,
      noOpRecompile: compile?.noOpRecompile ?? null,
      assemblyCount: compile?.assemblyCount ?? null,
      newestAssemblyMtimeUtc: compile?.newestAssembly?.mtimeUtc ?? null,
      newestScriptMtimeUtc: compile?.newestScript?.mtimeUtc ?? null
    },
    issues: collectIssues({ logErrors, testFailures }),
    tests,
    gateResult: typeof sources.gateState?.gateResult === "string" ? sources.gateState.gateResult : null
  });
}
function captureSnapshot(options) {
  const assetFolder = assetFolderFor(options);
  const input = {
    projectRoot: options.projectRoot,
    assetFolder,
    opencodeDir: options.opencodeDir
  };
  const logPaths = options.logPaths;
  const compileState = logPaths ? produceCompileState(input, logPaths) : produceCompileState(input);
  const logDigest = logPaths ? produceLogDigest(input, logPaths) : produceLogDigest(input);
  const gateState = readJson(join5(options.opencodeDir, "project-data", "gate-state.json"));
  return buildSnapshot({ compileState, logDigest, gateState, testCounts: options.testCounts });
}
function readCheckpoint(options) {
  const stored = readJson(join5(options.opencodeDir, "project-data", "verify", "checkpoint.json"));
  return stored?.snapshot ?? null;
}
function writeCheckpoint(options, snapshot) {
  const path = join5(options.opencodeDir, "project-data", "verify", "checkpoint.json");
  writeJson(path, {
    schemaVersion: 1,
    generatedAt: nowIso(),
    project: options.projectRoot,
    snapshot
  });
  return path;
}

// tools/unity/unity-verify/src/gates.ts
var GATE_ORDER = [
  "compile",
  "editMode",
  "playMode",
  "scene",
  "asset",
  "build",
  "performance",
  "visual"
];
var SEVERITY = {
  failed: 5,
  warning: 4,
  unknown: 3,
  unavailable: 3,
  passed: 2,
  not_run: 1
};
var INTENSITY_GATES = {
  full: GATE_ORDER,
  lean: GATE_ORDER.filter((gate) => gate !== "performance" && gate !== "visual"),
  solo: ["compile", "editMode", "playMode"]
};
function gatesForIntensity(intensity) {
  return INTENSITY_GATES[intensity];
}
function severity(status) {
  return SEVERITY[status] ?? 0;
}
function orderIndex(gate) {
  const index = GATE_ORDER.indexOf(gate);
  return index === -1 ? GATE_ORDER.length : index;
}
function foldGates(entries, intensity = "full") {
  const applicable = gatesForIntensity(intensity);
  const considered = entries.filter((entry) => applicable.includes(entry.gate)).slice().sort((a, b) => orderIndex(a.gate) - orderIndex(b.gate));
  let strictest = null;
  for (const entry of considered) {
    if (!strictest || severity(entry.status) > severity(strictest.status))
      strictest = entry;
  }
  return {
    status: strictest?.status ?? "not_run",
    strictest: strictest?.gate ?? null,
    intensity,
    entries: considered,
    hardFailures: considered.filter((entry) => entry.status === "failed").length,
    reviewRequired: considered.filter((entry) => entry.status === "warning").length
  };
}
function gateStatusFromResult(status) {
  if (status === "passed")
    return "passed";
  if (status === "failed")
    return "failed";
  if (status === "not_run" || status == null)
    return "not_run";
  return "unknown";
}
function compileGate(compileState) {
  const status = str(compileState, "status");
  if (status === "unavailable")
    return { gate: "compile", status: "unavailable", detail: "Library/ScriptAssemblies missing" };
  if (bool(compileState, "stale") === true)
    return { gate: "compile", status: "failed", detail: "scripts newer than assemblies" };
  if (bool(compileState, "noOpRecompile") === true)
    return { gate: "compile", status: "failed", detail: "silent no-op recompile" };
  if (status === "observed_locally")
    return { gate: "compile", status: "passed" };
  return { gate: "compile", status: "unknown" };
}
function visualGate(testInventory) {
  const visual = asRecord(testInventory?.visualVerification);
  if (!visual || bool(visual, "found") !== true)
    return { gate: "visual", status: "not_run" };
  const results = asArray(visual.results).map(asRecord);
  const failed = results.some((result) => (str(result, "status") ?? "").toLowerCase().includes("fail"));
  return failed ? { gate: "visual", status: "failed", detail: "visual verification failures" } : { gate: "visual", status: "passed" };
}
function gateEntriesFromState(sources) {
  const report = sources.verificationReport;
  const results = asRecord(report?.results);
  const editMode = asRecord(results?.editMode);
  const playMode = asRecord(results?.playMode);
  const entries = [
    compileGate(sources.compileState ?? null),
    { gate: "editMode", status: gateStatusFromResult(str(editMode, "status")) },
    { gate: "playMode", status: gateStatusFromResult(str(playMode, "status")) },
    { gate: "scene", status: "not_run" },
    { gate: "asset", status: "not_run" },
    { gate: "build", status: "not_run" },
    { gate: "performance", status: "not_run" },
    visualGate(sources.testInventory ?? null)
  ];
  const overrides = sources.overrides ?? [];
  for (const override of overrides) {
    const index = entries.findIndex((entry) => entry.gate === override.gate);
    if (index === -1)
      entries.push(override);
    else
      entries[index] = override;
  }
  return entries;
}
function parseGateOverrides(json) {
  if (!json)
    return [];
  try {
    const parsed = JSON.parse(json);
    const entries = asArray(parsed).map(asRecord).filter((entry) => entry !== null);
    const out = [];
    for (const entry of entries) {
      const gate = str(entry, "gate");
      const status = str(entry, "status");
      if (!gate || !GATE_ORDER.includes(gate))
        continue;
      if (!status || !(status in SEVERITY))
        continue;
      out.push({ gate, status, detail: str(entry, "detail") ?? undefined });
    }
    return out;
  } catch {
    return [];
  }
}

// tools/unity/unity-verify/src/abilities.ts
function readData(options, file) {
  return readJson(join6(projectDataDir(options), file));
}
function compileAndVerifyProject(options) {
  const snapshot = captureSnapshot(options);
  const base = makeResult(options.ability, "observed_locally", "Compile checkpoint captured from Library/ScriptAssemblies", [], "offline");
  base.mode = VERIFY_MODES[options.ability];
  base.checkpoint = snapshot;
  if (options.phase === "checkpoint") {
    const path = writeCheckpoint(options, snapshot);
    base.delta = notComputedDelta("checkpoint captured; no delta computed");
    base.summary = `Compile checkpoint captured (${snapshot.compile.assemblyCount ?? "?"} assemblies)`;
    return { ...base, phase: options.phase, checkpointPath: path };
  }
  const before = readCheckpoint(options);
  const delta = computeDelta(before, snapshot);
  base.delta = delta;
  if (snapshot.compile.status === "unavailable") {
    base.status = "unavailable";
    base.errors.push("compile state unavailable: Library/ScriptAssemblies not found");
  } else if (delta.computed && (delta.newIssues?.length ?? 0) > 0) {
    base.status = "regressed";
  } else if (delta.computed) {
    base.status = "verified";
  } else {
    base.status = "unknown";
  }
  base.summary = delta.computed ? `${delta.newIssues?.length ?? 0} new, ${delta.resolvedIssues?.length ?? 0} resolved compile issue(s)` : `delta not computed (${delta.reasons[0] ?? "unknown reason"})`;
  return { ...base, phase: options.phase, checkpointPath: null };
}
function testCountsFor(mode, run) {
  return mode === "editor" ? { editMode: run.counts } : { playMode: run.counts };
}
function runModeTests(options, mode) {
  const base = makeResult(options.ability, "unavailable", "No Unity CLI available; tests not run", [], "offline", true);
  base.mode = VERIFY_MODES[options.ability];
  if (!findExecutable(options.cliCommand)) {
    base.errors.push(`Unity CLI "${options.cliCommand}" not found on PATH`);
    return { ...base, testRun: null, testRunSource: null };
  }
  const testOptions = {
    projectRoot: options.projectRoot,
    scratchDir: join6(options.opencodeDir, ".scratch", "unity"),
    cliCommand: options.cliCommand
  };
  const instance = findLiveInstance(options.projectRoot, options.cliCommand);
  const run = runTestMode(testOptions, mode, instance);
  base.route = instance ? "live" : "batch";
  const snapshot = captureSnapshot({ ...options, testCounts: testCountsFor(mode, run) });
  base.checkpoint = snapshot;
  const before = readCheckpoint(options);
  const delta = computeDelta(before, snapshot);
  base.delta = delta;
  if (run.status === "failed")
    base.status = "failed";
  else if (delta.computed && (delta.newIssues?.length ?? 0) > 0)
    base.status = "regressed";
  else
    base.status = "verified";
  const label = mode === "editor" ? "EditMode" : "PlayMode";
  base.summary = `${label}: ${run.counts.passed}/${run.counts.total} passed (${run.status})`;
  return { ...base, testRun: run, testRunSource: run.source };
}
function verifyStatusFromGate(status) {
  switch (status) {
    case "passed":
      return "passed";
    case "failed":
      return "failed";
    case "warning":
      return "warning";
    case "unavailable":
      return "unavailable";
    case "unknown":
      return "unknown";
    case "not_run":
      return "not_run";
  }
}
function gateReview(options) {
  const overrides = parseGateOverrides(options.gatesJson);
  const entries = gateEntriesFromState({
    gateState: readData(options, "gate-state.json"),
    verificationReport: readData(options, "unity-verification-report.json"),
    compileState: readData(options, "compile-state.json"),
    testInventory: readData(options, "test-inventory.json"),
    overrides
  });
  const folded = foldGates(entries, options.reviewIntensity);
  const base = makeResult(options.ability, verifyStatusFromGate(folded.status), `${folded.status} (strictest: ${folded.strictest ?? "none"}, intensity ${folded.intensity})`, [], "offline");
  base.mode = VERIFY_MODES[options.ability];
  base.delta = notComputedDelta("gate review folds named gates; no mutation delta computed");
  if (folded.hardFailures > 0) {
    base.errors.push(`${folded.hardFailures} hard gate failure(s)`);
  }
  return { ...base, gates: folded };
}
function runVerify(options) {
  switch (options.ability) {
    case "compile-and-verify-project":
      return compileAndVerifyProject(options);
    case "run-edit-mode-tests":
      return runModeTests(options, "editor");
    case "run-play-mode-tests":
      return runModeTests(options, "playmode");
    case "gate-review":
      return gateReview(options);
  }
}

// tools/unity/unity-verify/src/cli.ts
import { join as join7, resolve } from "node:path";

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

// tools/unity/unity-verify/src/cli.ts
var PHASES = ["checkpoint", "validate"];
var INTENSITIES = ["full", "lean", "solo"];
function resolveOptions(argv) {
  const args = parseArgs(argv);
  const projectRoot = resolve(String(args["project-root"] || process.cwd()));
  const opencodeDir = resolve(String(args["opencode-dir"] || join7(projectRoot, ".opencode")));
  const requested = String(args.ability || "compile-and-verify-project");
  const ability = resolveAbility(requested, VERIFY_ABILITIES, "compile-and-verify-project");
  const phaseRaw = firstString(args, ["phase"]);
  const intensityRaw = firstString(args, ["review-intensity", "reviewIntensity"]);
  return {
    projectRoot,
    opencodeDir,
    ability,
    json: Boolean(args.json),
    list: Boolean(args.list),
    phase: phaseRaw && PHASES.includes(phaseRaw) ? phaseRaw : "validate",
    cliCommand: firstString(args, ["unity-cli", "unityCli"]) ?? "unity",
    reviewIntensity: intensityRaw && INTENSITIES.includes(intensityRaw) ? intensityRaw : "full",
    gatesJson: firstString(args, ["gates", "gates-json", "gatesJson"])
  };
}

// tools/unity/unity-verify/src/index.ts
function render(result) {
  const lines = [`[${result.ability}] ${result.status} — ${result.summary}`];
  lines.push(`  route: ${result.route} · mode: ${result.mode}`);
  if (result.delta.computed) {
    lines.push(`  delta: +${result.delta.newIssues?.length ?? 0} / -${result.delta.resolvedIssues?.length ?? 0}`);
  } else {
    lines.push(`  delta: not computed${result.delta.compilePending ? " (compilePending)" : ""}${result.delta.validateScanFailed ? " (validateScanFailed)" : ""}`);
  }
  if ("testRun" in result && result.testRun) {
    lines.push(`  tests: ${result.testRun.counts.passed}/${result.testRun.counts.total} passed`);
  }
  if ("gates" in result)
    lines.push(`  gates: ${result.gates.status} (${result.gates.strictest ?? "none"})`);
  for (const error of result.errors)
    lines.push(`  error: ${error}`);
  return lines.join(`
`);
}
runCli({ abilities: VERIFY_ABILITIES, resolveOptions, run: runVerify, render });
