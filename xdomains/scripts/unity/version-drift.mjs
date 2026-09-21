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

// tools/unity/unity-version-drift/src/cli.ts
import { join as join2, resolve } from "node:path";

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
function parseBool(value, fallback) {
  if (value === undefined || value === null)
    return fallback;
  if (typeof value === "boolean")
    return value;
  const text = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(text))
    return true;
  if (["false", "0", "no", "off"].includes(text))
    return false;
  return fallback;
}

// tools/shared/io.ts
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, sep } from "node:path";
function fileExists(path) {
  try {
    return statSync(path).isFile();
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

// tools/unity/unity-version-drift/src/types.ts
var VERSION_DRIFT_ABILITY_NAMES = ["version-drift"];
var VERSION_DRIFT_ABILITIES = [...VERSION_DRIFT_ABILITY_NAMES];

// tools/unity/unity-version-drift/src/shared.ts
import { join } from "node:path";

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

// tools/unity/unity-version-drift/src/shared.ts
var BASELINE_DIR = "version-baselines";
var MAX_AGE_HOURS_DEFAULT = 24;
function baselineDir(options) {
  return join(options.opencodeDir, "project-data", BASELINE_DIR);
}
function baselineRelPath(file) {
  return `${BASELINE_DIR}/${file}`;
}
function makeResult(ability, status, summary, errors) {
  return makeEnvelope({ ability, family: "sense", mode: "both", route: "offline", status, summary, errors });
}

// tools/unity/unity-version-drift/src/cli.ts
function resolveOptions(argv) {
  const { values: args, positional } = parseArgs(argv);
  rejectPositionals(positional);
  const projectRoot = resolve(String(args["project-root"] || process.cwd()));
  const opencodeDir = resolve(String(args["opencode-dir"] || join2(projectRoot, ".opencode")));
  const ability = resolveAbility(String(args.ability || "version-drift"), VERSION_DRIFT_ABILITIES, "version-drift");
  const maxAgeHours = parseOptionalPositiveInt(firstString(args, ["max-age-hours", "maxAgeHours"])) ?? MAX_AGE_HOURS_DEFAULT;
  return {
    projectRoot,
    opencodeDir,
    ability,
    json: parseBool(args.json, false),
    list: parseBool(args.list, false),
    ifDue: parseBool(args["if-due"] ?? args.ifDue, false),
    maxAgeHours,
    now: firstString(args, ["now"]) ?? nowIso(),
    cliCommand: firstString(args, ["cli-command", "cliCommand"]) ?? "unity"
  };
}

// tools/unity/unity-version-drift/src/abilities.ts
import { mkdirSync as mkdirSync2, readdirSync, writeFileSync as writeFileSync2 } from "node:fs";
import { dirname as dirname2, join as join4, relative } from "node:path";

// tools/shared/toolchain.ts
import { spawnSync } from "node:child_process";
import { join as join3 } from "node:path";
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
function stripAnsi(text) {
  return text.replace(/\u001b\[[0-9;]*m/g, "");
}
function editorVersionInfo(projectRoot) {
  const text = readText(join3(projectRoot, "ProjectSettings", "ProjectVersion.txt"));
  if (!text)
    return { version: null, revision: null };
  const version = text.match(/^\s*m_EditorVersion:\s*(\S+)\s*$/m)?.[1] ?? null;
  const revision = text.match(/^\s*m_EditorVersionWithRevision:\s*\S+\s*\(([0-9a-fA-F]+)\)/m)?.[1] ?? null;
  return { version, revision };
}

// tools/unity/unity-version-drift/src/abilities.ts
var EDITOR_BASELINE = "unity-editor-version.txt";
var PACKAGE_BASELINE = "package-versions.json";
var CLI_VERSION_BASELINE = "unity-cli-version.txt";
var CLI_COMMANDS_BASELINE = "unity-cli-commands.json";
var LAST_RUN = "last-run.json";
var CLI_COMMAND_DOC_PATTERN = /unity\s+command\b/i;
var CLI_DOC_SKIP_DIRS = new Set(["node_modules", ".git", "scripts", "project-data", "dist", "Library", "Temp"]);
function nameOf(entry) {
  if (typeof entry === "string")
    return entry.trim() || null;
  const obj = asRecord(entry);
  if (!obj)
    return null;
  for (const key of ["name", "id", "path", "command"]) {
    const value = obj[key];
    if (typeof value === "string" && value.trim())
      return value.trim();
  }
  return null;
}
function commandNamesFrom(parsed) {
  const root = asRecord(parsed);
  const container = root?.data ?? root?.result ?? root?.commands ?? parsed;
  const entries = Array.isArray(container) ? container : asArray(asRecord(container)?.commands);
  const names = entries.map(nameOf).filter((name) => name !== null);
  const unique = Array.from(new Set(names)).sort();
  return unique.length > 0 ? unique : null;
}
var defaultCliProbe = {
  version(command) {
    if (!findExecutable(command))
      return { available: false, version: null };
    const res = run(command, ["--version"], { timeout: 1e4 });
    if (!res.ok)
      return { available: true, version: null };
    const text = stripAnsi(res.stdout || res.stderr).split(/\r?\n/)[0]?.trim() ?? "";
    return { available: true, version: text || null };
  },
  commands(command) {
    const res = run(command, ["command", "--format", "json", "--no-banner", "--quiet", "--non-interactive"], { timeout: 30000 });
    if (!res.ok || !res.stdout)
      return null;
    let parsed;
    try {
      parsed = JSON.parse(res.stdout);
    } catch {
      return null;
    }
    return commandNamesFrom(parsed);
  }
};
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}
function readBaselineText(path) {
  const text = readText(path);
  return text && text.trim() !== "" ? text.trim() : null;
}
function writeBaselineText(path, value) {
  mkdirSync2(dirname2(path), { recursive: true });
  writeFileSync2(path, value.endsWith(`
`) ? value : `${value}
`);
}
function readLastRun(path) {
  return str(asRecord(readJson(path)), "lastRunUtc");
}
function readPackageBaseline(path) {
  if (!fileExists(path))
    return { present: false, packages: null };
  const packages = asRecord(asRecord(readJson(path))?.packages);
  if (!packages)
    return { present: true, packages: null };
  const out = {};
  for (const [name, version] of Object.entries(packages))
    if (typeof version === "string")
      out[name] = version;
  return { present: true, packages: out };
}
function readCommandsBaseline(path) {
  if (!fileExists(path))
    return { present: false, commands: null };
  const raw = readJson(path);
  const arr = asRecord(raw)?.commands ?? (Array.isArray(raw) ? raw : undefined);
  if (!Array.isArray(arr))
    return { present: true, commands: null };
  return { present: true, commands: arr.filter((item) => typeof item === "string") };
}
function writeCommandsBaseline(options, commands, cliVersion) {
  writeJson(join4(baselineDir(options), CLI_COMMANDS_BASELINE), {
    schemaVersion: 1,
    generatedAt: options.now,
    cliVersion,
    commands: [...commands].sort()
  });
}
function computeCadence(options, lastRunUtc) {
  const nowMs = Date.parse(options.now);
  const lastMs = lastRunUtc ? Date.parse(lastRunUtc) : Number.NaN;
  const windowMs = options.maxAgeHours * 3600000;
  const hasValidLast = Number.isFinite(lastMs);
  const fresh = hasValidLast && Number.isFinite(nowMs) && nowMs - lastMs < windowMs;
  return {
    ifDue: options.ifDue,
    maxAgeHours: options.maxAgeHours,
    skipped: options.ifDue && fresh,
    lastRunUtc,
    nowUtc: options.now,
    nextDueUtc: hasValidLast ? new Date(lastMs + windowMs).toISOString() : null
  };
}
function detectEditor(options, errors) {
  const section = {
    status: "unknown",
    current: null,
    baseline: null,
    revision: null,
    updated: [],
    action: null
  };
  const info = editorVersionInfo(options.projectRoot);
  section.current = info.version;
  section.revision = info.revision;
  if (!info.version) {
    if (fileExists(join4(options.projectRoot, "ProjectSettings", "ProjectVersion.txt"))) {
      section.status = "unknown";
      errors.push("ProjectSettings/ProjectVersion.txt is present but has no m_EditorVersion line");
    } else {
      section.status = "unavailable";
    }
    return section;
  }
  const path = join4(baselineDir(options), EDITOR_BASELINE);
  const baseline = readBaselineText(path);
  section.baseline = baseline;
  if (baseline === null) {
    writeBaselineText(path, info.version);
    section.status = "baseline_created";
    section.updated.push(baselineRelPath(EDITOR_BASELINE));
  } else if (baseline === info.version) {
    section.status = "unchanged";
  } else {
    writeBaselineText(path, info.version);
    section.status = "changed";
    section.updated.push(baselineRelPath(EDITOR_BASELINE));
    section.action = `Review the Unity ${info.version} upgrade guide for breaking changes (deprecations, API removals, behaviour changes) and the project's deprecation checks.`;
  }
  return section;
}
function detectPackages(options, errors) {
  const section = {
    status: "unknown",
    count: null,
    added: [],
    removed: [],
    bumped: [],
    updated: [],
    action: null
  };
  const manifestPath = join4(options.projectRoot, "Packages", "manifest.json");
  if (!fileExists(manifestPath)) {
    section.status = "unavailable";
    return section;
  }
  const dependencies = asRecord(asRecord(readJson(manifestPath))?.dependencies);
  if (!dependencies) {
    section.status = "unknown";
    errors.push("Packages/manifest.json is malformed or has no dependencies object; baseline left untouched");
    return section;
  }
  const current = {};
  for (const [name, value] of Object.entries(dependencies))
    current[name] = String(value);
  section.count = Object.keys(current).length;
  const path = join4(baselineDir(options), PACKAGE_BASELINE);
  if (!fileExists(path)) {
    writeJson(path, { schemaVersion: 1, generatedAt: options.now, packages: current });
    section.status = "baseline_created";
    section.updated.push(baselineRelPath(PACKAGE_BASELINE));
    return section;
  }
  const baseline = readPackageBaseline(path);
  if (baseline.packages === null) {
    section.status = "unknown";
    errors.push(`version-baselines/${PACKAGE_BASELINE} is malformed; baseline left untouched`);
    return section;
  }
  const base = baseline.packages;
  section.added = Object.keys(current).filter((name) => !(name in base)).sort();
  section.removed = Object.keys(base).filter((name) => !(name in current)).sort();
  section.bumped = Object.keys(current).filter((name) => (name in base) && base[name] !== current[name]).sort().map((name) => ({ name, from: base[name], to: current[name] }));
  if (section.added.length === 0 && section.removed.length === 0 && section.bumped.length === 0) {
    section.status = "unchanged";
    return section;
  }
  writeJson(path, { schemaVersion: 1, generatedAt: options.now, packages: current });
  section.status = "changed";
  section.updated.push(baselineRelPath(PACKAGE_BASELINE));
  const pipelineChanged = [...section.added, ...section.removed, ...section.bumped.map((b) => b.name)].includes("com.unity.pipeline");
  if (pipelineChanged) {
    section.action = "Review the com.unity.pipeline changelog for breaking changes (detached jobs, eval timeout, /api/exec concurrency) before updating code that uses the Pipeline API.";
  }
  return section;
}
function cliActionText(section, from, to) {
  const added = section.commandsAdded.length > 0 ? section.commandsAdded.join(", ") : "(none)";
  const removed = section.commandsRemoved.length > 0 ? section.commandsRemoved.join(", ") : "(none)";
  const files = section.actionFiles.length > 0 ? ` Update: ${section.actionFiles.join(", ")}.` : "";
  return `Review CLI command catalog changes for ${from} → ${to} (new: ${added}; removed: ${removed}) and update context files/docs that enumerate Unity CLI commands.${files}`;
}
function detectCli(options, errors) {
  const section = {
    status: "unknown",
    available: false,
    current: null,
    baseline: null,
    commandsAdded: [],
    commandsRemoved: [],
    commandCount: null,
    actionFiles: [],
    updated: [],
    action: null
  };
  const probe = options.cliProbe ?? defaultCliProbe;
  const probeResult = probe.version(options.cliCommand);
  section.available = probeResult.available;
  if (!probeResult.available) {
    section.status = "unavailable";
    return section;
  }
  if (!probeResult.version) {
    section.status = "unknown";
    errors.push(`could not read \`${options.cliCommand} --version\``);
    return section;
  }
  section.current = probeResult.version;
  const versionPath = join4(baselineDir(options), CLI_VERSION_BASELINE);
  const baseline = readBaselineText(versionPath);
  section.baseline = baseline;
  if (baseline === null) {
    writeBaselineText(versionPath, probeResult.version);
    section.status = "baseline_created";
    section.updated.push(baselineRelPath(CLI_VERSION_BASELINE));
    const commands = probe.commands(options.cliCommand);
    if (commands) {
      writeCommandsBaseline(options, commands, probeResult.version);
      section.commandCount = commands.length;
      section.updated.push(baselineRelPath(CLI_COMMANDS_BASELINE));
    } else {
      errors.push("could not capture the Unity command catalog; version baseline recorded");
    }
    return section;
  }
  if (baseline === probeResult.version) {
    section.status = "unchanged";
    return section;
  }
  writeBaselineText(versionPath, probeResult.version);
  section.status = "changed";
  section.updated.push(baselineRelPath(CLI_VERSION_BASELINE));
  const commands = probe.commands(options.cliCommand);
  if (!commands) {
    errors.push("Unity CLI version changed but the command catalog could not be captured; review the CLI release notes manually");
    section.action = `Review CLI command catalog changes for ${baseline} → ${probeResult.version} and update context files/docs that enumerate Unity CLI commands.`;
    return section;
  }
  const base = readCommandsBaseline(join4(baselineDir(options), CLI_COMMANDS_BASELINE));
  const baselineCommands = base.commands ?? [];
  const currentSet = new Set(commands);
  const baseSet = new Set(baselineCommands);
  section.commandsAdded = commands.filter((command) => !baseSet.has(command)).sort();
  section.commandsRemoved = baselineCommands.filter((command) => !currentSet.has(command)).sort();
  section.commandCount = commands.length;
  writeCommandsBaseline(options, commands, probeResult.version);
  section.updated.push(baselineRelPath(CLI_COMMANDS_BASELINE));
  section.actionFiles = findCliCommandDocs(options.opencodeDir);
  section.action = cliActionText(section, baseline, probeResult.version);
  return section;
}
function findCliCommandDocs(root, limit = 25) {
  const found = [];
  const walk = (dir, depth) => {
    if (found.length >= limit || depth > 6)
      return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (found.length >= limit)
        return;
      if (entry.isDirectory()) {
        if (!CLI_DOC_SKIP_DIRS.has(entry.name))
          walk(join4(dir, entry.name), depth + 1);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".md"))
        continue;
      const full = join4(dir, entry.name);
      const text = readText(full);
      if (text && CLI_COMMAND_DOC_PATTERN.test(text))
        found.push(toPosix(relative(root, full)));
    }
  };
  walk(root, 0);
  return found.sort();
}
function emptyEditor() {
  return { status: "not_checked", current: null, baseline: null, revision: null, updated: [], action: null };
}
function emptyPackages() {
  return { status: "not_checked", count: null, added: [], removed: [], bumped: [], updated: [], action: null };
}
function emptyCli() {
  return {
    status: "not_checked",
    available: false,
    current: null,
    baseline: null,
    commandsAdded: [],
    commandsRemoved: [],
    commandCount: null,
    actionFiles: [],
    updated: [],
    action: null
  };
}
function isObserved(status) {
  return status === "unchanged" || status === "changed" || status === "baseline_created";
}
function overallStatus(editor, packages, cli) {
  return isObserved(editor.status) || isObserved(packages.status) || isObserved(cli.status) ? "observed_locally" : "unavailable";
}
function summarize(status, editor, packages, cli) {
  if (status === "unavailable")
    return "No Unity project files found under the project root";
  const changes = [];
  if (editor.status === "changed")
    changes.push(`Editor ${editor.baseline} → ${editor.current}`);
  if (packages.status === "changed") {
    changes.push(`${packages.added.length + packages.removed.length + packages.bumped.length} package change(s)`);
  }
  if (cli.status === "changed")
    changes.push(`CLI ${cli.baseline} → ${cli.current}`);
  if (changes.length === 0)
    return `No version drift (Editor ${editor.current ?? "unknown"})`;
  return `Version drift detected: ${changes.join("; ")}`;
}
function renderEditor(section) {
  const lines = [];
  switch (section.status) {
    case "unchanged":
      lines.push(`[Editor] No change (${section.current})`);
      break;
    case "baseline_created":
      lines.push(`[Editor] Baseline created: ${section.current}`);
      break;
    case "changed":
      lines.push(`[Editor] Version changed: ${section.baseline} → ${section.current}`);
      break;
    case "unavailable":
      lines.push("[Editor] unavailable — no ProjectSettings/ProjectVersion.txt");
      break;
    default:
      lines.push("[Editor] unknown — ProjectVersion.txt present but unreadable");
      break;
  }
  for (const file of section.updated)
    lines.push(`  → Updated ${file}`);
  if (section.action)
    lines.push(`  → ACTION REQUIRED: ${section.action}`);
  return lines;
}
function renderPackages(section) {
  const lines = [];
  switch (section.status) {
    case "unchanged":
      lines.push(`[Packages] No change (${section.count} package(s))`);
      break;
    case "baseline_created":
      lines.push(`[Packages] Baseline created (${section.count} package(s))`);
      break;
    case "changed": {
      const total = section.added.length + section.removed.length + section.bumped.length;
      lines.push(`[Packages] ${total} package(s) changed:`);
      for (const name of section.added)
        lines.push(`  - ${name}: (added)`);
      for (const name of section.removed)
        lines.push(`  - ${name}: (removed)`);
      for (const bump of section.bumped)
        lines.push(`  - ${bump.name}: ${bump.from} → ${bump.to}`);
      break;
    }
    case "unavailable":
      lines.push("[Packages] unavailable — no Packages/manifest.json");
      break;
    default:
      lines.push("[Packages] unknown — Packages/manifest.json is malformed");
      break;
  }
  for (const file of section.updated)
    lines.push(`  → Updated ${file}`);
  if (section.action)
    lines.push(`  → ACTION REQUIRED: ${section.action}`);
  return lines;
}
function renderCli(section) {
  const lines = [];
  switch (section.status) {
    case "unchanged":
      lines.push(`[CLI] No change (${section.current})`);
      break;
    case "baseline_created":
      lines.push(`[CLI] Baseline created: ${section.current}`);
      break;
    case "changed":
      lines.push(`[CLI] Version changed: ${section.baseline} → ${section.current}`);
      lines.push(`  - New commands detected: ${section.commandsAdded.length > 0 ? section.commandsAdded.join(", ") : "(none)"}`);
      lines.push(`  - Removed commands: ${section.commandsRemoved.length > 0 ? section.commandsRemoved.join(", ") : "(none)"}`);
      break;
    case "unavailable":
      lines.push("[CLI] unavailable — no `unity` on PATH");
      break;
    default:
      lines.push("[CLI] unknown — `unity --version` did not return a version");
      break;
  }
  for (const file of section.updated)
    lines.push(`  → Updated ${file}`);
  if (section.action)
    lines.push(`  → ACTION REQUIRED: ${section.action}`);
  return lines;
}
function renderReport(result) {
  const lines = ["=== Session-Start Version Check ===", ""];
  if (result.cadence.skipped) {
    lines.push(`Not due — last run ${result.cadence.lastRunUtc} is within ${result.cadence.maxAgeHours}h.`);
    return lines.join(`
`);
  }
  lines.push(...renderEditor(result.editor), ...renderPackages(result.packages), ...renderCli(result.cli));
  return lines.join(`
`);
}
function runVersionDrift(options) {
  const errors = [];
  const dir = baselineDir(options);
  const lastRunUtc = readLastRun(join4(dir, LAST_RUN));
  const cadence = computeCadence(options, lastRunUtc);
  if (cadence.skipped) {
    const skipped = {
      ...makeResult(options.ability, "skipped", `not due; last run ${lastRunUtc}`, errors),
      cadence,
      editor: emptyEditor(),
      packages: emptyPackages(),
      cli: emptyCli(),
      actions: [],
      baselinesUpdated: [],
      report: ""
    };
    skipped.report = renderReport(skipped);
    return skipped;
  }
  const editor = detectEditor(options, errors);
  const packages = detectPackages(options, errors);
  const cli = detectCli(options, errors);
  try {
    writeJson(join4(dir, LAST_RUN), { schemaVersion: 1, lastRunUtc: options.now });
  } catch (error) {
    errors.push(`could not record last-run: ${messageOf(error)}`);
  }
  const actions = [editor.action, packages.action, cli.action].filter((action) => action !== null);
  const baselinesUpdated = [...editor.updated, ...packages.updated, ...cli.updated];
  const status = overallStatus(editor, packages, cli);
  const result = {
    ...makeResult(options.ability, status, summarize(status, editor, packages, cli), errors),
    cadence,
    editor,
    packages,
    cli,
    actions,
    baselinesUpdated,
    report: ""
  };
  result.report = renderReport(result);
  return result;
}

// tools/unity/unity-version-drift/src/index.ts
function render(result) {
  return result.report;
}
runCli({ abilities: VERSION_DRIFT_ABILITIES, resolveOptions, run: runVersionDrift, render });
