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

// tools/unity/unity-sense/src/cli.ts
import { join, resolve } from "node:path";

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

// tools/unity/unity-sense/src/types.ts
var SENSE_ABILITY_NAMES = [
  "project-status",
  "asset-intelligence",
  "offline-project-inspection",
  "unity-api-lookup",
  "platform-info",
  "code-navigation"
];
var SENSE_ABILITIES = [...SENSE_ABILITY_NAMES];

// tools/unity/unity-sense/src/cli.ts
function resolveOptions(argv) {
  const { values: args, positional } = parseArgs(argv);
  rejectPositionals(positional);
  const projectRoot = resolve(String(args["project-root"] || process.cwd()));
  const opencodeDir = resolve(String(args["opencode-dir"] || join(projectRoot, ".opencode")));
  const requested = String(args.ability || "project-status");
  const ability = resolveAbility(requested, SENSE_ABILITIES, "project-status");
  const tableDir = firstString(args, ["table-dir", "tableDir"]);
  const assetFolder = firstString(args, ["asset-folder", "assetFolder"]);
  return {
    projectRoot,
    opencodeDir,
    ability,
    query: firstString(args, ["query"]),
    json: Boolean(args.json),
    list: Boolean(args.list),
    tableDir: tableDir ? resolve(tableDir) : undefined,
    assetFolder: assetFolder ? resolve(assetFolder) : undefined
  };
}

// tools/unity/unity-sense/src/abilities.ts
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
function nowIso() {
  return new Date().toISOString();
}
function unique(values) {
  return Array.from(new Set(values));
}
function toPosix(path) {
  return path.split(sep).join("/");
}

// tools/unity/unity-sense/src/code-navigation.ts
import { readdirSync as readdirSync2 } from "node:fs";
import { dirname as dirname3, isAbsolute as isAbsolute2, join as join4, relative as relative2 } from "node:path";

// tools/unity/gather-unity-context/src/offline.ts
import { readdirSync, statSync as statSync2 } from "node:fs";
import { basename, dirname as dirname2, isAbsolute, join as join2, relative } from "node:path";

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

// tools/unity/gather-unity-context/src/offline.ts
var OFFLINE_ROUTE = selectRoute({ live: null, cliAvailable: false }).route;
function makeBase(status, errors = []) {
  return { schemaVersion: 1, generatedAt: nowIso(), status, route: OFFLINE_ROUTE, errors };
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
      const full = join2(dir, entry.name);
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
function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
function ownerAsmdef(dir, dirs) {
  let current = dir;
  for (;; ) {
    const owner = dirs.find((entry) => entry.dir === current);
    if (owner)
      return owner;
    const parent = dirname2(current);
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
    byPath.set(file, { json, dir: dirname2(file), name });
    const guid = readText(`${file}.meta`)?.match(/guid:\s*([0-9a-fA-F]{32})/);
    if (guid)
      guidToName.set(guid[1].toLowerCase(), name);
  }
  const names = new Set([...byPath.values()].map((entry) => entry.name));
  const dirs = [...byPath.entries()].map(([path, entry]) => ({ path, ...entry }));
  const ivtByAsmdef = new Map;
  for (const cs of walkFiles(assetFolder, (name) => name.toLowerCase().endsWith(".cs"))) {
    const owner = ownerAsmdef(dirname2(cs), dirs);
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
function num(obj, key) {
  const value = obj?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function bool(obj, key) {
  const value = obj?.[key];
  return typeof value === "boolean" ? value : null;
}
function stringArray2(obj, key) {
  const value = obj?.[key];
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

// tools/unity/unity-sense/src/shared.ts
import { join as join3 } from "node:path";

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

// tools/unity/unity-sense/src/shared.ts
function projectDataDir(options) {
  return join3(options.opencodeDir, "project-data");
}
function makeResult(ability, status, summary, errors) {
  return {
    ...makeEnvelope({ ability, family: "sense", mode: "offline", status, summary, errors }),
    route: "offline"
  };
}

// tools/unity/unity-sense/src/code-navigation.ts
var MAX_MATCHES = 200;
var WALK_EXCLUDES2 = new Set([
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
function walkFiles2(root, match, maxDepth = 16) {
  const out = [];
  const walk = (dir, depth) => {
    if (depth > maxDepth)
      return;
    let entries;
    try {
      entries = readdirSync2(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join4(dir, entry.name);
      if (entry.isDirectory()) {
        if (WALK_EXCLUDES2.has(entry.name.toLowerCase()))
          continue;
        walk(full, depth + 1);
        continue;
      }
      if (entry.isFile() && match(entry.name))
        out.push(full);
    }
  };
  walk(root, 0);
  return out;
}
var DECL_PATTERNS = [
  { kind: "namespace", re: /\bnamespace\s+([A-Za-z_][A-Za-z0-9_.]*)/ },
  { kind: "type", re: /\b(?:class|struct|interface|enum|record)\s+([A-Za-z_][A-Za-z0-9_]*)/ },
  {
    kind: "method",
    re: /^\s*(?:\[[^\]]*\]\s*)*(?:public|private|protected|internal)\s+(?:static\s+|virtual\s+|override\s+|sealed\s+|async\s+|partial\s+|abstract\s+|extern\s+|unsafe\s+|new\s+)*(?:[A-Za-z0-9_<>,\[\]\.\?]+\s+)+([A-Za-z_][A-Za-z0-9_]*)\s*\(/
  },
  {
    kind: "member",
    re: /^\s*(?:public|private|protected|internal)\s+(?:static\s+|readonly\s+|const\s+|volatile\s+|new\s+)*(?:[A-Za-z0-9_<>,\[\]\.\?]+\s+)+([A-Za-z_][A-Za-z0-9_]*)\s*[;={]/
  }
];
function resolveAssetFolder(options) {
  if (options.assetFolder)
    return { assetFolder: options.assetFolder, source: "option" };
  const scan = asRecord(readJson(join4(projectDataDir(options), "scan-result.json")));
  const folder = str(scan, "assetFolder");
  if (folder) {
    return { assetFolder: isAbsolute2(folder) ? folder : join4(options.projectRoot, folder), source: "scan-result.json" };
  }
  return { assetFolder: join4(options.projectRoot, "Assets"), source: "default" };
}
function codeNavigation(options) {
  const { assetFolder, source: assetFolderSource } = resolveAssetFolder(options);
  const asmdefMap = produceAsmdefMap({ projectRoot: options.projectRoot, assetFolder, opencodeDir: options.opencodeDir });
  const dirs = asmdefMap.assemblies.map((assembly) => {
    const full = isAbsolute2(assembly.path) ? assembly.path : join4(options.projectRoot, assembly.path);
    return { name: assembly.name, dir: toPosix(dirname3(full)) };
  });
  const ownerAssembly = (file) => {
    let current = toPosix(dirname3(file));
    for (;; ) {
      const found = dirs.find((entry) => entry.dir === current);
      if (found)
        return found.name;
      const parent = dirname3(current);
      if (parent === current)
        return null;
      current = parent;
    }
  };
  const query = options.query?.trim() ? options.query.trim().toLowerCase() : null;
  const files = walkFiles2(assetFolder, (name) => name.toLowerCase().endsWith(".cs"));
  const matches = [];
  let scannedFiles = 0;
  let symbolCount = 0;
  let truncated = false;
  let stoppedAtFile = null;
  outer:
    for (const file of files) {
      const text = readText(file);
      if (text === null)
        continue;
      scannedFiles++;
      const rel = toPosix(relative2(options.projectRoot, file));
      const assembly = ownerAssembly(file);
      const lines = text.split(/\r?\n/);
      for (let index = 0;index < lines.length; index++) {
        const line = lines[index];
        for (const pattern of DECL_PATTERNS) {
          const match = pattern.re.exec(line);
          if (!match)
            continue;
          symbolCount++;
          if (query && !match[1].toLowerCase().includes(query))
            continue;
          if (matches.length >= MAX_MATCHES) {
            truncated = true;
            stoppedAtFile = rel;
            break outer;
          }
          matches.push({ symbol: match[1], kind: pattern.kind, file: rel, line: index + 1, text: line.trim(), assembly });
        }
      }
    }
  const status = !dirExists(assetFolder) ? "unknown" : scannedFiles === 0 ? "unavailable" : "observed_locally";
  const result = {
    ...makeResult("code-navigation", status, "Offline symbol/declaration lookup over project source", []),
    assetFolder: toPosix(assetFolder),
    assetFolderSource,
    query: options.query?.trim() || null,
    scannedFiles,
    symbolCount,
    matchCount: matches.length,
    truncated,
    stoppedAtFile,
    assemblies: {
      count: asmdefMap.assemblyCount,
      testCount: asmdefMap.testAssemblyCount,
      names: unique(asmdefMap.assemblies.map((assembly) => assembly.name))
    },
    matches
  };
  result.summary = result.query ? `${matches.length} declaration(s) for "${result.query}" across ${scannedFiles} file(s)` : `${symbolCount} declaration(s) across ${scannedFiles} file(s)`;
  return result;
}

// tools/unity/unity-sense/src/tables.ts
import { dirname as dirname4, join as join5 } from "node:path";
import { fileURLToPath } from "node:url";
function moduleDir() {
  return dirname4(fileURLToPath(import.meta.url));
}
function contextTableCandidates(file) {
  const here = moduleDir();
  return [
    join5(here, "..", "..", "context", "unity", file),
    join5(here, "..", "..", "..", "..", "xdomains", "context", "unity", file)
  ];
}
function loadContextTable(file, overridePath) {
  const candidates = overridePath ? [overridePath] : contextTableCandidates(file);
  for (const path of candidates) {
    const data = readJson(path);
    if (data)
      return { data, path: toPosix(path), source: "bundle" };
  }
  return { data: null, path: null, source: "missing" };
}
function loadApiQuickref(overridePath) {
  return loadContextTable("unity-api-quickref.json", overridePath);
}
function loadPlatformDefines(overridePath) {
  return loadContextTable("platform-defines.json", overridePath);
}

// tools/unity/unity-sense/src/abilities.ts
function readData(dataDir, file) {
  return asRecord(readJson(join6(dataDir, file)));
}
function present(entries) {
  return Object.fromEntries(Object.entries(entries).map(([key, value]) => [key, value !== null]));
}
function anyPresent(flags) {
  return Object.values(flags).some(Boolean);
}
function statusFromFlags(flags) {
  return anyPresent(flags) ? "observed_locally" : "unavailable";
}
function projectStatus(options) {
  const dataDir = projectDataDir(options);
  const scan = readData(dataDir, "scan-result.json");
  const project = readData(dataDir, "unity-project.json");
  const gate = readData(dataDir, "gate-state.json");
  const compile = readData(dataDir, "compile-state.json");
  const structure = readData(dataDir, "project-structure.json");
  const packages = readData(dataDir, "unity-package-list.json");
  const sources = present({ scanResult: scan, unityProject: project, gateState: gate, compileState: compile, projectStructure: structure, packageList: packages });
  const counts = asRecord(structure?.counts) ?? {};
  const numericCounts = {};
  for (const [key, value] of Object.entries(counts))
    if (typeof value === "number")
      numericCounts[key] = value;
  const identity = {
    projectName: str(project, "projectName") ?? str(scan, "projectName"),
    projectPath: str(project, "projectPath") ?? str(scan, "projectPath"),
    unityVersion: str(project, "unityVersion") ?? str(scan, "unityVer"),
    cliVersion: str(project, "cliVersion") ?? str(scan, "unityCliVer"),
    pipelineVersion: str(project, "pipelineVersion") ?? str(scan, "pipelineVer"),
    foundProject: bool(project, "foundProject") ?? bool(scan, "foundProject"),
    assetFolder: str(project, "assetFolder") ?? str(scan, "assetFolder")
  };
  const result = {
    ...makeResult("project-status", statusFromFlags(sources), "Aggregated identity, compile and gate state", []),
    identity,
    compile: {
      status: str(compile, "status"),
      stale: bool(compile, "stale"),
      noOpRecompile: bool(compile, "noOpRecompile"),
      assemblyCount: num(compile, "assemblyCount")
    },
    gate: {
      gateResult: str(gate, "gateResult"),
      hardFailures: num(gate, "hardFailures"),
      reviewRequired: num(gate, "reviewRequired"),
      fingerprint: str(gate, "fingerprint"),
      lastVerificationUtc: str(gate, "lastVerificationUtc"),
      route: str(asRecord(gate?.routing), "route")
    },
    structure: {
      totalAssets: Object.values(numericCounts).reduce((sum, value) => sum + value, 0),
      counts: numericCounts,
      thirdPartyFolderCount: asArray(structure?.thirdPartyFolders).length
    },
    packages: { status: str(packages, "status"), count: asArray(packages?.packages).length },
    sources
  };
  result.summary = result.identity.projectName ? `${result.identity.projectName} · Unity ${result.identity.unityVersion ?? "unknown"} · gate ${result.gate.gateResult ?? "not_run"}` : "No Unity project data found under .opencode/project-data";
  return result;
}
function assetIntelligence(options) {
  const dataDir = projectDataDir(options);
  const structure = readData(dataDir, "project-structure.json");
  const packages = readData(dataDir, "unity-package-list.json");
  const files = readData(dataDir, "project-files.json");
  const pref = readData(dataDir, "project-pref.json");
  const settings = readData(dataDir, "project-settings.json");
  const asmdef = readData(dataDir, "asmdef-map.json");
  const sources = present({ projectStructure: structure, packageList: packages, projectFiles: files, projectPref: pref, projectSettings: settings, asmdefMap: asmdef });
  const counts = asRecord(structure?.counts) ?? {};
  const assetCounts = {};
  for (const [key, value] of Object.entries(counts))
    if (typeof value === "number")
      assetCounts[key] = value;
  const packageEntries = asArray(packages?.packages).map(asRecord).filter((entry) => entry !== null);
  const names = packageEntries.map((entry) => str(entry, "name")).filter((name) => name !== null);
  const usesInputSystem = bool(pref, "usesInputSystem");
  const usesLegacyInput = bool(pref, "usesLegacyInput");
  const activeInputHandlerName = str(settings, "activeInputHandlerName");
  const targetPlatform = str(settings, "targetPlatform");
  const il2cpp = bool(settings, "il2cpp");
  const colorSpace = str(settings, "colorSpace");
  const testAssemblyCount = num(asmdef, "testAssemblyCount");
  const signals = [];
  const inputSystem = usesInputSystem ?? (activeInputHandlerName === "Input System Package (New)" || activeInputHandlerName === "Both");
  if (inputSystem)
    signals.push("uses the Input System package");
  if (usesLegacyInput || activeInputHandlerName === "Input Manager (Old)" || activeInputHandlerName === "Both")
    signals.push("uses the legacy Input Manager");
  if (il2cpp)
    signals.push("IL2CPP scripting backend");
  if (targetPlatform)
    signals.push(`target platform ${targetPlatform}`);
  if (testAssemblyCount != null && testAssemblyCount > 0)
    signals.push(`${testAssemblyCount} test assembly/ies`);
  if (assetCounts.sprites)
    signals.push(`${assetCounts.sprites} sprite(s)`);
  if (assetCounts.prefabs)
    signals.push(`${assetCounts.prefabs} prefab(s)`);
  const result = {
    ...makeResult("asset-intelligence", statusFromFlags(sources), "Asset usage deduced from structure, packages and preferences", []),
    assetCounts,
    totalAssets: Object.values(assetCounts).reduce((sum, value) => sum + value, 0),
    thirdPartyFolders: stringArray2(structure, "thirdPartyFolders"),
    packages: { status: str(packages, "status"), count: packageEntries.length, names },
    input: { usesInputSystem, usesLegacyInput, activeInputHandlerName },
    platform: { targetPlatform, il2cpp, colorSpace },
    assemblies: { testAssemblyCount },
    signals,
    sources
  };
  result.summary = `${result.totalAssets} asset(s) across ${Object.keys(assetCounts).length} categor(ies), ${packageEntries.length} package(s)`;
  return result;
}
function offlineProjectInspection(options) {
  const dataDir = projectDataDir(options);
  const compile = readData(dataDir, "compile-state.json");
  const logs = readData(dataDir, "log-digest.json");
  const settings = readData(dataDir, "project-settings.json");
  const asmdef = readData(dataDir, "asmdef-map.json");
  const tests = readData(dataDir, "test-inventory.json");
  const deprecations = readData(dataDir, "deprecation-scan.json");
  const sources = present({ compileState: compile, logDigest: logs, projectSettings: settings, asmdefMap: asmdef, testInventory: tests, deprecationScan: deprecations });
  const newestScript = asRecord(compile?.newestScript);
  const latestResult = asRecord(tests?.latestResult);
  const byPattern = {};
  const rawByPattern = asRecord(deprecations?.byPattern) ?? {};
  for (const [key, value] of Object.entries(rawByPattern))
    if (typeof value === "number")
      byPattern[key] = value;
  const result = {
    ...makeResult("offline-project-inspection", statusFromFlags(sources), "Digest of the six offline Phase 2a readers", []),
    compile: {
      status: str(compile, "status"),
      stale: bool(compile, "stale"),
      noOpRecompile: bool(compile, "noOpRecompile"),
      assemblyCount: num(compile, "assemblyCount"),
      newestScript: str(newestScript, "path")
    },
    logs: { status: str(logs, "status"), errorCount: num(logs, "errorCount"), warningCount: num(logs, "warningCount") },
    settings: {
      editorVersion: str(settings, "editorVersion"),
      productName: str(settings, "productName"),
      targetPlatform: str(settings, "targetPlatform"),
      activeInputHandlerName: str(settings, "activeInputHandlerName"),
      il2cpp: bool(settings, "il2cpp")
    },
    assemblies: { assemblyCount: num(asmdef, "assemblyCount"), testAssemblyCount: num(asmdef, "testAssemblyCount") },
    tests: { testAssemblyCount: num(tests, "testAssemblyCount"), latestResult: str(latestResult, "result") },
    deprecations: { findingCount: num(deprecations, "findingCount"), byPattern },
    sources
  };
  result.summary = `compile ${result.compile.status ?? "unknown"} · ${result.logs.errorCount ?? "?"} error(s) · ${result.deprecations.findingCount ?? "?"} deprecation(s)`;
  return result;
}
function matchesQuery(value, query) {
  return value.toLowerCase().includes(query.toLowerCase());
}
function unityApiLookup(options) {
  const load = loadApiQuickref(options.tableDir);
  const entries = load.data?.entries ?? [];
  const query = options.query?.trim() ? options.query.trim() : null;
  const matches = query ? entries.filter((entry) => matchesQuery(entry.symbol, query) || entry.namespace != null && matchesQuery(entry.namespace, query) || matchesQuery(entry.summary, query) || entry.replacement != null && matchesQuery(entry.replacement, query)) : entries;
  const status = entries.length === 0 ? "unavailable" : matches.length > 0 || query === null ? "observed_locally" : "unknown";
  const result = {
    ...makeResult("unity-api-lookup", status, "Offline Unity API quick reference lookup", []),
    table: { source: load.source, path: load.path, entryCount: entries.length },
    query,
    matchCount: matches.length,
    matches
  };
  result.summary = query ? `${matches.length} API match(es) for "${query}"` : `${entries.length} API entry/ies in the quick reference`;
  if (load.source === "missing")
    result.errors.push("unity-api-quickref.json not found");
  return result;
}
function platformInfo(options) {
  const load = loadPlatformDefines(options.tableDir);
  const platforms = load.data?.platforms ?? [];
  const versionDefines = load.data?.versionDefines ?? [];
  const query = options.query?.trim() ? options.query.trim() : null;
  const matchedPlatforms = query ? platforms.filter((platform) => matchesQuery(platform.name, query) || platform.displayName != null && matchesQuery(platform.displayName, query) || matchesQuery(platform.buildTarget, query) || platform.defines.some((define) => matchesQuery(define, query))) : platforms;
  const matchedDefines = query ? versionDefines.filter((entry) => matchesQuery(entry.define, query)) : versionDefines;
  const settings = readData(projectDataDir(options), "project-settings.json");
  const targetPlatform = str(settings, "targetPlatform");
  const scriptingBackendRaw = asRecord(settings?.scriptingBackend) ?? {};
  const scriptingBackend = {};
  for (const [key, value] of Object.entries(scriptingBackendRaw))
    if (typeof value === "string")
      scriptingBackend[key] = value;
  const active = targetPlatform ? platforms.find((platform) => platform.buildTarget === targetPlatform) : undefined;
  const activeDefines = active?.defines ?? [];
  const found = matchedPlatforms.length > 0 || matchedDefines.length > 0;
  const status = platforms.length === 0 && versionDefines.length === 0 ? "unavailable" : found || query === null ? "observed_locally" : "unknown";
  const result = {
    ...makeResult("platform-info", status, "Offline platform/build-target defines lookup", []),
    table: {
      source: load.source,
      path: load.path,
      platformCount: platforms.length,
      versionDefineCount: versionDefines.length
    },
    query,
    platforms: matchedPlatforms,
    versionDefines: matchedDefines,
    project: {
      targetPlatform,
      activeInputHandlerName: str(settings, "activeInputHandlerName"),
      scriptingBackend,
      il2cpp: bool(settings, "il2cpp")
    },
    activeDefines
  };
  result.summary = query ? `${matchedPlatforms.length} platform(s), ${matchedDefines.length} version define(s) for "${query}"` : `${platforms.length} platform(s), ${versionDefines.length} version define(s)`;
  if (load.source === "missing")
    result.errors.push("platform-defines.json not found");
  return result;
}
function runSense(options) {
  switch (options.ability) {
    case "project-status":
      return projectStatus(options);
    case "asset-intelligence":
      return assetIntelligence(options);
    case "offline-project-inspection":
      return offlineProjectInspection(options);
    case "unity-api-lookup":
      return unityApiLookup(options);
    case "platform-info":
      return platformInfo(options);
    case "code-navigation":
      return codeNavigation(options);
    default: {
      const exhaustive = options.ability;
      throw new Error(`unsupported Sense ability: ${String(exhaustive)}`);
    }
  }
}

// tools/unity/unity-sense/src/index.ts
function render(result) {
  const lines = [`[${result.ability}] ${result.status} — ${result.summary}`];
  for (const error of result.errors)
    lines.push(`  error: ${error}`);
  return lines.join(`
`);
}
runCli({ abilities: SENSE_ABILITIES, resolveOptions, run: runSense, render });
