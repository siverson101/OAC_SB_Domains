// tools/unity/gather-unity-context/src/index.ts
import { basename, join as join8 } from "node:path";

// tools/shared/io.ts
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
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

// tools/unity/gather-unity-context/src/structure.ts
import { readdirSync, readFileSync as readFileSync2 } from "node:fs";
import { extname, join as join7, relative, sep } from "node:path";

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
function toPosix(path) {
  return path.split(sep).join("/");
}
function hasEditorSegment(relPath) {
  return toPosix(relPath).split("/").some((segment) => segment.toLowerCase() === "editor");
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
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith("."))
        continue;
      const full = join7(dir, entry.name);
      if (entry.isDirectory()) {
        if (isExcludedFolder(entry.name))
          continue;
        walk(full);
        continue;
      }
      if (!entry.isFile())
        continue;
      const ext = extname(entry.name).slice(1).toLowerCase();
      const rel = toPosix(relative(projectRoot, full));
      const relFromAsset = toPosix(relative(assetFolder, full));
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
      return readdirSync(assetFolder, { withFileTypes: true }).filter((e) => e.isDirectory() && EXCLUDE_FOLDERS.some((f) => f.toLowerCase() === e.name.toLowerCase())).map((e) => toPosix(join7(relative(projectRoot, assetFolder), e.name)));
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
    assetFolder: toPosix(relative(projectRoot, assetFolder)),
    baseFolder,
    baseFolderConfident,
    counts,
    categories,
    thirdPartyFolders
  };
}
async function resolveBaseFolder(projectRoot, assetFolder, topLevelCounts, total, prompts) {
  const assetRel = toPosix(relative(projectRoot, assetFolder)) || "Assets";
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
  const scan = readJson(join8(options.projectDataDir, "scan-result.json"));
  const projectName = scan?.projectName || basename(options.projectRoot);
  const assetFolder = scan?.assetFolder || join8(options.projectRoot, "Assets");
  const foundProject = scan?.foundProject ?? dirExists(assetFolder);
  const toolchain = probeToolchain(options.projectRoot, options.cliCommand);
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
      hardFailures
    };
    writeJson(join8(options.projectDataDir, "project-structure.json"), structure);
    writeJson(join8(options.projectDataDir, "unity-command-list.json"), commandList);
    writeJson(join8(options.projectDataDir, "unity-command-schema.json"), commandSchema);
    writeJson(join8(options.projectDataDir, "unity-pipeline-status.json"), pipeline);
    writeJson(join8(options.projectDataDir, "unity-mcp-status.json"), mcp);
    writeJson(join8(options.projectDataDir, "unity-verification-report.json"), verificationReport);
    writeJson(join8(options.projectDataDir, "gate-state.json"), gateState);
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
      gateResult: gate.status,
      gateStartedByEditor: editorStartedByUs,
      cancelled: prompts.isCancelled(),
      paths: {
        projectDataDir: options.projectDataDir,
        projectStructure: join8(options.projectDataDir, "project-structure.json"),
        commandList: join8(options.projectDataDir, "unity-command-list.json"),
        commandSchema: join8(options.projectDataDir, "unity-command-schema.json"),
        pipelineStatus: join8(options.projectDataDir, "unity-pipeline-status.json"),
        mcpStatus: join8(options.projectDataDir, "unity-mcp-status.json"),
        verificationReport: join8(options.projectDataDir, "unity-verification-report.json"),
        gateState: join8(options.projectDataDir, "gate-state.json")
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
