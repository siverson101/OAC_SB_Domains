// tools/unity/gather-unity-context/src/index.ts
import { basename as basename2, join as join9 } from "node:path";

// tools/shared/io.ts
import { createHash } from "node:crypto";
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
function sha256(path) {
  try {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
  } catch {
    return null;
  }
}
function nowIso() {
  return new Date().toISOString();
}
function unique(values) {
  return Array.from(new Set(values));
}
function toPosix(path) {
  return path.split(sep).join("/");
}

// tools/shared/prompt-client.ts
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync as writeFileSync2 } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
function defaultFor(q) {
  switch (q.type) {
    case "select":
      return q.initialValue ?? q.options?.[0]?.value ?? "";
    case "multiselect":
      return q.initialValues ?? [];
    case "text":
      return q.defaultValue ?? "";
    case "confirm":
      return q.initialValue ?? false;
  }
}

class PromptClient {
  opts;
  answers;
  cancelledFlag = false;
  constructor(opts) {
    this.opts = opts;
    this.answers = { ...opts.answers };
  }
  known(id) {
    return id in this.answers;
  }
  get(id) {
    return this.answers[id];
  }
  isCancelled() {
    return this.cancelledFlag;
  }
  fillDefaults(questions) {
    for (const q of questions) {
      if (!(q.id in this.answers))
        this.answers[q.id] = defaultFor(q);
    }
  }
  async ask(spec) {
    const unanswered = spec.questions.filter((q) => !(q.id in this.answers));
    if (unanswered.length === 0)
      return this.answers;
    if (this.cancelledFlag || this.opts.nonInteractive) {
      this.fillDefaults(unanswered);
      return this.answers;
    }
    const dir = mkdtempSync(join(tmpdir(), "oac-scan-"));
    const specPath = join(dir, "spec.json");
    const outPath = join(dir, "answers.json");
    try {
      writeFileSync2(specPath, JSON.stringify({ ...spec, questions: unanswered }, null, 2));
      const res = spawnSync(process.execPath, [this.opts.promptScript, "--spec", specPath, "--out", outPath], {
        stdio: "inherit"
      });
      if (res.status === 130) {
        this.cancelledFlag = true;
        this.fillDefaults(unanswered);
        return this.answers;
      }
      if (res.status !== 0) {
        this.cancelledFlag = true;
        this.fillDefaults(unanswered);
        return this.answers;
      }
      const parsed = readJson(outPath);
      Object.assign(this.answers, parsed?.answers ?? {});
      return this.answers;
    } finally {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {}
    }
  }
}
function loadAnswersFile(path) {
  if (!path)
    return {};
  return readJson(path) ?? {};
}

// tools/shared/toolchain.ts
import { spawnSync as spawnSync2 } from "node:child_process";
import { join as join2 } from "node:path";
function run(cmd, args, opts = {}) {
  const res = spawnSync2(cmd, args, {
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
function stripAnsi(text) {
  return text.replace(/\u001b\[[0-9;]*m/g, "");
}
function unityVersionFromFile(projectRoot) {
  const text = readText(join2(projectRoot, "ProjectSettings", "ProjectVersion.txt"));
  if (!text)
    return null;
  const match = text.match(/m_EditorVersion:\s*(\S+)/);
  return match ? match[1] : null;
}
function activeInputHandler(projectRoot) {
  const text = readText(join2(projectRoot, "ProjectSettings", "ProjectSettings.asset"));
  if (!text)
    return null;
  const match = text.match(/^\s*activeInputHandler:\s*(\d+)\s*$/m);
  return match ? Number(match[1]) : null;
}
function parseData(text) {
  try {
    const parsed = JSON.parse(text);
    return parsed?.data ?? null;
  } catch {
    return null;
  }
}
function probeUnityCli(projectRoot, cliCommand = "unity") {
  const cliPath = findExecutable(cliCommand) ?? (cliCommand !== "unity" ? cliCommand : null);
  let cliVer = null;
  let env = null;
  let info = null;
  const ver = run(cliCommand, ["--version"]);
  if (ver.ok)
    cliVer = stripAnsi(ver.stdout || ver.stderr) || null;
  const envRes = run(cliCommand, ["env", "--json", "--no-banner", "--quiet"]);
  if (envRes.ok)
    env = parseData(envRes.stdout);
  const infoRes = run(cliCommand, ["projects", "info", projectRoot, "--json", "--no-banner", "--quiet", "--non-interactive"], { timeout: 30000 });
  if (infoRes.ok)
    info = parseData(infoRes.stdout);
  return { cliPath, cliVer, env, info };
}
function probeToolchain(projectRoot, cliCommand = "unity") {
  const cli = probeUnityCli(projectRoot, cliCommand);
  const unityVer = cli.info?.version ?? unityVersionFromFile(projectRoot);
  return { ...cli, unityVer };
}

// tools/shared/tool-routing.ts
function bridgeAvailable(bridge) {
  if (!bridge)
    return false;
  try {
    return bridge.available() === true;
  } catch {
    return false;
  }
}
function selectRoute(caps) {
  if (caps.localOnly) {
    return { route: "local", reason: "local-only capability; plain filesystem/process work" };
  }
  if (bridgeAvailable(caps.bridge)) {
    return { route: "live", reason: "localhost bridge available; live Editor" };
  }
  if (caps.cliAvailable) {
    return { route: "batch", reason: "Unity CLI available; batch execution" };
  }
  return { route: "offline", reason: "no bridge or CLI; on-disk readers" };
}

// tools/unity/gather-unity-context/src/cli.ts
import { dirname as dirname2, join as join3, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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
function resolveOptions(argv) {
  const args = parseArgs(argv);
  const projectRoot = resolve(String(args["project-root"] || process.cwd()));
  const opencodeDir = resolve(String(args["opencode-dir"] || join3(projectRoot, ".opencode")));
  const contextDir = resolve(String(args["context-dir"] || join3(opencodeDir, "xdomains", "context")));
  const projectDataDir = resolve(String(args["project-data-dir"] || join3(opencodeDir, "project-data")));
  const interimDir = resolve(String(args["interim-dir"] || join3(contextDir, "project")));
  const subdomain = String(args.subdomain || "unity");
  const scratchDir = resolve(String(args["scratch-dir"] || join3(opencodeDir, ".scratch", subdomain)));
  const here = dirname2(fileURLToPath(import.meta.url));
  const promptScript = resolve(String(args.prompt || join3(here, "..", "shared", "prompt.mjs")));
  return {
    projectRoot,
    opencodeDir,
    contextDir,
    projectDataDir,
    interimDir,
    scratchDir,
    subdomain,
    cliCommand: String(args["unity-cli"] || "unity"),
    answersFile: args["answers"] ? resolve(String(args["answers"])) : undefined,
    nonInteractive: Boolean(args["non-interactive"]),
    force: Boolean(args.force),
    runGate: Boolean(args.gate),
    promptScript
  };
}

// tools/unity/gather-unity-context/src/producers.ts
var CLI_FLAGS = ["--json", "--no-banner", "--quiet", "--non-interactive"];
function runCli(cliCommand, args, timeout = 30000) {
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
    route: selectRoute({ bridge: null, cliAvailable: parsed != null }).route,
    data: parsed?.data ?? null,
    errors: parsed?.errors ?? (res.ok ? [] : [{ message: res.stderr || res.stdout || `exit ${res.status}` }]),
    warnings: parsed?.warnings ?? [],
    raw: res.stdout || res.stderr
  };
}
function inventoryCommands(projectRoot, cliCommand) {
  const env = runCli(cliCommand, ["command", ...CLI_FLAGS, "--project-path", projectRoot, "--detail", "full"]);
  const commands = Array.isArray(env.data) ? env.data : env.data?.commands ?? [];
  const status = env.success ? "observed_locally" : "unavailable";
  return {
    commandList: {
      schemaVersion: 1,
      generatedAt: nowIso(),
      status,
      count: commands.length,
      commands,
      errors: env.errors
    },
    commandSchema: {
      schemaVersion: 1,
      generatedAt: nowIso(),
      status,
      help: commands.map((c) => ({ name: c.name, description: c.description, tag: c.tag })),
      errors: env.errors
    }
  };
}
function inspectPipeline(cliCommand) {
  const env = runCli(cliCommand, ["pipeline", "list", ...CLI_FLAGS]);
  return {
    schemaVersion: 1,
    generatedAt: nowIso(),
    status: env.success ? "observed_locally" : "unavailable",
    summary: env.data?.summary ?? null,
    instances: env.data?.instances ?? [],
    latestVersion: env.data?.latestVersion ?? null,
    errors: env.errors
  };
}
function inspectMcp(projectRoot, cliCommand) {
  const env = runCli(cliCommand, ["mcp", "configure", "--list", ...CLI_FLAGS]);
  const clients = Array.isArray(env.data) ? env.data : [];
  const configured = clients.filter((c) => c.status && c.status !== "file-not-found" && c.status !== "no-file").map((c) => c.key);
  return {
    schemaVersion: 1,
    generatedAt: nowIso(),
    status: env.success ? "observed_locally" : "unavailable",
    supportedClients: clients.length,
    configuredClients: configured,
    clients,
    errors: env.errors
  };
}

// tools/unity/gather-unity-context/src/editor.ts
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
function findLiveInstance(projectRoot, cliCommand) {
  const env = runCli(cliCommand, [
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
function startEditor(projectRoot, cliCommand, timeoutMs = 300000) {
  run(cliCommand, ["open", projectRoot, "--args", "-automated", "--no-banner", "--quiet", "--non-interactive"], { timeout: 120000 });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const instance = findLiveInstance(projectRoot, cliCommand);
    if (instance && instance.state === "ready")
      return instance;
    sleep(3000);
  }
  return findLiveInstance(projectRoot, cliCommand);
}
function stopEditor(instance) {
  const pid = instance.pid;
  if (!pid)
    return false;
  if (process.platform === "win32") {
    return run("taskkill", ["/PID", String(pid), "/F", "/T"]).ok;
  }
  return run("kill", [String(pid)]).ok;
}

// tools/unity/gather-unity-context/src/fingerprint.ts
import { createHash as createHash2 } from "node:crypto";
import { join as join4 } from "node:path";
function fingerprintInputs(projectRoot, projectName) {
  return {
    projectName,
    projectPath: projectRoot,
    projectVersionFileHash: sha256(join4(projectRoot, "ProjectSettings", "ProjectVersion.txt")),
    manifestHash: sha256(join4(projectRoot, "Packages", "manifest.json")),
    packagesLockHash: sha256(join4(projectRoot, "Packages", "packages-lock.json")),
    configuredUnityVersion: unityVersionFromFile(projectRoot)
  };
}
function fingerprintOf(inputs) {
  return createHash2("sha256").update(JSON.stringify(inputs)).digest("hex");
}

// tools/unity/gather-unity-context/src/gate.ts
import { join as join6 } from "node:path";

// tools/unity/gather-unity-context/src/scratch.ts
import { existsSync as existsSync2, mkdirSync as mkdirSync2, rmSync as rmSync2, writeFileSync as writeFileSync3 } from "node:fs";
import { join as join5 } from "node:path";
function ensureScratch(dir) {
  mkdirSync2(dir, { recursive: true });
}
function clearScratch(dir) {
  if (existsSync2(dir))
    rmSync2(dir, { recursive: true, force: true });
  mkdirSync2(dir, { recursive: true });
}
function scratchPath(dir, name) {
  return join5(dir, name);
}
function writeScratchJson(dir, name, value) {
  const path = scratchPath(dir, name);
  writeFileSync3(path, JSON.stringify(value, null, 2) + `
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
  const env = runCli(options.cliCommand, [
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
  const output = join6(options.scratchDir, `${mode.toLowerCase()}-results.xml`);
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
function runGate(options, instance) {
  if (!options.runGate) {
    return { status: "not_run", editMode: null, playMode: null, instance: null };
  }
  if (!instance) {
    const editMode = runBatchTest(options, "EditMode");
    const playMode = runBatchTest(options, "PlayMode");
    const failed = [editMode, playMode].some((r) => r.status === "failed");
    return { status: failed ? "failed" : "passed", editMode, playMode, instance: null };
  }
  const editMode = runLiveTest(options, "editor");
  const playMode = runLiveTest(options, "playmode");
  const failed = [editMode, playMode].some((r) => r.status === "failed");
  return {
    status: failed ? "failed" : "passed",
    editMode,
    playMode,
    instance: instance.project ?? options.projectRoot
  };
}

// tools/unity/gather-unity-context/src/offline.ts
import { readdirSync, statSync as statSync2 } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname as dirname3, isAbsolute, join as join7, relative } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
var OFFLINE_ROUTE = selectRoute({ bridge: null, cliAvailable: false }).route;
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
      const full = join7(dir, entry.name);
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
    const local = process.env.LOCALAPPDATA || join7(home, "AppData", "Local");
    return [
      join7(local, "Unity", "Editor", "Editor.log"),
      join7(local, "Unity", "Editor", "Editor-prev.log")
    ];
  }
  if (process.platform === "darwin") {
    return [
      join7(home, "Library", "Logs", "Unity", "Editor.log"),
      join7(home, "Library", "Logs", "Unity", "Editor-prev.log")
    ];
  }
  return [
    join7(home, ".config", "unity3d", "Editor.log"),
    join7(home, ".config", "unity3d", "Editor-prev.log")
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
  const assembliesDir = join7(input.projectRoot, "Library", "ScriptAssemblies");
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
      const full = join7(assembliesDir, name);
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
  let noOpRecompile = null;
  if (newestAssembly && newestScript) {
    stale = newestScript.mtimeUtc > newestAssembly.mtimeUtc;
    noOpRecompile = stale && recentCompile ? true : null;
  } else if (newestAssembly && !newestScript) {
    stale = false;
  } else if (!newestAssembly && newestScript) {
    stale = true;
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
var SCRIPTING_BACKEND = { 0: "Mono", 1: "IL2CPP" };
var INPUT_HANDLERS = {
  0: "Input Manager (Old)",
  1: "Input System Package (New)",
  2: "Both"
};
var GRAPHICS_DEVICE_TYPES = {
  0: "OpenGL2",
  1: "Direct3D9",
  2: "Direct3D11",
  4: "Null",
  8: "OpenGLES2",
  11: "OpenGLES3",
  16: "Metal",
  17: "OpenGLCore",
  18: "Direct3D12",
  21: "Vulkan"
};
function yamlScalar(text, keys) {
  for (const key of keys) {
    const match = new RegExp(`^\\s*${key}:\\s*(.+?)\\s*$`, "m").exec(text);
    if (match) {
      const value = match[1].replace(/^['"]|['"]$/g, "");
      if (value !== "")
        return value;
    }
  }
  return null;
}
function yamlBlockMap(text, keys) {
  for (const key of keys) {
    const lines = text.split(/\r?\n/);
    const out = {};
    let inBlock = false;
    let indent = 0;
    let found = false;
    for (const line of lines) {
      const header = new RegExp(`^(\\s*)${key}:\\s*$`).exec(line);
      if (header) {
        inBlock = true;
        indent = header[1].length;
        found = true;
        continue;
      }
      if (!inBlock)
        continue;
      if (line.trim() === "")
        continue;
      const currentIndent = line.length - line.trimStart().length;
      if (currentIndent <= indent) {
        inBlock = false;
        continue;
      }
      const entry = /^\s*([A-Za-z0-9_]+):\s*(.+?)\s*$/.exec(line);
      if (entry)
        out[entry[1]] = entry[2].replace(/^['"]|['"]$/g, "");
    }
    if (found)
      return out;
  }
  return {};
}
function decodeGraphicsApis(hex) {
  const out = [];
  for (let i = 0;i + 8 <= hex.length; i += 8) {
    const bytes = hex.slice(i, i + 8).match(/../g) ?? [];
    const value = Number.parseInt(bytes.reverse().join(""), 16);
    out.push(GRAPHICS_DEVICE_TYPES[value] ?? `Unknown(${value})`);
  }
  return out;
}
function computePersistentDataPath(companyName, productName) {
  if (!companyName || !productName)
    return { path: null, basis: null };
  const home = homedir();
  if (process.platform === "win32") {
    const local = process.env.LOCALAPPDATA || join7(home, "AppData", "Local");
    return {
      path: toPosix(join7(dirname3(local), "LocalLow", companyName, productName)),
      basis: "%LOCALAPPDATA%/../LocalLow/<company>/<product>"
    };
  }
  if (process.platform === "darwin") {
    return {
      path: toPosix(join7(home, "Library", "Application Support", companyName, productName)),
      basis: "~/Library/Application Support/<company>/<product>"
    };
  }
  return {
    path: toPosix(join7(home, ".config", "unity3d", companyName, productName)),
    basis: "~/.config/unity3d/<company>/<product>"
  };
}
function produceProjectSettings(input) {
  const errors = [];
  const settingsPath = join7(input.projectRoot, "ProjectSettings", "ProjectSettings.asset");
  const text = readText(settingsPath);
  if (!text) {
    return {
      ...makeBase("unavailable", errors),
      settingsPath: toPosix(relative(input.projectRoot, settingsPath)),
      productName: null,
      companyName: null,
      scriptingBackend: {},
      scriptingBackendRaw: {},
      il2cpp: null,
      targetPlatform: null,
      targetPlatformSource: null,
      colorSpace: null,
      graphicsApis: [],
      persistentDataPath: null,
      persistentDataPathBasis: null,
      activeInputHandler: null,
      activeInputHandlerName: null
    };
  }
  const productName = yamlScalar(text, ["productName"]);
  const companyName = yamlScalar(text, ["companyName"]);
  const scriptingBackendRaw = {};
  const scriptingBackend = {};
  for (const [platform, value] of Object.entries(yamlBlockMap(text, ["scriptingBackend", "m_ScriptingBackend"]))) {
    const num = Number(value);
    if (!Number.isFinite(num))
      continue;
    scriptingBackendRaw[platform] = num;
    scriptingBackend[platform] = SCRIPTING_BACKEND[num] ?? `Unknown(${num})`;
  }
  const il2cpp = Object.keys(scriptingBackendRaw).length === 0 ? null : Object.values(scriptingBackendRaw).some((value) => value === 1);
  const colorRaw = yamlScalar(text, ["m_ActiveColorSpace", "m_ColorSpace"]);
  const colorSpace = colorRaw === "0" ? "Gamma" : colorRaw === "1" ? "Linear" : null;
  let targetPlatform = yamlScalar(text, ["m_ActiveBuildTarget", "activeBuildTarget"]);
  let targetPlatformSource = targetPlatform ? "ProjectSettings.asset" : null;
  if (!targetPlatform) {
    const editorBuildSettings = readText(join7(input.projectRoot, "ProjectSettings", "EditorUserBuildSettings.asset"));
    const match = editorBuildSettings?.match(/^\s*m_ActiveBuildTarget:\s*(\S+)\s*$/m);
    if (match) {
      targetPlatform = match[1];
      targetPlatformSource = "EditorUserBuildSettings.asset";
    }
  }
  const graphicsApis = [];
  const apiRe = /m_BuildTarget:\s*([^\s]+)\s*\r?\n\s*m_APIs:\s*([0-9a-fA-F]+)/g;
  let apiMatch;
  while (apiMatch = apiRe.exec(text)) {
    graphicsApis.push(...decodeGraphicsApis(apiMatch[2]));
  }
  const persistent = computePersistentDataPath(companyName, productName);
  const handler = activeInputHandler(input.projectRoot);
  return {
    ...makeBase("observed_locally", errors),
    settingsPath: toPosix(relative(input.projectRoot, settingsPath)),
    productName,
    companyName,
    scriptingBackend,
    scriptingBackendRaw,
    il2cpp,
    targetPlatform,
    targetPlatformSource,
    colorSpace,
    graphicsApis: unique(graphicsApis),
    persistentDataPath: persistent.path,
    persistentDataPathBasis: persistent.basis,
    activeInputHandler: handler,
    activeInputHandlerName: handler == null ? null : INPUT_HANDLERS[handler] ?? `Unknown(${handler})`
  };
}
function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
function ownerAsmdef(dir, dirs) {
  let current = dir;
  for (;; ) {
    const owner = dirs.find((entry) => entry.dir === current);
    if (owner)
      return owner;
    const parent = dirname3(current);
    if (parent === current)
      return null;
    current = parent;
  }
}
function scanAsmdefs(assetFolder) {
  const errors = [];
  const files = walkFiles(assetFolder, (name) => name.toLowerCase().endsWith(".asmdef"));
  const guidToName = new Map;
  const byPath = new Map;
  for (const file of files) {
    const json = readJson(file);
    if (!json) {
      errors.push(`unreadable asmdef: ${toPosix(file)}`);
      continue;
    }
    const name = json.name || basename(file, ".asmdef");
    byPath.set(file, { json, dir: dirname3(file), name });
    const guid = readText(`${file}.meta`)?.match(/guid:\s*([0-9a-fA-F]{32})/);
    if (guid)
      guidToName.set(guid[1].toLowerCase(), name);
  }
  const names = new Set([...byPath.values()].map((entry) => entry.name));
  const dirs = [...byPath.entries()].map(([path, entry]) => ({ path, ...entry }));
  const ivtByAsmdef = new Map;
  for (const cs of walkFiles(assetFolder, (name) => name.toLowerCase().endsWith(".cs"))) {
    const owner = ownerAsmdef(dirname3(cs), dirs);
    if (!owner)
      continue;
    const text = readText(cs);
    if (!text || !text.includes("InternalsVisibleTo"))
      continue;
    const re = /InternalsVisibleTo\(\s*"([^"]+)"\s*\)/g;
    const set = ivtByAsmdef.get(owner.path) ?? new Set;
    let match;
    while (match = re.exec(text))
      set.add(match[1]);
    ivtByAsmdef.set(owner.path, set);
  }
  const nodes = [];
  const edges = [];
  for (const [path, entry] of byPath) {
    const references = stringArray(entry.json.references);
    const includePlatforms = stringArray(entry.json.includePlatforms);
    const excludePlatforms = stringArray(entry.json.excludePlatforms);
    const optional = stringArray(entry.json.optionalUnityReferences);
    const testAssemblies = entry.json.testAssemblies === true || optional.includes("TestAssemblies");
    const isTest = testAssemblies || /\.Tests(\.|$)/.test(entry.name) || /\.Tests\.asmdef$/i.test(path);
    const editorOnly = includePlatforms.length === 1 && includePlatforms[0].toLowerCase() === "editor";
    const ivt = new Set(stringArray(entry.json.internalsVisibleTo));
    for (const value of ivtByAsmdef.get(path) ?? [])
      ivt.add(value);
    nodes.push({
      name: entry.name,
      path: toPosix(path),
      references,
      includePlatforms,
      excludePlatforms,
      testAssemblies,
      isTest,
      editorOnly,
      targets: { edit: editorOnly, play: !editorOnly },
      internalsVisibleTo: [...ivt].sort()
    });
    for (const reference of references) {
      const guid = reference.startsWith("GUID:") ? reference.slice(5).toLowerCase() : null;
      const resolvedName = guid ? guidToName.get(guid) ?? null : names.has(reference) ? reference : null;
      edges.push({ from: entry.name, to: resolvedName, reference, resolved: resolvedName != null });
    }
  }
  nodes.sort((a, b) => a.name.localeCompare(b.name));
  return { nodes, edges, errors };
}
function produceAsmdefMap(input) {
  const { nodes, edges, errors } = scanAsmdefs(input.assetFolder);
  const status = !dirExists(input.assetFolder) ? "unknown" : nodes.length > 0 ? "observed_locally" : "unavailable";
  return {
    ...makeBase(status, errors),
    assetFolder: toPosix(relative(input.projectRoot, input.assetFolder)),
    assemblyCount: nodes.length,
    testAssemblyCount: nodes.filter((node) => node.isTest).length,
    assemblies: nodes,
    edges
  };
}
function collectScreenshotPaths(value, projectRoot) {
  const out = [];
  const visit = (node) => {
    if (typeof node === "string") {
      if (/\.(png|jpe?g)$/i.test(node)) {
        out.push(toPosix(isAbsolute(node) ? relative(projectRoot, node) : node));
      }
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node)
        visit(item);
      return;
    }
    if (node && typeof node === "object") {
      for (const item of Object.values(node))
        visit(item);
    }
  };
  visit(value);
  return unique(out);
}
function parseVisualVerification(file, projectRoot) {
  const data = readJson(file);
  if (!data || typeof data !== "object")
    return null;
  const cases = Array.isArray(data.cases) ? data.cases : Array.isArray(data.results) ? data.results : [];
  return {
    path: toPosix(relative(projectRoot, file)),
    status: typeof data.status === "string" ? data.status : null,
    summary: data.summary ?? null,
    cases,
    screenshots: collectScreenshotPaths(data, projectRoot)
  };
}
function produceTestInventory(input) {
  const errors = [];
  const { nodes } = scanAsmdefs(input.assetFolder);
  const testAssemblies = nodes.filter((node) => node.isTest).map((node) => ({ name: node.name, path: node.path }));
  const roots = unique([input.projectRoot, ...input.opencodeDir ? [input.opencodeDir] : []]);
  const resultFiles = new Set;
  const visualFiles = new Set;
  const screenshots = new Set;
  for (const root of roots) {
    for (const file of walkFiles(root, (name) => /results\.xml$/i.test(name) || name === "TestResults.xml")) {
      resultFiles.add(file);
    }
    for (const file of walkFiles(root, (name) => /^visual-verification.*\.json$/i.test(name))) {
      visualFiles.add(file);
    }
    for (const file of walkFiles(root, (name, full) => /\.(png|jpe?g)$/i.test(name) && /screenshot/i.test(full))) {
      screenshots.add(file);
    }
  }
  const results = [];
  for (const file of resultFiles) {
    const info = statInfo(file);
    const counts = parseNUnit(readText(file) ?? "");
    results.push({
      path: toPosix(relative(input.projectRoot, file)),
      mtimeUtc: info?.mtimeUtc ?? null,
      counts,
      result: counts.result
    });
  }
  results.sort((a, b) => (b.mtimeUtc ?? "").localeCompare(a.mtimeUtc ?? ""));
  const visualResults = [];
  for (const file of visualFiles) {
    const parsed = parseVisualVerification(file, input.projectRoot);
    if (parsed)
      visualResults.push(parsed);
  }
  visualResults.sort((a, b) => a.path.localeCompare(b.path));
  const status = testAssemblies.length > 0 || results.length > 0 ? "observed_locally" : "unavailable";
  return {
    ...makeBase(status, errors),
    testAssemblies,
    testAssemblyCount: testAssemblies.length,
    results,
    latestResult: results[0] ?? null,
    visualVerification: {
      found: visualFiles.size > 0,
      files: [...visualFiles].map((file) => toPosix(relative(input.projectRoot, file))),
      results: visualResults,
      screenshots: [...screenshots].map((file) => toPosix(relative(input.projectRoot, file)))
    }
  };
}
var MAX_FINDINGS = 1000;
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function defaultPatternsPath() {
  const here = dirname3(fileURLToPath2(import.meta.url));
  return join7(here, "..", "..", "context", "unity", "deprecated-patterns.json");
}
function loadDeprecatedPatterns(overridePath) {
  const path = overridePath ?? defaultPatternsPath();
  const data = readJson(path);
  if (data && Array.isArray(data.patterns) && data.patterns.length > 0) {
    return { patterns: data.patterns, source: "bundle", path };
  }
  return { patterns: [], source: "missing", path: null };
}
function produceDeprecationScan(input, patternsPath) {
  const { patterns, source, path } = loadDeprecatedPatterns(patternsPath);
  const errors = [];
  const sorted = [...patterns].sort((a, b) => b.match.length - a.match.length);
  const findings = [];
  const byPattern = {};
  let truncated = false;
  const files = walkFiles(input.assetFolder, (name) => name.toLowerCase().endsWith(".cs"));
  outer:
    for (const file of files) {
      const text = readText(file);
      if (!text)
        continue;
      const lines = text.split(/\r?\n/);
      for (let index = 0;index < lines.length; index++) {
        const line = lines[index];
        const taken = [];
        for (const pattern of sorted) {
          const re = new RegExp(`\\b${escapeRegExp(pattern.match)}\\b`, "g");
          let match;
          while (match = re.exec(line)) {
            const start = match.index;
            const end = start + match[0].length;
            if (taken.some((range) => start < range.end && end > range.start))
              continue;
            taken.push({ start, end });
            if (findings.length >= MAX_FINDINGS) {
              truncated = true;
              break outer;
            }
            findings.push({
              patternId: pattern.id,
              match: pattern.match,
              replacement: pattern.replacement,
              file: toPosix(relative(input.projectRoot, file)),
              line: index + 1,
              text: line.trim()
            });
            byPattern[pattern.match] = (byPattern[pattern.match] ?? 0) + 1;
          }
        }
      }
    }
  const status = patterns.length === 0 ? "unavailable" : dirExists(input.assetFolder) ? "observed_locally" : "unknown";
  return {
    ...makeBase(status, errors),
    patternsLoaded: patterns.length,
    patternsSource: source,
    patternsPath: path ? toPosix(path) : null,
    scannedFiles: files.length,
    findingCount: findings.length,
    truncated,
    byPattern,
    findings
  };
}

// tools/unity/gather-unity-context/src/structure.ts
import { readdirSync as readdirSync2, readFileSync as readFileSync2 } from "node:fs";
import { extname, join as join8, relative as relative2, sep as sep2 } from "node:path";

// tools/unity/project-scan/src/asset-folder.ts
var EXCLUDE_FOLDERS = ["Packages", "Plugins", "Library", "Text Mesh Pro", "ThirdParty"];
function isExcludedFolder(name) {
  return EXCLUDE_FOLDERS.some((folder) => folder.toLowerCase() === name.toLowerCase());
}

// tools/unity/gather-unity-context/src/structure.ts
var CATEGORY_BY_EXT = {
  asmdef: "asmdefs",
  uxml: "uxml",
  uss: "uss",
  unity: "scenes",
  prefab: "prefabs",
  fbx: "models",
  obj: "models",
  blend: "models",
  dae: "models",
  "3ds": "models",
  max: "models",
  ma: "models",
  mb: "models",
  png: "images",
  jpg: "images",
  jpeg: "images",
  tga: "images",
  psd: "images",
  tif: "images",
  tiff: "images",
  exr: "images",
  hdr: "images",
  bmp: "images",
  gif: "images",
  wav: "audio",
  mp3: "audio",
  ogg: "audio",
  aiff: "audio",
  aif: "audio",
  flac: "audio",
  mod: "audio",
  it: "audio",
  s3m: "audio",
  xm: "audio",
  inputactions: "actionMaps",
  shader: "shaders",
  cginc: "shaders",
  hlsl: "shaders",
  compute: "compute",
  dll: "nativeLibraries",
  so: "nativeLibraries",
  dylib: "nativeLibraries",
  a: "nativeLibraries",
  lib: "nativeLibraries",
  bundle: "nativeLibraries",
  framework: "nativeLibraries"
};
function toPosix2(path) {
  return path.split(sep2).join("/");
}
function hasEditorSegment(relPath) {
  return toPosix2(relPath).split("/").some((segment) => segment.toLowerCase() === "editor");
}
function isSpriteMeta(metaPath) {
  try {
    return /textureType:\s*8\b/.test(readFileSync2(metaPath, "utf8"));
  } catch {
    return false;
  }
}
async function discoverProjectStructure(input) {
  const { projectRoot, assetFolder, projectName, prompts } = input;
  const categories = {};
  const add = (category, value) => {
    (categories[category] ??= []).push(value);
  };
  const topLevelCounts = {};
  let total = 0;
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync2(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith("."))
        continue;
      const full = join8(dir, entry.name);
      if (entry.isDirectory()) {
        if (isExcludedFolder(entry.name))
          continue;
        walk(full);
        continue;
      }
      if (!entry.isFile())
        continue;
      const ext = extname(entry.name).slice(1).toLowerCase();
      const rel = toPosix2(relative2(projectRoot, full));
      const relFromAsset = toPosix2(relative2(assetFolder, full));
      if (ext === "cs") {
        add(hasEditorSegment(relFromAsset) ? "editorScripts" : "runtimeScripts", rel);
      } else {
        const category = CATEGORY_BY_EXT[ext];
        if (!category)
          continue;
        add(category, rel);
        if (category === "images" && isSpriteMeta(full + ".meta"))
          add("sprites", rel);
      }
      total++;
      const top = relFromAsset.includes("/") ? relFromAsset.split("/")[0] : ".";
      topLevelCounts[top] = (topLevelCounts[top] ?? 0) + 1;
    }
  };
  walk(assetFolder);
  const thirdPartyFolders = (() => {
    try {
      return readdirSync2(assetFolder, { withFileTypes: true }).filter((e) => e.isDirectory() && EXCLUDE_FOLDERS.some((f) => f.toLowerCase() === e.name.toLowerCase())).map((e) => toPosix2(join8(relative2(projectRoot, assetFolder), e.name)));
    } catch {
      return [];
    }
  })();
  const { baseFolder, baseFolderConfident } = await resolveBaseFolder(projectRoot, assetFolder, topLevelCounts, total, prompts);
  const counts = {};
  for (const [category, files] of Object.entries(categories))
    counts[category] = files.length;
  return {
    schemaVersion: 1,
    generatedAt: nowIso(),
    projectName,
    assetFolder: toPosix2(relative2(projectRoot, assetFolder)),
    baseFolder,
    baseFolderConfident,
    counts,
    categories,
    thirdPartyFolders
  };
}
async function resolveBaseFolder(projectRoot, assetFolder, topLevelCounts, total, prompts) {
  const assetRel = toPosix2(relative2(projectRoot, assetFolder)) || "Assets";
  const ranked = Object.entries(topLevelCounts).sort((a, b) => b[1] - a[1]);
  const rootCount = topLevelCounts["."] ?? 0;
  if (total === 0)
    return { baseFolder: assetRel, baseFolderConfident: false };
  const [topName, topCount] = ranked[0] ?? [".", 0];
  if (topName !== "." && topCount / total >= 0.6) {
    return { baseFolder: `${assetRel}/${topName}`, baseFolderConfident: true };
  }
  if (rootCount / total >= 0.5) {
    return { baseFolder: assetRel, baseFolderConfident: true };
  }
  const candidates = ranked.filter(([name]) => name !== ".").map(([name, count]) => ({
    value: `${assetRel}/${name}`,
    label: `${name} (${count} files)`
  }));
  const options = [{ value: assetRel, label: `${assetRel} (${rootCount} files)` }, ...candidates];
  const answers = await prompts.ask({
    title: "Project base folder",
    questions: [
      {
        id: "baseFolder",
        type: "select",
        message: "Which folder is the base for this project?",
        options
      }
    ]
  });
  const chosen = String(answers.baseFolder || assetRel);
  return { baseFolder: chosen, baseFolderConfident: false };
}

// tools/unity/gather-unity-context/src/index.ts
async function main() {
  const options = resolveOptions(process.argv.slice(2));
  const answers = loadAnswersFile(options.answersFile);
  const prompts = new PromptClient({
    promptScript: options.promptScript,
    answers,
    nonInteractive: options.nonInteractive
  });
  if (options.force)
    clearScratch(options.scratchDir);
  else
    ensureScratch(options.scratchDir);
  const scan = readJson(join9(options.projectDataDir, "scan-result.json"));
  const projectName = scan?.projectName || basename2(options.projectRoot);
  const assetFolder = scan?.assetFolder || join9(options.projectRoot, "Assets");
  const foundProject = scan?.foundProject ?? dirExists(assetFolder);
  const toolchain = probeToolchain(options.projectRoot, options.cliCommand);
  const cliAvailable = Boolean(toolchain.cliPath);
  const selection = selectRoute({ bridge: null, cliAvailable });
  let editorInstance = null;
  let editorStartedByUs = false;
  if (options.runGate) {
    editorInstance = findLiveInstance(options.projectRoot, options.cliCommand);
    if (!editorInstance) {
      editorInstance = startEditor(options.projectRoot, options.cliCommand);
      editorStartedByUs = editorInstance != null;
    }
  }
  try {
    const structure = await discoverProjectStructure({
      projectRoot: options.projectRoot,
      assetFolder,
      projectName,
      prompts
    });
    const { commandList, commandSchema } = inventoryCommands(options.projectRoot, options.cliCommand);
    const pipeline = inspectPipeline(options.cliCommand);
    const mcp = inspectMcp(options.projectRoot, options.cliCommand);
    const fpInputs = fingerprintInputs(options.projectRoot, projectName);
    const fingerprint = fingerprintOf(fpInputs);
    const gate = runGate(options, editorInstance);
    const offlineInput = {
      projectRoot: options.projectRoot,
      assetFolder,
      opencodeDir: options.opencodeDir
    };
    const compileState = produceCompileState(offlineInput);
    const logDigest = produceLogDigest(offlineInput);
    const projectSettings = produceProjectSettings(offlineInput);
    const asmdefMap = produceAsmdefMap(offlineInput);
    const testInventory = produceTestInventory(offlineInput);
    const deprecationScan = produceDeprecationScan(offlineInput);
    const hardFailures = (gate.editMode?.status === "failed" ? 1 : 0) + (gate.playMode?.status === "failed" ? 1 : 0);
    const verificationReport = {
      schemaVersion: 1,
      generatedAt: nowIso(),
      project: projectName,
      projectPath: options.projectRoot,
      configuredUnityVersion: toolchain.unityVer,
      status: gate.status,
      gateResult: gate.status,
      instance: gate.instance,
      startedByEditor: editorStartedByUs,
      summary: {
        editMode: gate.editMode?.counts ?? null,
        playMode: gate.playMode?.counts ?? null
      },
      results: { editMode: gate.editMode, playMode: gate.playMode },
      fingerprint,
      errors: []
    };
    const gateState = {
      schemaVersion: 1,
      generatedAt: nowIso(),
      project: projectName,
      projectPath: options.projectRoot,
      fingerprint,
      fingerprintInputs: fpInputs,
      unityCliVer: toolchain.cliVer,
      unityVer: toolchain.unityVer,
      unityEnv: toolchain.env,
      gateResult: gate.status,
      gateInstance: gate.instance,
      gateStartedByEditor: editorStartedByUs,
      lastVerificationUtc: gate.status === "not_run" ? null : nowIso(),
      reviewRequired: 0,
      hardFailures,
      routing: { route: selection.route, reason: selection.reason }
    };
    writeJson(join9(options.projectDataDir, "project-structure.json"), structure);
    writeJson(join9(options.projectDataDir, "unity-command-list.json"), commandList);
    writeJson(join9(options.projectDataDir, "unity-command-schema.json"), commandSchema);
    writeJson(join9(options.projectDataDir, "unity-pipeline-status.json"), pipeline);
    writeJson(join9(options.projectDataDir, "unity-mcp-status.json"), mcp);
    writeJson(join9(options.projectDataDir, "unity-verification-report.json"), verificationReport);
    writeJson(join9(options.projectDataDir, "gate-state.json"), gateState);
    writeJson(join9(options.projectDataDir, "compile-state.json"), compileState);
    writeJson(join9(options.projectDataDir, "log-digest.json"), logDigest);
    writeJson(join9(options.projectDataDir, "project-settings.json"), projectSettings);
    writeJson(join9(options.projectDataDir, "asmdef-map.json"), asmdefMap);
    writeJson(join9(options.projectDataDir, "test-inventory.json"), testInventory);
    writeJson(join9(options.projectDataDir, "deprecation-scan.json"), deprecationScan);
    const summary = {
      generatedAt: nowIso(),
      projectName,
      foundProject,
      assetFolder,
      baseFolder: structure.baseFolder,
      baseFolderConfident: structure.baseFolderConfident,
      unityCliVer: toolchain.cliVer,
      unityVer: toolchain.unityVer,
      fingerprint,
      route: selection.route,
      routeReason: selection.reason,
      gateResult: gate.status,
      gateStartedByEditor: editorStartedByUs,
      cancelled: prompts.isCancelled(),
      paths: {
        projectDataDir: options.projectDataDir,
        projectStructure: join9(options.projectDataDir, "project-structure.json"),
        commandList: join9(options.projectDataDir, "unity-command-list.json"),
        commandSchema: join9(options.projectDataDir, "unity-command-schema.json"),
        pipelineStatus: join9(options.projectDataDir, "unity-pipeline-status.json"),
        mcpStatus: join9(options.projectDataDir, "unity-mcp-status.json"),
        verificationReport: join9(options.projectDataDir, "unity-verification-report.json"),
        gateState: join9(options.projectDataDir, "gate-state.json"),
        compileState: join9(options.projectDataDir, "compile-state.json"),
        logDigest: join9(options.projectDataDir, "log-digest.json"),
        projectSettings: join9(options.projectDataDir, "project-settings.json"),
        asmdefMap: join9(options.projectDataDir, "asmdef-map.json"),
        testInventory: join9(options.projectDataDir, "test-inventory.json"),
        deprecationScan: join9(options.projectDataDir, "deprecation-scan.json")
      }
    };
    process.stdout.write(JSON.stringify(summary, null, 2) + `
`);
  } finally {
    if (editorStartedByUs && editorInstance)
      stopEditor(editorInstance);
  }
}
main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`gather-unity-context: ${message}
`);
  process.exitCode = 1;
});
