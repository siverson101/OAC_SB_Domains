// tools/unity/project-scan/src/index.ts
import { join as join8, resolve as resolve3 } from "node:path";

// tools/unity/project-scan/src/asset-folder.ts
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
var EXCLUDE_FOLDERS = ["Packages", "Plugins", "Library", "Text Mesh Pro", "ThirdParty"];
var MAX_DEPTH = 4;
function isExcludedFolder(name) {
  return EXCLUDE_FOLDERS.some((folder) => folder.toLowerCase() === name.toLowerCase());
}
function isDir(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
function collectAssetCandidates(projectRoot) {
  const found = [];
  const walk = (dir, depth) => {
    if (depth > MAX_DEPTH)
      return;
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.startsWith("."))
        continue;
      if (isExcludedFolder(entry))
        continue;
      const full = join(dir, entry);
      if (!isDir(full))
        continue;
      if (entry.toLowerCase() === "assets") {
        found.push({ path: full, depth });
        continue;
      }
      walk(full, depth + 1);
    }
  };
  walk(projectRoot, 1);
  return found;
}
async function discoverAssetFolder(projectRoot, prompts) {
  const rootAssets = join(projectRoot, "Assets");
  if (isDir(rootAssets))
    return { foundProject: true, assetFolder: rootAssets };
  const candidates = collectAssetCandidates(projectRoot);
  const depth1 = candidates.filter((c) => c.depth === 1);
  const depth2 = candidates.filter((c) => c.depth === 2);
  if (depth1.length === 1)
    return { foundProject: true, assetFolder: depth1[0].path };
  if (depth2.length === 1)
    return { foundProject: true, assetFolder: depth2[0].path };
  if (candidates.length === 1)
    return { foundProject: true, assetFolder: candidates[0].path };
  if (candidates.length === 0)
    return { foundProject: false, assetFolder: null };
  const options = candidates.map((c) => ({
    value: c.path,
    label: relative(projectRoot, c.path).split(sep).join("/")
  }));
  const answers = await prompts.ask({
    title: "Assets folder",
    questions: [
      {
        id: "assetFolder",
        type: "select",
        message: "Multiple Assets folders were found. Which one is the project?",
        options
      }
    ]
  });
  return { foundProject: true, assetFolder: String(answers.assetFolder) };
}

// tools/unity/project-scan/src/cli.ts
import { dirname, join as join2, resolve } from "node:path";
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
  const opencodeDir = resolve(String(args["opencode-dir"] || join2(projectRoot, ".opencode")));
  const contextDir = resolve(String(args["context-dir"] || join2(opencodeDir, "xdomains", "context")));
  const projectDataDir = resolve(String(args["project-data-dir"] || join2(opencodeDir, "project-data")));
  const interimDir = resolve(String(args["interim-dir"] || join2(contextDir, "project")));
  const here = dirname(fileURLToPath(import.meta.url));
  const promptScript = resolve(String(args["prompt"] || join2(here, "..", "shared", "prompt.mjs")));
  return {
    projectRoot,
    opencodeDir,
    contextDir,
    projectDataDir,
    interimDir,
    answersFile: args["answers"] ? resolve(String(args["answers"])) : undefined,
    nonInteractive: Boolean(args["non-interactive"] || args["defaults"]),
    reask: Boolean(args["reask"]),
    force: Boolean(args["force"]),
    promptScript
  };
}

// tools/shared/context-files.ts
import { join as join3 } from "node:path";

// tools/shared/io.ts
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync as statSync2, writeFileSync } from "node:fs";
import { dirname as dirname2, sep as sep2 } from "node:path";
function fileExists(path) {
  try {
    return statSync2(path).isFile();
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
  mkdirSync(dirname2(path), { recursive: true });
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

// tools/shared/context-files.ts
var PATTERN_CATALOG_FILENAME = "programming-patterns.json";
function contextPaths(contextDir) {
  return {
    filetypes: join3(contextDir, "filetypes.json"),
    packageChoices: join3(contextDir, "unity", "package-choices.json"),
    understoodPackages: join3(contextDir, "unity", "understood-package-categories.json"),
    patterns: join3(contextDir, PATTERN_CATALOG_FILENAME)
  };
}
function loadFiletypes(path) {
  return readJson(path) ?? { filetypes: {} };
}
function loadPackageChoices(path) {
  return readJson(path) ?? { choices: [] };
}
function loadUnderstoodPackages(path) {
  return readJson(path) ?? { packages: [] };
}
function loadPatterns(path) {
  return readJson(path) ?? { categories: [], patterns: [] };
}

// tools/unity/project-scan/src/package-choices.ts
function derivePrettyName(packageName) {
  const last = packageName.split(".").pop() ?? packageName;
  return last.split(/[-_]/).map((segment) => segment ? segment.charAt(0).toUpperCase() + segment.slice(1) : segment).join("");
}
function prettyNameFor(packageName, understood) {
  const row = understood.packages.find((p) => p.packageName === packageName);
  return row?.prettyName || derivePrettyName(packageName);
}
async function runPackageChoices(choices, understood, installed, projectName, prompts) {
  const packageChoices = {};
  const deferredChoices = {};
  const questions = [];
  const pending = [];
  for (const row of choices.choices ?? []) {
    const present = (row.packageNames ?? []).filter((p) => installed.has(p));
    if (row.deferToStage4) {
      deferredChoices[row.category] = present;
      continue;
    }
    if (present.length === 0)
      continue;
    if (present.length === 1) {
      packageChoices[row.category] = present[0];
      continue;
    }
    pending.push({ category: row.category, present });
    questions.push({
      id: `choice:${row.category}`,
      type: "select",
      message: row.prompt.replace(/<project_name>/g, projectName),
      options: present.map((p) => ({ value: p, label: prettyNameFor(p, understood) }))
    });
  }
  if (questions.length > 0) {
    const answers = await prompts.ask({ title: "Package choices", questions });
    for (const entry of pending) {
      packageChoices[entry.category] = String(answers[`choice:${entry.category}`]);
    }
  }
  return { packageChoices, deferredChoices };
}

// tools/unity/project-scan/src/patterns-interview.ts
async function runPatternsInterview(patterns, prompts) {
  const questions = [];
  const asked = [];
  for (const category of patterns.categories ?? []) {
    if (category.deferToStage4)
      continue;
    const options = (category.patterns ?? []).map((id) => {
      const pattern = patterns.patterns.find((p) => p.id === id);
      return { value: id, label: pattern?.name ?? id, hint: pattern?.whenToUse };
    });
    if (category.selection === "single") {
      questions.push({
        id: `pattern:${category.id}`,
        type: "select",
        message: `${category.name}: choose one`,
        options: [...options, { value: "none", label: "None / I don't know" }],
        initialValue: options[0]?.value
      });
    } else {
      questions.push({
        id: `pattern:${category.id}`,
        type: "multiselect",
        message: `${category.name}: choose any that apply`,
        options,
        initialValues: [],
        required: false
      });
    }
    asked.push(category.id);
  }
  const answers = await prompts.ask({ title: "Programming patterns", questions });
  const result = {};
  const chosen = new Set;
  for (const categoryId of asked) {
    const value = answers[`pattern:${categoryId}`];
    if (value === undefined)
      continue;
    result[categoryId] = value;
    for (const id of Array.isArray(value) ? value : [value]) {
      if (typeof id === "string" && id !== "none")
        chosen.add(id);
    }
  }
  const warnings = [];
  for (const id of chosen) {
    const pattern = patterns.patterns.find((p) => p.id === id);
    for (const conflict of pattern?.conflictsWith ?? []) {
      if (chosen.has(conflict)) {
        warnings.push(`Pattern conflict: "${id}" conflicts with "${conflict}".`);
      }
    }
  }
  return { patterns: result, warnings };
}

// tools/shared/prompt-client.ts
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync as writeFileSync2 } from "node:fs";
import { tmpdir } from "node:os";
import { join as join4 } from "node:path";
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
    const dir = mkdtempSync(join4(tmpdir(), "oac-scan-"));
    const specPath = join4(dir, "spec.json");
    const outPath = join4(dir, "answers.json");
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

// tools/unity/project-scan/src/project-files.ts
import { readdirSync as readdirSync2, readFileSync as readFileSync2 } from "node:fs";
import { extname, join as join5, relative as relative2, sep as sep3 } from "node:path";
function toPosix(path) {
  return path.split(sep3).join("/");
}
function discoverProjectFiles(projectRoot, assetFolder, filetypes) {
  const folders = {};
  const filetypeToFolder = {};
  const codeFiles = [];
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
      const full = join5(dir, entry.name);
      if (entry.isDirectory()) {
        if (isExcludedFolder(entry.name))
          continue;
        walk(full);
        continue;
      }
      if (!entry.isFile())
        continue;
      const ext = extname(entry.name).slice(1).toLowerCase();
      if (!filetypes[ext])
        continue;
      const folderKey = toPosix(relative2(projectRoot, dir)) || ".";
      const assetRelFolder = toPosix(relative2(assetFolder, dir)) || ".";
      folders[folderKey] ??= {};
      folders[folderKey][ext] ??= [];
      folders[folderKey][ext].push(entry.name);
      filetypeToFolder[ext] ??= [];
      if (!filetypeToFolder[ext].includes(assetRelFolder))
        filetypeToFolder[ext].push(assetRelFolder);
      if (ext === "cs") {
        const isEditor = toPosix(relative2(assetFolder, dir)).split("/").some((segment) => segment.toLowerCase() === "editor");
        if (!isEditor)
          codeFiles.push(full);
      }
    }
  };
  walk(assetFolder);
  return { folders, filetypeToFolder, codeFiles };
}
function detectInputUsage(codeFiles) {
  const newPattern = /UnityEngine\.InputSystem/;
  const legacyPattern = /UnityEngine\.Input(?!System)\b|\bInput\./;
  let usesInputSystem = false;
  let usesLegacyInput = false;
  for (const file of codeFiles) {
    let text;
    try {
      text = readFileSync2(file, "utf8");
    } catch {
      continue;
    }
    if (!usesInputSystem && newPattern.test(text))
      usesInputSystem = true;
    if (!usesLegacyInput && legacyPattern.test(text))
      usesLegacyInput = true;
    if (usesInputSystem && usesLegacyInput)
      break;
  }
  return { usesInputSystem, usesLegacyInput };
}

// tools/unity/project-scan/src/project-meta.ts
function buildProjectJson(input) {
  const info = input.info ?? {};
  return {
    schemaVersion: 1,
    generatedAt: nowIso(),
    project: {
      name: input.name,
      path: input.path,
      version: input.unityVer ?? info.version ?? null,
      changeset: info.changeset ?? null,
      architecture: info.architecture ?? null,
      buildTarget: info.buildTarget ?? null,
      renderPipeline: info.renderPipeline ?? null,
      scriptingBackend: info.scriptingBackend ?? null,
      localProjectId: info.localProjectId ?? null,
      cloudProjectId: info.cloudProjectId ?? null,
      organizationId: info.organizationId ?? null,
      vcsProvider: info.vcsProvider ?? null,
      repositoryName: info.repositoryName ?? null,
      lastModified: info.lastModified ?? null,
      editorInstallPath: input.env?.editorInstallPath ?? null,
      native: input.native,
      subProjects: input.subProjects
    }
  };
}

// tools/unity/project-scan/src/project-name.ts
import { basename } from "node:path";
async function resolveProjectName(projectRoot, prompts) {
  const defaultName = basename(projectRoot);
  if (prompts.known("projectName"))
    return String(prompts.get("projectName") || defaultName);
  const confirm = await prompts.ask({
    title: "Project name",
    questions: [
      {
        id: "projectNameOk",
        type: "confirm",
        message: `Use "${defaultName}" as the project name?`,
        initialValue: true
      }
    ]
  });
  if (confirm.projectNameOk === true)
    return defaultName;
  const renamed = await prompts.ask({
    title: "Project name",
    questions: [
      {
        id: "projectName",
        type: "text",
        message: "Enter the project name",
        defaultValue: defaultName,
        initialValue: defaultName
      }
    ]
  });
  return String(renamed.projectName || defaultName);
}

// tools/unity/project-scan/src/sub-projects.ts
import { isAbsolute, resolve as resolve2 } from "node:path";
async function gatherNative(basePath, name, prompts) {
  const meta = await prompts.ask({
    title: `Native build: ${name}`,
    questions: [
      { id: "solution", type: "text", message: "Solution path (relative to the sub-project root)" },
      { id: "configuration", type: "text", message: "Configuration", defaultValue: "Release" },
      { id: "platform", type: "text", message: "Platform", defaultValue: "x64" }
    ]
  });
  const solution = String(meta.solution || "").trim();
  const configuration = String(meta.configuration || "Release");
  const platform = String(meta.platform || "x64");
  const artifacts = [];
  for (;; ) {
    const add = await prompts.ask({
      title: `Artifacts: ${name}`,
      questions: [
        {
          id: "moreArtifacts",
          type: "confirm",
          message: "Add an artifact (DLL) to this native build?",
          initialValue: artifacts.length === 0
        }
      ]
    });
    if (add.moreArtifacts !== true)
      break;
    const fields = await prompts.ask({
      title: `Artifact: ${name}`,
      questions: [
        { id: "artName", type: "text", message: "Artifact name" },
        { id: "artKind", type: "text", message: "Kind / hint (e.g. loader, core)" },
        { id: "artPath", type: "text", message: "Artifact path (relative to the sub-project root)" },
        { id: "artPdb", type: "text", message: "PDB path (optional)" }
      ]
    });
    const path = String(fields.artPath || "").trim();
    const pdb = String(fields.artPdb || "").trim();
    artifacts.push({
      name: String(fields.artName || "").trim(),
      kind: String(fields.artKind || "").trim(),
      path,
      pdb: pdb || undefined,
      exists: path ? fileExists(resolve2(basePath, path)) : false,
      pdbExists: pdb ? fileExists(resolve2(basePath, pdb)) : undefined
    });
  }
  return {
    status: solution ? "declared" : "unavailable",
    solution: solution || null,
    solutionExists: solution ? fileExists(resolve2(basePath, solution)) : false,
    configuration,
    platform,
    artifacts
  };
}
async function runSubProjects(projectRoot, projectName, prompts) {
  const subProjects = {};
  let native = null;
  const main = await prompts.ask({
    title: "Native build",
    questions: [
      {
        id: "hasNative",
        type: "confirm",
        message: `Does ${projectName} compile native (C++/C) code?`,
        initialValue: false
      }
    ]
  });
  if (main.hasNative === true) {
    native = await gatherNative(projectRoot, projectName, prompts);
  }
  for (;; ) {
    const more = await prompts.ask({
      title: "Sub-projects",
      questions: [
        {
          id: "hasSubProject",
          type: "confirm",
          message: "Is there another sub-project that needs to compile?",
          initialValue: false
        }
      ]
    });
    if (more.hasSubProject !== true)
      break;
    const meta = await prompts.ask({
      title: "Sub-project",
      questions: [
        { id: "subName", type: "text", message: "Sub-project name" },
        { id: "subPath", type: "text", message: "Path (absolute or relative to the project root)" },
        { id: "subLanguage", type: "text", message: "Language", defaultValue: "cpp" },
        { id: "subKind", type: "text", message: "Kind / hint (e.g. loader, core)" }
      ]
    });
    const name = String(meta.subName || "").trim();
    const path = String(meta.subPath || "").trim();
    if (!name || !path)
      break;
    const absPath = isAbsolute(path) ? path : resolve2(projectRoot, path);
    const nativeState = await gatherNative(absPath, name, prompts);
    subProjects[name] = {
      path: absPath,
      language: String(meta.subLanguage || "cpp"),
      kind: String(meta.subKind || ""),
      native: {
        solution: nativeState.solution ?? "",
        configuration: nativeState.configuration ?? "Release",
        platform: nativeState.platform ?? "x64",
        artifacts: nativeState.artifacts
      }
    };
  }
  return { native, subProjects };
}

// tools/shared/toolchain.ts
import { spawnSync as spawnSync2 } from "node:child_process";
import { join as join6 } from "node:path";
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
function editorVersionInfo(projectRoot) {
  const text = readText(join6(projectRoot, "ProjectSettings", "ProjectVersion.txt"));
  if (!text)
    return { version: null, revision: null };
  const version = text.match(/^\s*m_EditorVersion:\s*(\S+)\s*$/m)?.[1] ?? null;
  const revision = text.match(/^\s*m_EditorVersionWithRevision:\s*\S+\s*\(([0-9a-fA-F]+)\)/m)?.[1] ?? null;
  return { version, revision };
}
function unityVersionFromFile(projectRoot) {
  return editorVersionInfo(projectRoot).version;
}
function activeInputHandler(projectRoot) {
  const text = readText(join6(projectRoot, "ProjectSettings", "ProjectSettings.asset"));
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

// tools/unity/project-scan/src/unity-packages.ts
import { join as join7 } from "node:path";

// tools/shared/json-helpers.ts
function asRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}

// tools/shared/unity-manifest.ts
function readManifestDependencies(manifestPath) {
  if (!fileExists(manifestPath))
    return { present: false, malformed: false, dependencies: null };
  const dependencies = asRecord(asRecord(readJson(manifestPath))?.dependencies);
  if (!dependencies)
    return { present: true, malformed: true, dependencies: null };
  const out = {};
  for (const [name, version] of Object.entries(dependencies))
    out[name] = String(version);
  return { present: true, malformed: false, dependencies: out };
}

// tools/unity/project-scan/src/unity-packages.ts
function readUnityPackages(projectRoot, info) {
  const manifestPath = join7(projectRoot, "Packages", "manifest.json");
  const lockPath = join7(projectRoot, "Packages", "packages-lock.json");
  const manifest = readManifestDependencies(manifestPath);
  const lock = readJson(lockPath);
  const manifestDeps = manifest.dependencies ?? {};
  const lockDeps = lock?.dependencies ?? {};
  const map = {};
  if (info?.packages)
    Object.assign(map, info.packages);
  for (const [name, version] of Object.entries(manifestDeps)) {
    if (!(name in map))
      map[name] = String(version);
  }
  const names = Array.from(new Set([...Object.keys(manifestDeps), ...Object.keys(lockDeps)])).sort();
  const packages = names.map((name) => ({
    name,
    manifestVersion: name in manifestDeps ? String(manifestDeps[name]) : null,
    lockEntry: lockDeps[name] ?? null,
    manifestPath,
    lockPath,
    status: name in manifestDeps || name in lockDeps ? "observed_locally" : "unavailable"
  }));
  return {
    map,
    packages,
    manifestPath,
    lockPath,
    manifestHash: sha256(manifestPath),
    lockHash: sha256(lockPath),
    hasManifest: manifest.present,
    hasLock: fileExists(lockPath)
  };
}
function applySyntheticBuiltins(map, usesLegacyInput) {
  if (usesLegacyInput)
    map["com.unity.builtin.input_manager"] = "builtin";
  map["com.unity.builtin.camera"] = "builtin";
}

// tools/unity/project-scan/src/index.ts
async function main() {
  const opts = resolveOptions(process.argv.slice(2));
  const answers = loadAnswersFile(opts.answersFile);
  const prompts = new PromptClient({
    promptScript: opts.promptScript,
    answers,
    nonInteractive: opts.nonInteractive
  });
  const warnings = [];
  const paths = contextPaths(opts.contextDir);
  const projectName = await resolveProjectName(opts.projectRoot, prompts);
  const { foundProject, assetFolder } = await discoverAssetFolder(opts.projectRoot, prompts);
  const filetypes = loadFiletypes(paths.filetypes);
  let files = { folders: {}, filetypeToFolder: {}, codeFiles: [] };
  let inputUsage = { usesInputSystem: false, usesLegacyInput: false };
  if (foundProject && assetFolder) {
    files = discoverProjectFiles(opts.projectRoot, assetFolder, filetypes.filetypes);
    inputUsage = detectInputUsage(files.codeFiles);
  } else if (!foundProject) {
    warnings.push("No Assets folder found; treated as a non-Unity project.");
  }
  let toolchain = probeToolchain(opts.projectRoot);
  if (!toolchain.cliPath) {
    const help = await prompts.ask({
      title: "Unity CLI",
      questions: [
        {
          id: "wantCliHelp",
          type: "confirm",
          message: "The Unity CLI was not found on PATH. It lets the agents inspect the project, run tests, build, and capture the editor. Continue without it?",
          initialValue: true
        }
      ]
    });
    if (help.wantCliHelp !== true) {
      const pathAnswer = await prompts.ask({
        title: "Unity CLI path",
        questions: [{ id: "cliPath", type: "text", message: "Path to the unity CLI executable" }]
      });
      const cliPath = String(pathAnswer.cliPath || "").trim();
      if (cliPath)
        toolchain = { ...probeToolchain(opts.projectRoot, cliPath), cliPath };
    }
  }
  const cliVer = toolchain.cliVer ?? null;
  const unityVer = toolchain.unityVer ?? null;
  const packagesResult = readUnityPackages(opts.projectRoot, toolchain.info);
  const handler = activeInputHandler(opts.projectRoot);
  const usesInputSystem = inputUsage.usesInputSystem || handler === 1 || handler === 2 || "com.unity.inputsystem" in packagesResult.map;
  const usesLegacyInput = inputUsage.usesLegacyInput || handler === 0 || handler === 2;
  applySyntheticBuiltins(packagesResult.map, usesLegacyInput);
  const installed = new Set(Object.keys(packagesResult.map));
  let pipelineVer = packagesResult.map["com.unity.pipeline"] ?? null;
  if (!pipelineVer && foundProject && !opts.nonInteractive) {
    const action = await prompts.ask({
      title: "Unity Pipeline package",
      questions: [
        {
          id: "pipelineAction",
          type: "select",
          message: "com.unity.pipeline is not installed. It unlocks Editor automation (commands, tests, builds) for the agents. Install it now via Window > Package Manager?",
          options: [
            { value: "wait", label: "I will install it now" },
            { value: "skip", label: "Skip for now" }
          ]
        }
      ]
    });
    if (action.pipelineAction === "wait") {
      await prompts.ask({
        title: "Unity Pipeline package",
        questions: [{ id: "pipelineReady", type: "confirm", message: "Let me know when you are ready.", initialValue: true }]
      });
      const refreshed = readUnityPackages(opts.projectRoot, toolchain.info);
      if (refreshed.map["com.unity.pipeline"]) {
        pipelineVer = refreshed.map["com.unity.pipeline"];
        Object.assign(packagesResult.map, refreshed.map);
      } else {
        warnings.push("com.unity.pipeline was still not found after the install step.");
      }
    }
  }
  const choices = loadPackageChoices(paths.packageChoices);
  const understood = loadUnderstoodPackages(paths.understoodPackages);
  const pkgResult = await runPackageChoices(choices, understood, installed, projectName, prompts);
  const patterns = loadPatterns(paths.patterns);
  const patternResult = await runPatternsInterview(patterns, prompts);
  warnings.push(...patternResult.warnings);
  const subResult = await runSubProjects(opts.projectRoot, projectName, prompts);
  const projectMeta = buildProjectJson({
    name: projectName,
    path: opts.projectRoot,
    info: toolchain.info,
    unityVer,
    env: toolchain.env,
    native: subResult.native,
    subProjects: subResult.subProjects
  });
  if (foundProject) {
    await prompts.ask({
      title: "Unity Editor",
      questions: [
        {
          id: "editorReady",
          type: "confirm",
          message: `Launch the Unity Editor for ${projectName}, then confirm to continue.`,
          initialValue: true
        }
      ]
    });
  }
  const unityContext = {
    status: "not-run",
    note: "Run the gather-unity-context ability for full Unity context."
  };
  const projectPref = {
    packageChoices: pkgResult.packageChoices,
    patterns: patternResult.patterns,
    deferredChoices: pkgResult.deferredChoices,
    usesInputSystem,
    usesLegacyInput
  };
  const nativeState = buildNativeState(opts.projectRoot, projectName, subResult.native);
  writeJson(join8(opts.projectDataDir, "unity-project.json"), {
    projectName,
    projectPath: opts.projectRoot,
    unityVersion: unityVer,
    cliVersion: cliVer,
    pipelineVersion: pipelineVer,
    foundProject,
    assetFolder
  });
  writeJson(join8(opts.projectDataDir, "unity-package-list.json"), {
    schemaVersion: 2,
    generatedAt: nowIso(),
    project: projectName,
    projectPath: opts.projectRoot,
    status: packagesResult.hasManifest ? "observed_locally" : "unavailable",
    files: {
      manifest: packagesResult.manifestPath,
      packagesLock: packagesResult.lockPath,
      manifestHash: packagesResult.manifestHash,
      packagesLockHash: packagesResult.lockHash
    },
    packages: packagesResult.packages
  });
  writeJson(join8(opts.projectDataDir, "native-project-state.json"), nativeState);
  writeJson(join8(opts.projectDataDir, "project-pref.json"), projectPref);
  writeJson(join8(opts.projectDataDir, "project-files.json"), {
    assetFolder,
    filetypeToFolder: files.filetypeToFolder,
    folders: files.folders
  });
  writeJson(join8(opts.interimDir, "unity-packages.json"), {
    generatedAt: nowIso(),
    source: "Packages/manifest.json + unity projects info",
    packages: packagesResult.map
  });
  writeJson(join8(opts.interimDir, "project.json"), projectMeta);
  const scanResult = {
    generatedAt: nowIso(),
    projectName,
    foundProject,
    assetFolder,
    unityCliVer: cliVer,
    unityVer,
    pipelineVer,
    unityEnv: toolchain.env,
    inputFlags: { usesInputSystem, usesLegacyInput },
    cancelled: prompts.isCancelled(),
    unityContext,
    paths: {
      projectDataDir: opts.projectDataDir,
      interimDir: opts.interimDir,
      unityProject: join8(opts.projectDataDir, "unity-project.json"),
      unityPackageList: join8(opts.projectDataDir, "unity-package-list.json"),
      nativeProjectState: join8(opts.projectDataDir, "native-project-state.json"),
      projectPref: join8(opts.projectDataDir, "project-pref.json"),
      projectFiles: join8(opts.projectDataDir, "project-files.json"),
      unityPackages: join8(opts.interimDir, "unity-packages.json"),
      project: join8(opts.interimDir, "project.json")
    },
    warnings
  };
  writeJson(join8(opts.projectDataDir, "scan-result.json"), scanResult);
  process.stdout.write(JSON.stringify(scanResult, null, 2) + `
`);
}
function buildNativeState(projectRoot, projectName, native) {
  if (!native) {
    return {
      schemaVersion: 1,
      generatedAt: nowIso(),
      project: projectName,
      projectPath: projectRoot,
      state: {
        status: "unavailable",
        solution: null,
        solutionExists: false,
        configuration: null,
        platform: null,
        artifacts: []
      }
    };
  }
  const abs = (p) => resolve3(projectRoot, p);
  return {
    schemaVersion: 1,
    generatedAt: nowIso(),
    project: projectName,
    projectPath: projectRoot,
    state: {
      status: native.status,
      solution: native.solution ? abs(native.solution) : null,
      solutionExists: native.solutionExists,
      configuration: native.configuration,
      platform: native.platform,
      artifacts: native.artifacts.map((a) => ({
        name: a.name,
        kind: a.kind,
        path: abs(a.path),
        exists: a.path ? fileExists(abs(a.path)) : false,
        pdb: a.pdb ? abs(a.pdb) : null,
        pdbExists: a.pdb ? fileExists(abs(a.pdb)) : false
      }))
    }
  };
}
main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`scan-project: ${message}
`);
  process.exitCode = 1;
});
