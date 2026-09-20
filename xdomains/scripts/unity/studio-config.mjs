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

// tools/unity/studio-config/src/cli.ts
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

// tools/shared/context-files.ts
import { join } from "node:path";

// tools/shared/io.ts
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
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
function unique(values) {
  return Array.from(new Set(values));
}

// tools/shared/context-files.ts
var PATTERN_CATALOG_FILENAME = "programming-patterns.json";
function patternCatalogCandidates(search) {
  const candidates = [];
  if (search.contextDir)
    candidates.push(join(search.contextDir, PATTERN_CATALOG_FILENAME));
  if (search.domainDir) {
    candidates.push(join(search.domainDir, "..", "..", "context", PATTERN_CATALOG_FILENAME));
  }
  if (search.moduleDir) {
    candidates.push(join(search.moduleDir, "..", "..", "context", PATTERN_CATALOG_FILENAME));
    candidates.push(join(search.moduleDir, "..", "..", "..", "..", "xdomains", "context", PATTERN_CATALOG_FILENAME));
  }
  if (search.opencodeDir) {
    candidates.push(join(search.opencodeDir, "xdomains", "context", PATTERN_CATALOG_FILENAME));
    candidates.push(join(search.opencodeDir, "..", "xdomains", "context", PATTERN_CATALOG_FILENAME));
  }
  return candidates;
}
function findPatternCatalog(search) {
  return patternCatalogCandidates(search).find((candidate) => fileExists(candidate)) ?? null;
}

// tools/unity/studio-config/src/cli.ts
function findCatalog(opencodeDir) {
  return findPatternCatalog({ opencodeDir });
}
function resolveOptions(argv) {
  const { values: args, positional } = parseArgs(argv);
  rejectPositionals(positional);
  const opencodeDir = resolve(String(args["opencode-dir"] || ".opencode"));
  const configArg = firstString(args, ["config"]);
  const catalogArg = firstString(args, ["catalog"]);
  return {
    list: Boolean(args.list),
    json: Boolean(args.json),
    opencodeDir,
    configPath: configArg ? resolve(configArg) : join2(opencodeDir, "unity-studio.json"),
    catalogPath: catalogArg ? resolve(catalogArg) : findCatalog(opencodeDir)
  };
}

// tools/unity/studio-config/src/render.ts
function escapeCell(value) {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}
function formatIds(ids) {
  return ids.map((id) => `\`${id}\``).join(", ") || "(none)";
}
function renderStudioConfigLines(view) {
  const lines = [];
  lines.push(`- Studio mode: ${view.studioMode}`);
  lines.push(`- Review intensity: ${view.reviewIntensity}`);
  lines.push(`- Toggles: tdd=${view.toggles.tdd}, ftf=${view.toggles.ftf}`);
  lines.push(`- Enabled patterns: ${formatIds(view.patterns)}`);
  lines.push(`- Enabled packages: ${formatIds(view.packages)}`);
  if (view.conflicts.length > 0) {
    lines.push("", "### Pattern conflicts", "");
    for (const conflict of view.conflicts)
      lines.push(`- **${conflict.kind}**: ${escapeCell(conflict.message)}`);
  }
  if (view.problems.length > 0) {
    lines.push("", "### Config problems", "");
    for (const problem of view.problems)
      lines.push(`- \`${problem.field}\`: ${escapeCell(problem.message)}`);
  }
  return lines;
}

// tools/unity/studio-config/src/catalog.ts
function loadPatternCatalog(path) {
  const catalog = readJson(path);
  if (!catalog || typeof catalog !== "object")
    return null;
  return catalog;
}

// tools/shared/json-helpers.ts
function asRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}

// tools/unity/studio-config/src/types.ts
var STUDIO_MODES = ["lean", "full"];
var REVIEW_INTENSITIES = ["full", "lean", "solo"];
var DEFAULT_STUDIO_CONFIG = {
  schemaVersion: 1,
  studioMode: "lean",
  reviewIntensity: "full",
  toggles: { tdd: false, ftf: false },
  patterns: [],
  packages: []
};

// tools/unity/studio-config/src/config.ts
var KNOWN_KEYS = new Set([
  "$schema",
  "schemaVersion",
  "studioMode",
  "reviewIntensity",
  "toggles",
  "patterns",
  "packages"
]);
var KNOWN_TOGGLE_KEYS = new Set(["tdd", "ftf"]);
function defaultStudioConfig() {
  return {
    ...DEFAULT_STUDIO_CONFIG,
    toggles: { ...DEFAULT_STUDIO_CONFIG.toggles },
    patterns: [],
    packages: []
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
    if (typeof record.schemaVersion === "number" && Number.isFinite(record.schemaVersion)) {
      schemaVersion = record.schemaVersion;
    } else {
      problems.push({ field: "schemaVersion", message: `expected a number, got ${JSON.stringify(record.schemaVersion)}` });
    }
  }
  const config = {
    schemaVersion,
    studioMode: parseMode(record.studioMode, problems),
    reviewIntensity: parseIntensity(record.reviewIntensity, problems),
    toggles: parseToggles(record.toggles, problems),
    patterns: parseStringArray(record.patterns, "patterns", problems),
    packages: parseStringArray(record.packages, "packages", problems)
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

// tools/unity/studio-config/src/resolver.ts
function resolveStudioConfig(config, catalog, extraProblems = []) {
  const problems = [...extraProblems];
  const conflicts = [];
  const patterns = unique(config.patterns);
  const packages = unique(config.packages);
  const enabled = new Set(patterns);
  const patternById = new Map((catalog.patterns ?? []).map((pattern) => [pattern.id, pattern]));
  const categoryById = new Map((catalog.categories ?? []).map((category) => [category.id, category]));
  for (const id of patterns) {
    if (!patternById.has(id))
      problems.push({ field: "patterns", message: `unknown pattern id '${id}'` });
  }
  const byCategory = {};
  for (const category of catalog.categories ?? []) {
    const members = unique((category.patterns ?? []).filter((id) => enabled.has(id)));
    for (const id of patterns) {
      if (patternById.get(id)?.category === category.id && !members.includes(id))
        members.push(id);
    }
    if (members.length === 0)
      continue;
    byCategory[category.id] = members;
    if (members.length > 1) {
      if (category.selection === "single") {
        conflicts.push({
          kind: "single-selection",
          category: category.id,
          patterns: members,
          message: `category '${category.id}' allows a single pattern but ${members.length} are enabled: ${members.join(", ")}`
        });
      }
      if (category.mutuallyExclusive) {
        conflicts.push({
          kind: "mutually-exclusive",
          category: category.id,
          patterns: members,
          message: `category '${category.id}' is mutually exclusive but combines: ${members.join(", ")}`
        });
      }
    }
  }
  for (const id of patterns) {
    const category = patternById.get(id)?.category;
    if (category && !categoryById.has(category)) {
      problems.push({ field: "patterns", message: `pattern '${id}' references unknown category '${category}'` });
    }
  }
  const seenPairs = new Set;
  for (const id of patterns) {
    for (const other of patternById.get(id)?.conflictsWith ?? []) {
      if (!enabled.has(other))
        continue;
      const pair = [id, other].sort();
      const key = pair.join("\x00");
      if (seenPairs.has(key))
        continue;
      seenPairs.add(key);
      conflicts.push({
        kind: "conflictsWith",
        patterns: pair,
        message: `patterns '${pair[0]}' and '${pair[1]}' conflict`
      });
    }
  }
  const effective = { ...config, patterns, packages };
  return {
    config: effective,
    enabledPatterns: patterns,
    enabledPackages: packages,
    byCategory,
    conflicts,
    problems,
    valid: conflicts.length === 0 && problems.length === 0
  };
}

// tools/unity/studio-config/src/resolve.ts
function resolveStudioConfigProject(options) {
  const load = loadStudioConfig(options.configPath);
  const catalog = options.catalogPath ? loadPatternCatalog(options.catalogPath) : null;
  const problems = [...load.problems];
  if (load.present && !catalog) {
    problems.push({ field: "catalog", message: "pattern catalog not found; pattern conflicts were not validated" });
  }
  const resolution = resolveStudioConfig(load.config, catalog ?? { categories: [], patterns: [] }, problems);
  return { configPath: options.configPath, catalogPath: options.catalogPath, present: load.present, resolution };
}

// tools/unity/studio-config/src/index.ts
function run(options) {
  return resolveStudioConfigProject({ configPath: options.configPath, catalogPath: options.catalogPath });
}
function render(result) {
  const { resolution } = result;
  const lines = [];
  lines.push(`Studio config: ${result.present ? result.configPath : "not present (using defaults)"}`);
  lines.push(`Pattern catalog: ${result.catalogPath ?? "not found"}`);
  lines.push(...renderStudioConfigLines({
    studioMode: resolution.config.studioMode,
    reviewIntensity: resolution.config.reviewIntensity,
    toggles: resolution.config.toggles,
    patterns: resolution.enabledPatterns,
    packages: resolution.enabledPackages,
    conflicts: resolution.conflicts,
    problems: resolution.problems
  }));
  lines.push(`Valid: ${resolution.valid}`);
  return lines.join(`
`);
}
runCli({ abilities: [], resolveOptions, run, render });
