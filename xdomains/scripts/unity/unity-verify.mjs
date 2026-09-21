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

// tools/unity/unity-verify/src/abilities.ts
import { join as join8 } from "node:path";

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
function normalizeProject(path) {
  return toPosix(path).toLowerCase();
}
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
  const target = normalizeProject(projectRoot);
  return instances.find((i) => normalizeProject(i.project ?? "") === target) ?? null;
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

// tools/shared/xml.ts
function decodeXmlEntities(value) {
  const codePoint = (match, digits, radix) => {
    const code = Number.parseInt(digits, radix);
    return Number.isFinite(code) && code >= 0 && code <= 1114111 ? String.fromCodePoint(code) : match;
  };
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#x([0-9a-fA-F]+);/g, (match, digits) => codePoint(match, digits, 16)).replace(/&#(\d+);/g, (match, digits) => codePoint(match, digits, 10)).replace(/&amp;/g, "&");
}

// tools/unity/gather-unity-context/src/offline.ts
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
    if (stale) {
      noOpRecompile = recentCompile ? true : null;
      if (!recentCompile)
        staleReason = "stale; no compile evidence in Editor.log";
    }
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
  "gate-review",
  "failing-test-first",
  "test-deduplication"
];
var VERIFY_ABILITIES = [...VERIFY_ABILITY_NAMES];
var VERIFY_MODES = {
  "compile-and-verify-project": "both",
  "run-edit-mode-tests": "both",
  "run-play-mode-tests": "both",
  "gate-review": "offline",
  "failing-test-first": "both",
  "test-deduplication": "offline"
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
function stringArray(obj, key) {
  const value = obj?.[key];
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
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
function makeResult(ability, status, summary, errors, route, requiresEditor = false, gate = {}) {
  return {
    ...makeEnvelope({ ability, family: "verify", mode: "offline", status, summary, errors, route }),
    safetyGate: { mutates: false, requiresEditor, ...gate },
    changeScope: null,
    checkpoint: null,
    delta: {
      computed: false,
      newIssues: null,
      resolvedIssues: null,
      validateScanFailed: false,
      compilePending: false,
      scopeUnmatched: false,
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
function issueInScope(issue, scope) {
  const tokens = scope.map((token) => token.trim().toLowerCase()).filter((token) => token !== "");
  if (tokens.length === 0)
    return true;
  const haystack = `${issue.id} ${issue.message}`.toLowerCase();
  return tokens.some((token) => haystack.includes(token));
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
function computeDelta(before, after, scan = { ok: true }, changeScope = []) {
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
      scopeUnmatched: false,
      reasons
    };
  }
  const beforeKeys = new Set(before.issues.map(issueKey));
  const afterKeys = new Set(after.issues.map(issueKey));
  const rawNew = after.issues.filter((issue) => !beforeKeys.has(issueKey(issue)));
  const rawResolved = before.issues.filter((issue) => !afterKeys.has(issueKey(issue)));
  const scoped = changeScope.some((token) => token.trim() !== "");
  const newIssues = scoped ? rawNew.filter((issue) => issueInScope(issue, changeScope)) : rawNew;
  const resolvedIssues = scoped ? rawResolved.filter((issue) => issueInScope(issue, changeScope)) : rawResolved;
  const excluded = rawNew.length - newIssues.length + (rawResolved.length - resolvedIssues.length);
  const scopeUnmatched = scoped && ![...before.issues, ...after.issues].some((issue) => issueInScope(issue, changeScope));
  const deltaReasons = excluded > 0 ? [`${excluded} out-of-scope issue(s) excluded from the delta`] : [];
  if (scopeUnmatched)
    deltaReasons.push("declared change scope matched no issues; the delta may under-report");
  return {
    computed: true,
    newIssues,
    resolvedIssues,
    validateScanFailed: false,
    compilePending: false,
    scopeUnmatched,
    reasons: deltaReasons
  };
}
function notComputedDelta(reason) {
  return {
    computed: false,
    newIssues: null,
    resolvedIssues: null,
    validateScanFailed: false,
    compilePending: false,
    scopeUnmatched: false,
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

// tools/unity/unity-verify/src/failing-test-first.ts
import { join as join6, resolve } from "node:path";

// tools/unity/studio-config/src/types.ts
var STUDIO_MODES = ["lean", "full"];
var REVIEW_INTENSITIES = ["full", "lean", "solo"];
var MODEL_TIERS = ["router", "lead", "specialist"];
var STUDIO_CONFIG_SCHEMA_VERSION = 1;
var DEFAULT_STUDIO_CONFIG = {
  schemaVersion: STUDIO_CONFIG_SCHEMA_VERSION,
  studioMode: "lean",
  reviewIntensity: "full",
  toggles: { tdd: false, ftf: false },
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
  "toggles",
  "patterns",
  "packages",
  "modelTiers"
]);
var KNOWN_TOGGLE_KEYS = new Set(["tdd", "ftf"]);
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
function parseToggles(value, problems) {
  const toggles = { ...DEFAULT_STUDIO_CONFIG.toggles };
  if (value === undefined)
    return toggles;
  const record = asRecord(value);
  if (!record) {
    problems.push({ field: "toggles", message: "expected an object with boolean tdd/ftf flags" });
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

// tools/unity/unity-verify/src/failing-test-first.ts
function decodeXml(text) {
  return decodeXmlEntities(text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"));
}
function attribute(attrs, name) {
  const match = new RegExp(`\\b${name}="([^"]*)"`).exec(attrs);
  return match ? decodeXml(match[1]) : null;
}
function normalizeResult(value) {
  const lower = (value ?? "").toLowerCase();
  if (lower === "passed")
    return "Passed";
  if (lower === "failed" || lower === "error")
    return "Failed";
  if (lower === "skipped" || lower === "ignored")
    return "Skipped";
  if (lower === "inconclusive")
    return "Inconclusive";
  return "Unknown";
}
function firstMessage(body) {
  const match = /<message>([\s\S]*?)<\/message>/.exec(body);
  if (!match)
    return null;
  const text = decodeXml(match[1]).trim();
  return text === "" ? null : text;
}
function parseTestCases(xml) {
  const out = [];
  const tag = /<test-case\b([^>]*?)(\/?)>/g;
  let match;
  while ((match = tag.exec(xml)) !== null) {
    const name = attribute(match[1], "name") ?? "";
    const result = normalizeResult(attribute(match[1], "result"));
    let message = null;
    if (match[2] !== "/") {
      const close = xml.indexOf("</test-case>", tag.lastIndex);
      if (close !== -1) {
        message = firstMessage(xml.slice(tag.lastIndex, close));
        tag.lastIndex = close + "</test-case>".length;
      }
    }
    out.push({ name, result, message });
  }
  return out;
}
function findTestCase(cases, name) {
  return cases.find((testCase) => testCase.name === name) ?? null;
}
function containsReason(message, expectedReason) {
  return (message ?? "").toLowerCase().includes(expectedReason.toLowerCase());
}
function decideRedStep(input) {
  const { test, expectedReason, observation } = input;
  if (observation.result === null) {
    return containsReason(observation.message, expectedReason) ? {
      verdict: "UNKNOWN",
      reason: "unobserved-failure",
      detail: `"${test}" was self-reported as failing for the expected reason ("${expectedReason}") but no test result was observed; provide --test-results to confirm`
    } : {
      verdict: "NG",
      reason: "unrelated-failure",
      detail: `"${test}" was self-reported as failing for a different reason than expected ("${expectedReason}"); abort`
    };
  }
  if (observation.result === "Passed") {
    return {
      verdict: "NG",
      reason: "unexpected-pass",
      detail: `"${test}" passed unexpectedly; the red step requires a failing test — abort`
    };
  }
  if (observation.result === "Failed") {
    return containsReason(observation.message, expectedReason) ? {
      verdict: "OK",
      reason: "expected-failure",
      detail: `"${test}" failed for the expected reason ("${expectedReason}")`
    } : {
      verdict: "NG",
      reason: "unrelated-failure",
      detail: `"${test}" failed for a different reason than expected ("${expectedReason}"); abort`
    };
  }
  return {
    verdict: "NG",
    reason: "test-not-run",
    detail: `"${test}" did not fail (result: ${observation.result}); the red step requires a failing test — abort`
  };
}
function loadTddToggle(options) {
  const load = loadStudioConfig(join6(options.opencodeDir, "unity-studio.json"));
  return load.config.toggles.tdd === true;
}
function resolveTdd(options) {
  const raw = (options.tdd ?? "").trim().toLowerCase();
  if (raw === "")
    return { enabled: loadTddToggle(options), error: null };
  if (raw === "on")
    return { enabled: true, error: null };
  if (raw === "off")
    return { enabled: false, error: null };
  return { enabled: false, error: `invalid --tdd "${options.tdd}"; expected on|off` };
}
function runFailingTestFirst(options) {
  const test = (options.test ?? "").trim() || null;
  const expectedReason = (options.expectedReason ?? "").trim() || null;
  const failureMessage = (options.failureMessage ?? "").trim() || null;
  const resultsPath = (options.testResults ?? "").trim() || null;
  const tdd = resolveTdd(options);
  const refuse = (message) => {
    const base = makeResult(options.ability, "refused", message, [message], "offline");
    base.mode = VERIFY_MODES[options.ability];
    base.delta = notComputedDelta("failing-test-first refused; no red-step verdict computed");
    return {
      ...base,
      redStep: null,
      test,
      expectedReason,
      observedResult: null,
      observedMessage: null,
      reason: null,
      tddEnabled: tdd.enabled
    };
  };
  if (tdd.error)
    return refuse(tdd.error);
  if (!tdd.enabled) {
    return refuse("TDD is off (.opencode/unity-studio.json toggles.tdd=false); failing-test-first is TDD-gated. Enable the toggle to enforce the red step — TDD off still requires tests, just not first.");
  }
  if (!test)
    return refuse("a --test <full name> is required");
  if (!expectedReason)
    return refuse("an --expected-reason <substring> is required");
  let observation;
  if (resultsPath) {
    const xml = readText(resolve(options.projectRoot, resultsPath));
    if (xml === null)
      return refuse(`test results not found: ${resultsPath}`);
    const testCase = findTestCase(parseTestCases(xml), test);
    if (!testCase) {
      const decision = {
        verdict: "NG",
        reason: "test-not-found",
        detail: `"${test}" was not found in ${resultsPath}; the red step requires the named test to run and fail — abort`
      };
      return finalize(options, test, expectedReason, tdd.enabled, { result: null, message: null }, decision);
    }
    observation = { result: testCase.result, message: testCase.message ?? failureMessage };
  } else if (failureMessage) {
    observation = { result: null, message: failureMessage };
  } else {
    return refuse("an observed failure is required (--failure-message and/or --test-results)");
  }
  const decision = decideRedStep({ test, expectedReason, observation });
  return finalize(options, test, expectedReason, tdd.enabled, observation, decision);
}
function finalize(options, test, expectedReason, tddEnabled, observation, decision) {
  const status = decision.verdict === "OK" ? "passed" : decision.verdict === "UNKNOWN" ? "unknown" : "failed";
  const summary = `STATUS: ${decision.verdict} — ${decision.detail}`;
  const base = makeResult(options.ability, status, summary, status === "passed" ? [] : [decision.detail], "offline");
  base.mode = VERIFY_MODES[options.ability];
  base.delta = notComputedDelta("failing-test-first reads test results; no mutation delta computed");
  return {
    ...base,
    redStep: decision.verdict,
    test,
    expectedReason,
    observedResult: observation.result,
    observedMessage: observation.message,
    reason: decision.reason,
    tddEnabled
  };
}

// tools/unity/unity-verify/src/test-deduplication.ts
import { readdirSync as readdirSync2, statSync as statSync3, writeFileSync as writeFileSync3 } from "node:fs";
import { join as join7, resolve as resolve2 } from "node:path";

// tools/shared/slug.ts
var SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function isValidSlug(value) {
  return SLUG_PATTERN.test(value);
}

// tools/shared/text.ts
function canonicalizeText(text) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

// tools/unity/unity-verify/src/test-deduplication.ts
var TEST_DEDUP_DIR = "test-dedup";
var TEST_DEDUP_SCHEMA_VERSION = 1;
function literalPattern() {
  return /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|(?<![A-Za-z0-9_])\d+(?:\.\d+)?[fFmMdDlL]?(?![A-Za-z0-9_])|\btrue\b|\bfalse\b|\bnull\b/g;
}
function conditionTemplate(condition) {
  return canonicalizeText(condition).replace(literalPattern(), "#");
}
function conditionLiterals(condition) {
  return canonicalizeText(condition).match(literalPattern()) ?? [];
}
function substituteLiterals(text, params) {
  let index = 0;
  return text.replace(literalPattern(), (match) => index < params.length ? params[index++] : match);
}
var STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "test",
  "tests",
  "var",
  "new",
  "assert",
  "areequal",
  "isequal",
  "returns",
  "return",
  "should",
  "when",
  "given",
  "then",
  "that",
  "this",
  "result",
  "value",
  "expected",
  "actual",
  "true",
  "false",
  "null"
]);
function tokens(text) {
  return text.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(/[^A-Za-z0-9]+/).map((token) => token.toLowerCase()).filter((token) => token.length > 0);
}
function significantTokens(condition, assertion) {
  const out = new Set;
  for (const token of [...tokens(condition), ...tokens(assertion)]) {
    if (token.length >= 3 && !STOPWORDS.has(token))
      out.add(token);
  }
  return out;
}
function nameScore(name, condition, assertion) {
  const significant = significantTokens(condition, assertion);
  return tokens(name).filter((token) => significant.has(token)).length;
}
function chooseKeeper(group) {
  return [...group].sort((a, b) => {
    const scoreA = nameScore(a.name, a.condition, a.assertion);
    const scoreB = nameScore(b.name, b.condition, b.assertion);
    if (scoreA !== scoreB)
      return scoreB - scoreA;
    if (a.name.length !== b.name.length)
      return b.name.length - a.name.length;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  })[0];
}
function groupBy(items, key) {
  const map = new Map;
  for (const item of items) {
    const groupKey = key(item);
    const list = map.get(groupKey);
    if (list)
      list.push(item);
    else
      map.set(groupKey, [item]);
  }
  return map;
}
function renderParameterizedBody(keeper, group) {
  const params = conditionLiterals(keeper.condition).map((_, index) => `p${index}`);
  const lines = [];
  for (const test of group)
    lines.push(`[TestCase(${conditionLiterals(test.condition).join(", ")})]`);
  lines.push(`public void ${keeper.name}(${params.map((name) => `object ${name}`).join(", ")})`);
  lines.push("{");
  lines.push(`    ${substituteLiterals(keeper.condition.trim(), params)}`);
  lines.push(`    ${keeper.assertion.trim()}`);
  lines.push("}");
  return lines.join(`
`);
}
function planDeduplication(tests) {
  const removals = [];
  const merges = [];
  for (const assertionGroup of groupBy(tests, (test) => canonicalizeText(test.assertion)).values()) {
    if (assertionGroup.length < 2)
      continue;
    for (const templateGroup of groupBy(assertionGroup, (test) => conditionTemplate(test.condition)).values()) {
      const representatives = [];
      for (const exactGroup of groupBy(templateGroup, (test) => canonicalizeText(test.condition)).values()) {
        const keeper = chooseKeeper(exactGroup);
        representatives.push(keeper);
        for (const test of exactGroup) {
          if (test === keeper)
            continue;
          removals.push({
            name: test.name,
            keptName: keeper.name,
            file: test.file,
            condition: test.condition,
            assertion: test.assertion,
            reason: "identical condition and identical assertion",
            applied: false
          });
        }
      }
      if (representatives.length < 2)
        continue;
      if (conditionLiterals(representatives[0].condition).length === 0)
        continue;
      const template = conditionTemplate(representatives[0].condition);
      if (/\b(if|switch)\b/.test(template))
        continue;
      const keeper = chooseKeeper(representatives);
      merges.push({
        keptName: keeper.name,
        removedNames: representatives.filter((test) => test !== keeper).map((test) => test.name),
        assertion: keeper.assertion,
        cases: representatives.map((test) => ({ name: test.name, arguments: conditionLiterals(test.condition) })),
        body: renderParameterizedBody(keeper, representatives),
        reason: "same assertion; conditions differ only by literal arguments in the same equivalence partition"
      });
    }
  }
  return { removals, merges };
}
var ATTR_HEAD_SOURCE = "\\[(?:Test|UnityTest|TestCase|TestCaseSource)\\b[^\\]]*\\](?:\\s*\\[[^\\]]*\\])*\\s*" + "(?:(?:public|private|protected|internal|static|async|sealed|override|virtual)\\s+)*" + "(?:void|IEnumerator|Task<[^>]+>|Task)\\s+([A-Za-z_]\\w*)\\s*\\([^)]*\\)\\s*\\{";
function skipString(text, index) {
  const quote = text[index];
  if (text[index - 1] === "@") {
    for (let i = index + 1;i < text.length; i++) {
      if (text[i] === '"') {
        if (text[i + 1] === '"') {
          i++;
          continue;
        }
        return i;
      }
    }
    return text.length;
  }
  for (let i = index + 1;i < text.length; i++) {
    if (text[i] === "\\") {
      i++;
      continue;
    }
    if (text[i] === quote)
      return i;
  }
  return text.length;
}
function matchBrace(text, openIndex) {
  let depth = 0;
  for (let i = openIndex;i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === "'") {
      i = skipString(text, i);
      continue;
    }
    if (ch === "/" && text[i + 1] === "/") {
      const newline = text.indexOf(`
`, i);
      i = newline === -1 ? text.length : newline;
      continue;
    }
    if (ch === "/" && text[i + 1] === "*") {
      const close = text.indexOf("*/", i + 2);
      i = close === -1 ? text.length : close + 1;
      continue;
    }
    if (ch === "{")
      depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0)
        return i;
    }
  }
  return text.length;
}
function splitBody(body) {
  const conditionLines = [];
  const assertionLines = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "")
      continue;
    if (/\bAssert\./.test(line))
      assertionLines.push(line);
    else
      conditionLines.push(line);
  }
  return { condition: conditionLines.join(`
`), assertion: assertionLines.join(`
`) };
}
function lineStart(text, index) {
  const newline = text.lastIndexOf(`
`, index - 1);
  return newline === -1 ? 0 : newline + 1;
}
function extractTestMethods(text) {
  const out = [];
  const head = new RegExp(ATTR_HEAD_SOURCE, "g");
  let match;
  while ((match = head.exec(text)) !== null) {
    const open = head.lastIndex - 1;
    const close = matchBrace(text, open);
    const { condition, assertion } = splitBody(text.slice(open + 1, close));
    out.push({ name: match[1], start: lineStart(text, match.index), end: close + 1, condition, assertion });
    head.lastIndex = close + 1;
  }
  return out;
}
function walkCsFiles(dir, out = []) {
  let entries;
  try {
    entries = readdirSync2(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join7(dir, entry);
    let directory = false;
    try {
      directory = statSync3(full).isDirectory();
    } catch {
      continue;
    }
    if (directory)
      walkCsFiles(full, out);
    else if (entry.endsWith(".cs"))
      out.push(full);
  }
  return out;
}
function scanCsTests(dir) {
  const out = [];
  for (const file of walkCsFiles(dir).sort()) {
    const text = readText(file);
    if (text === null)
      continue;
    for (const method of extractTestMethods(text)) {
      out.push({ name: method.name, condition: method.condition, assertion: method.assertion, file: toPosix(file) });
    }
  }
  return out;
}
function removeTestMethods(text, removals, file) {
  const target = toPosix(file);
  const names = new Set(removals.filter((removal) => removal.file !== null && toPosix(removal.file) === target).map((removal) => removal.name));
  const methods = extractTestMethods(text).filter((method) => names.has(method.name));
  const removed = [];
  let out = text;
  for (const method of [...methods].sort((a, b) => b.start - a.start)) {
    let end = method.end;
    while (end < out.length && (out[end] === "\r" || out[end] === `
`))
      end++;
    out = out.slice(0, method.start) + out.slice(end);
    removed.push(method.name);
  }
  return { text: out, removed };
}
function parseDescriptors(value) {
  const raw = Array.isArray(value) ? value : asRecord(value)?.tests;
  const list = Array.isArray(raw) ? raw : [];
  const descriptors = [];
  const errors = [];
  for (const item of list) {
    const record = asRecord(item);
    const name = str(record, "name");
    const condition = str(record, "condition");
    const assertion = str(record, "assertion");
    if (!record || !name || condition === null || assertion === null) {
      errors.push(`ignored malformed test descriptor: ${JSON.stringify(item)}`);
      continue;
    }
    descriptors.push({ name, condition, assertion, file: str(record, "file") });
  }
  return { descriptors, errors };
}
function dedupDir(options) {
  return join7(options.opencodeDir, TEST_DEDUP_DIR);
}
function dedupArtifactPath(options, slug) {
  return join7(dedupDir(options), `${slug}.json`);
}
function runTestDeduplication(options) {
  const slug = (options.feature ?? "").trim();
  const apply = options.apply === true;
  const artifactPath = slug ? toPosix(dedupArtifactPath(options, slug)) : toPosix(dedupDir(options));
  const refuse = (message) => {
    const base = makeResult(options.ability, "refused", message, [message], "offline");
    base.mode = VERIFY_MODES[options.ability];
    base.delta = notComputedDelta("test-deduplication refused; no dedup plan computed");
    return {
      ...base,
      action: apply ? "apply" : "propose",
      feature: slug || null,
      artifactPath,
      written: false,
      applied: false,
      totalTests: 0,
      removals: [],
      merges: [],
      removedFromFiles: []
    };
  };
  if (!slug)
    return refuse("a --feature <slug> is required");
  if (!isValidSlug(slug))
    return refuse(`invalid feature slug "${slug}"; use kebab-case (a-z, 0-9, -)`);
  const testsDir = (options.testsDir ?? "").trim() || null;
  const testsJson = (options.testsJson ?? "").trim() || null;
  if (!testsDir && !testsJson)
    return refuse("one of --tests <dir> or --tests-json <file> is required");
  const descriptors = [];
  const errors = [];
  let source = { testsDir: null, testsJson: null };
  if (testsJson) {
    const jsonPath = resolve2(options.projectRoot, testsJson);
    const json = readJson(jsonPath);
    if (json === null)
      return refuse(`test descriptor JSON not found: ${testsJson}`);
    const parsed = parseDescriptors(json);
    descriptors.push(...parsed.descriptors);
    errors.push(...parsed.errors);
    source = { ...source, testsJson: toPosix(jsonPath) };
  }
  if (testsDir) {
    const dirPath = resolve2(options.projectRoot, testsDir);
    if (!dirExists(dirPath))
      return refuse(`tests directory not found: ${testsDir}`);
    descriptors.push(...scanCsTests(dirPath));
    source = { ...source, testsDir: toPosix(dirPath) };
  }
  const plan = planDeduplication(descriptors);
  const clean = plan.removals.length === 0 && plan.merges.length === 0;
  const removedFromFiles = [];
  const appliedKeys = new Set;
  if (apply && !clean && testsDir) {
    for (const file of walkCsFiles(resolve2(options.projectRoot, testsDir))) {
      const text = readText(file);
      if (text === null)
        continue;
      const result = removeTestMethods(text, plan.removals, file);
      if (result.removed.length > 0) {
        writeFileSync3(file, result.text);
        removedFromFiles.push(toPosix(file));
        for (const name of result.removed)
          appliedKeys.add(`${toPosix(file)}::${name}`);
      }
    }
  }
  const removals = plan.removals.map((removal) => ({
    ...removal,
    applied: removal.file !== null && appliedKeys.has(`${toPosix(removal.file)}::${removal.name}`)
  }));
  const appliedCount = removals.filter((removal) => removal.applied).length;
  const proposedCount = removals.length - appliedCount;
  const mergePart = `${plan.merges.length} parameterizable group(s) proposed for merge`;
  const summary = clean ? "no duplicates found" : appliedCount > 0 ? `${appliedCount} duplicate(s) removed${proposedCount > 0 ? `, ${proposedCount} proposed (not applied)` : ""}, ${mergePart}` : `${removals.length} duplicate(s) proposed, ${mergePart}`;
  const shouldWriteArtifact = apply || !clean;
  if (shouldWriteArtifact) {
    const artifact = {
      schemaVersion: TEST_DEDUP_SCHEMA_VERSION,
      generatedAt: nowIso(),
      feature: slug,
      applied: appliedCount > 0,
      sources: source,
      totalTests: descriptors.length,
      removals,
      merges: plan.merges,
      summary
    };
    writeJson(dedupArtifactPath(options, slug), artifact);
  }
  const base = makeResult(options.ability, clean ? "passed" : "observed_locally", summary, errors, "offline", false, {
    mutates: appliedCount > 0,
    dryRunFirst: true,
    writesState: true
  });
  base.mode = VERIFY_MODES[options.ability];
  base.delta = notComputedDelta("test-deduplication reads test descriptors; no mutation delta computed");
  return {
    ...base,
    action: apply ? "apply" : "propose",
    feature: slug,
    artifactPath,
    written: shouldWriteArtifact,
    applied: appliedCount > 0,
    totalTests: descriptors.length,
    removals,
    merges: plan.merges,
    removedFromFiles
  };
}

// tools/unity/unity-verify/src/gates.ts
var EXTERNAL_VERDICTS = ["confirmed", "uncertain"];
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
function effectiveGateStatus(entry) {
  if (!entry.externalVerdict)
    return entry.status;
  const external = entry.externalVerdict === "uncertain" ? "warning" : "passed";
  return severity(external) > severity(entry.status) ? external : entry.status;
}
function foldGates(entries, intensity = "full") {
  const applicable = gatesForIntensity(intensity);
  const considered = entries.filter((entry) => applicable.includes(entry.gate)).slice().sort((a, b) => orderIndex(a.gate) - orderIndex(b.gate));
  let strictest = null;
  for (const entry of considered) {
    if (!strictest || severity(effectiveGateStatus(entry)) > severity(effectiveGateStatus(strictest))) {
      strictest = entry;
    }
  }
  return {
    status: strictest ? effectiveGateStatus(strictest) : "not_run",
    strictest: strictest?.gate ?? null,
    intensity,
    entries: considered,
    hardFailures: considered.filter((entry) => effectiveGateStatus(entry) === "failed").length,
    reviewRequired: considered.filter((entry) => effectiveGateStatus(entry) === "warning").length
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
function visualTestName(test) {
  return str(test, "fullname") ?? "(unknown visual test)";
}
function visualTestFailed(test) {
  const status = (str(test, "status") ?? "").toLowerCase();
  return status.includes("fail") || status.includes("error");
}
function visualTestHasScreenshot(test) {
  const screenshots = stringArray(test, "screenshots");
  const missing = stringArray(test, "missingScreenshots");
  return screenshots.length > 0 && missing.length === 0;
}
function visualGate(testInventory) {
  const visual = asRecord(testInventory?.visualVerification);
  if (!visual)
    return { gate: "visual", status: "not_run" };
  if (Array.isArray(visual.tests)) {
    const tests = asArray(visual.tests).map(asRecord).filter((test) => test !== null);
    if (tests.length === 0)
      return { gate: "visual", status: "not_run" };
    const failed = tests.filter(visualTestFailed);
    if (failed.length > 0) {
      return { gate: "visual", status: "failed", detail: `visual test failed: ${failed.map(visualTestName).join(", ")}` };
    }
    const missing = tests.filter((test) => !visualTestHasScreenshot(test));
    if (missing.length > 0) {
      return {
        gate: "visual",
        status: "failed",
        detail: `missing screenshot: ${missing.map(visualTestName).join(", ")}`
      };
    }
    return { gate: "visual", status: "passed" };
  }
  if (bool(visual, "found") !== true)
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
    return { entries: [], errors: [] };
  try {
    const parsed = JSON.parse(json);
    const entries = asArray(parsed).map(asRecord).filter((entry) => entry !== null);
    const out = [];
    const errors = [];
    for (const entry of entries) {
      const gate = str(entry, "gate");
      const status = str(entry, "status");
      if (!gate || !GATE_ORDER.includes(gate)) {
        errors.push(`ignored --gates override "${gate ?? "unknown"}": unknown gate`);
        continue;
      }
      if (!status || !(status in SEVERITY)) {
        errors.push(`ignored --gates override "${gate}": unknown status "${status ?? "unknown"}"`);
        continue;
      }
      const externalRaw = str(entry, "externalVerdict");
      let externalVerdict;
      if (externalRaw !== null) {
        if (EXTERNAL_VERDICTS.includes(externalRaw)) {
          externalVerdict = externalRaw;
        } else {
          errors.push(`ignored --gates override "${gate}": unknown externalVerdict "${externalRaw}"`);
        }
      }
      out.push({
        gate,
        status,
        ...externalVerdict ? { externalVerdict } : {},
        detail: str(entry, "detail") ?? undefined
      });
    }
    return { entries: out, errors };
  } catch {
    return { entries: [], errors: [] };
  }
}

// tools/unity/unity-verify/src/abilities.ts
function readData(options, file) {
  return readJson(join8(projectDataDir(options), file));
}
function compileAndVerifyProject(options) {
  const changeScope = (options.changeScope ?? []).map((token) => token.trim()).filter((token) => token !== "");
  if (options.phase === "validate" && changeScope.length === 0) {
    const refusal = "validate requires a declared change scope (--change-scope, comma-separated files/symbols); refusing to report a verdict";
    const base = makeResult(options.ability, "refused", refusal, [refusal], "offline");
    base.mode = VERIFY_MODES[options.ability];
    base.delta = notComputedDelta("change scope required; no delta computed");
    return { ...base, phase: options.phase, checkpointPath: null };
  }
  const snapshot = captureSnapshot(options);
  const base = makeResult(options.ability, "observed_locally", "Compile checkpoint captured from Library/ScriptAssemblies", [], "offline");
  base.mode = VERIFY_MODES[options.ability];
  base.changeScope = changeScope.length > 0 ? changeScope : null;
  base.checkpoint = snapshot;
  if (options.phase === "checkpoint") {
    const path = writeCheckpoint(options, snapshot);
    base.delta = notComputedDelta("checkpoint captured; no delta computed");
    base.summary = `Compile checkpoint captured (${snapshot.compile.assemblyCount ?? "?"} assemblies)`;
    return { ...base, phase: options.phase, checkpointPath: path };
  }
  const before = readCheckpoint(options);
  const delta = computeDelta(before, snapshot, { ok: true }, changeScope);
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
    scratchDir: join8(options.opencodeDir, ".scratch", "unity"),
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
  const { entries: overrides, errors: overrideErrors } = parseGateOverrides(options.gatesJson);
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
  base.errors.push(...overrideErrors);
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
    case "failing-test-first":
      return runFailingTestFirst(options);
    case "test-deduplication":
      return runTestDeduplication(options);
    default: {
      const exhaustive = options.ability;
      throw new Error(`unsupported Verify ability: ${String(exhaustive)}`);
    }
  }
}

// tools/unity/unity-verify/src/cli.ts
import { join as join9, resolve as resolve3 } from "node:path";

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

// tools/unity/unity-verify/src/cli.ts
var PHASES = ["checkpoint", "validate"];
var INTENSITIES = ["full", "lean", "solo"];
function resolveOptions(argv) {
  const { values: args, positional } = parseArgs(argv);
  rejectPositionals(positional);
  const projectRoot = resolve3(String(args["project-root"] || process.cwd()));
  const opencodeDir = resolve3(String(args["opencode-dir"] || join9(projectRoot, ".opencode")));
  const requested = String(args.ability || "compile-and-verify-project");
  const ability = resolveAbility(requested, VERIFY_ABILITIES, "compile-and-verify-project");
  const phaseRaw = firstString(args, ["phase"]);
  const intensityRaw = firstString(args, ["review-intensity", "reviewIntensity"]);
  const changeScope = parseCommaList(firstString(args, ["change-scope", "changeScope"]));
  return {
    projectRoot,
    opencodeDir,
    ability,
    json: Boolean(args.json),
    list: Boolean(args.list),
    phase: phaseRaw && PHASES.includes(phaseRaw) ? phaseRaw : "validate",
    cliCommand: firstString(args, ["unity-cli", "unityCli"]) ?? "unity",
    reviewIntensity: intensityRaw && INTENSITIES.includes(intensityRaw) ? intensityRaw : "full",
    changeScope,
    gatesJson: firstString(args, ["gates", "gates-json", "gatesJson"]),
    test: firstString(args, ["test", "test-name", "testName"]),
    expectedReason: firstString(args, ["expected-reason", "expectedReason"]),
    failureMessage: firstString(args, ["failure-message", "failureMessage"]),
    testResults: firstString(args, ["test-results", "testResults"]),
    tdd: firstString(args, ["tdd"]),
    feature: firstString(args, ["feature", "slug"]),
    testsDir: firstString(args, ["tests", "tests-dir", "testsDir"]),
    testsJson: firstString(args, ["tests-json", "testsJson"]),
    apply: Boolean(args.apply)
  };
}

// tools/unity/unity-verify/src/index.ts
function run2(options) {
  const result = runVerify(options);
  if (result.ability === "failing-test-first" && result.status === "failed")
    process.exitCode = 1;
  return result;
}
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
  if ("redStep" in result && result.redStep)
    lines.push(`  STATUS: ${result.redStep}`);
  if ("removals" in result) {
    lines.push(`  action: ${result.action} · tests: ${result.totalTests} · removals: ${result.removals.length} · merges: ${result.merges.length} · written: ${result.written}`);
    for (const removal of result.removals)
      lines.push(`  remove ${removal.name} (keep ${removal.keptName})`);
    for (const merge of result.merges)
      lines.push(`  merge ${merge.removedNames.join(", ")} into ${merge.keptName}`);
  }
  for (const error of result.errors)
    lines.push(`  error: ${error}`);
  return lines.join(`
`);
}
runCli({ abilities: VERIFY_ABILITIES, resolveOptions, run: run2, render });
