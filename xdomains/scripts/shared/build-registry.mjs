// tools/shared/registry/src/index.ts
import { mkdirSync as mkdirSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { dirname, join as join3, resolve } from "node:path";

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
function nowIso() {
  return new Date().toISOString();
}
function unique(values) {
  return Array.from(new Set(values));
}

// tools/shared/registry/src/build.ts
import { readdirSync, statSync as statSync2 } from "node:fs";
import { basename, join as join2, relative, sep } from "node:path";

// tools/shared/context-files.ts
import { join } from "node:path";
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
// tools/unity/studio-config/src/roster.ts
function optionalPaths(optional) {
  const out = [];
  for (const entry of optional ?? []) {
    const rel = typeof entry === "string" ? entry : entry?.path;
    if (rel)
      out.push(rel);
  }
  return out;
}
function isGateEnabled(enabledBy, gates) {
  if (enabledBy === undefined)
    return true;
  return gates[enabledBy] === true;
}
function selectActiveRoster(source, gates, enabledByFor) {
  const agents = [...source.agents];
  const subagents = [...source.subagents];
  const seen = new Set(subagents);
  for (const path of source.optional) {
    if (!seen.has(path) && isGateEnabled(enabledByFor(path), gates)) {
      seen.add(path);
      subagents.push(path);
    }
  }
  return { agents, subagents };
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

// tools/shared/registry/src/frontmatter.ts
import { readFileSync as readFileSync2 } from "node:fs";
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
function readFrontmatter(path) {
  try {
    return parseFrontmatter(readFileSync2(path, "utf8"));
  } catch {
    return {};
  }
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

// tools/shared/registry/src/build.ts
function toPosix(path) {
  return path.split(sep).join("/");
}
function selectStudioRoster(manifest, studioMode, gates, domainDir) {
  const mode = manifest.studioModes?.[studioMode];
  if (!mode)
    return { agents: manifest.agents ?? [], subagents: manifest.subagents ?? [] };
  return selectActiveRoster({
    agents: mode.agents ?? [],
    subagents: mode.subagents ?? [],
    optional: optionalPaths(mode.optional)
  }, gates, (rel) => frontmatterString(readFrontmatter(join2(domainDir, rel)), "enabledBy"));
}
function allStudioAgents(manifest) {
  if (!manifest.studioModes)
    return [...manifest.agents ?? [], ...manifest.subagents ?? []];
  const out = [];
  for (const mode of Object.values(manifest.studioModes)) {
    out.push(...mode.agents ?? [], ...mode.subagents ?? [], ...optionalPaths(mode.optional));
  }
  return out;
}
function nativeSubprojectPresent(opencodeDir) {
  if (!opencodeDir)
    return false;
  const artifact = readJson(join2(opencodeDir, "project-data", "native-project-state.json"));
  return artifact?.state?.solutionExists === true;
}
function isDir(path) {
  try {
    return statSync2(path).isDirectory();
  } catch {
    return false;
  }
}
function walkFiles(dir, base, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join2(dir, entry);
    if (isDir(full))
      walkFiles(full, base, out);
    else
      out.push(toPosix(relative(base, full)));
  }
  return out;
}
function asModelTier(value) {
  return value && MODEL_TIERS.includes(value) ? value : undefined;
}
function entry(domainDir, relPath, id, consumes, layer, modelTiers) {
  const fm = readFrontmatter(join2(domainDir, relPath));
  const tier = modelTiers ? asModelTier(frontmatterString(fm, "tier")) : undefined;
  return {
    id,
    name: frontmatterString(fm, "name") || id,
    path: relPath,
    description: frontmatterString(fm, "description"),
    consumes: consumes.length > 0 ? consumes : undefined,
    layer,
    tier,
    model: tier ? modelTiers?.[tier] : undefined
  };
}
function candidateKeys(path, id) {
  const noExt = path.replace(/\.md$/, "");
  const keys = new Set([noExt, id]);
  if (noExt.startsWith("agent/"))
    keys.add(noExt.slice("agent/".length));
  return [...keys];
}
function consumedOutputs(path, id, consumers) {
  const keys = candidateKeys(path, id);
  const out = new Set;
  for (const key of keys) {
    for (const output of consumers[key] ?? [])
      out.add(output);
  }
  return [...out];
}
function readKindManifest(domainDir, context, kind) {
  for (const rel of context ?? []) {
    const full = join2(domainDir, rel);
    if (!isDir(full))
      continue;
    const manifestPath = join2(full, kind, "manifest.json");
    const manifest = readJson(manifestPath);
    if (manifest)
      return { baseDir: toPosix(join2(rel, kind)), manifest };
  }
  return null;
}
function absentStudioConfig() {
  const defaults = defaultStudioConfig();
  return {
    present: false,
    path: null,
    studioMode: defaults.studioMode,
    reviewIntensity: defaults.reviewIntensity,
    toggles: { ...defaults.toggles },
    patterns: [],
    packages: [],
    modelTiers: { ...defaults.modelTiers },
    conflicts: [],
    problems: [],
    valid: true
  };
}
function buildStudioConfig(domainDir, opencodeDir) {
  const opencodePath = opencodeDir ? join2(opencodeDir, "unity-studio.json") : null;
  const domainPath = join2(domainDir, "unity-studio.json");
  const catalogPath = findPatternCatalog({ domainDir, opencodeDir });
  let resolved = resolveStudioConfigProject({ configPath: opencodePath ?? domainPath, catalogPath });
  if (opencodePath && !resolved.present) {
    resolved = resolveStudioConfigProject({ configPath: domainPath, catalogPath });
  }
  if (!resolved.present)
    return absentStudioConfig();
  return {
    present: true,
    path: resolved.configPath,
    studioMode: resolved.resolution.config.studioMode,
    reviewIntensity: resolved.resolution.config.reviewIntensity,
    toggles: resolved.resolution.config.toggles,
    patterns: resolved.resolution.enabledPatterns,
    packages: resolved.resolution.enabledPackages,
    modelTiers: resolved.resolution.config.modelTiers,
    conflicts: resolved.resolution.conflicts,
    problems: resolved.resolution.problems,
    valid: resolved.resolution.valid
  };
}
function buildRegistry(domainDir, generatedAt, opencodeDir) {
  const manifest = readJson(join2(domainDir, "sb-domain.json")) ?? {};
  const projections = readJson(join2(domainDir, "context-projections.json")) ?? {};
  const consumers = projections.consumers ?? {};
  const studioConfig = buildStudioConfig(domainDir, opencodeDir);
  const mapEntries = (paths, layer, modelTiers) => (paths ?? []).map((rel) => entry(domainDir, rel, basename(rel, ".md"), consumedOutputs(rel, basename(rel, ".md"), consumers), layer, modelTiers));
  const gates = {
    tdd: studioConfig.toggles.tdd === true,
    "native-subproject": nativeSubprojectPresent(opencodeDir)
  };
  const roster = selectStudioRoster(manifest, studioConfig.studioMode, gates, domainDir);
  const agents = mapEntries(roster.agents, undefined, studioConfig.modelTiers);
  const subagents = mapEntries(roster.subagents, undefined, studioConfig.modelTiers);
  const commands = mapEntries(manifest.commands, "command");
  const abilities = (manifest.abilities ?? []).map((ability) => {
    const rel = `command/${ability}.md`;
    const exists = (() => {
      try {
        return statSync2(join2(domainDir, rel)).isFile();
      } catch {
        return false;
      }
    })();
    return { id: ability, name: ability, path: rel, realisedAs: exists ? rel : undefined, layer: "ability" };
  });
  const kindDirs = (manifest.context ?? []).filter((rel) => isDir(join2(domainDir, rel))).flatMap((rel) => [toPosix(join2(rel, "snippets")), toPosix(join2(rel, "templates"))]);
  const isKindFile = (rel) => kindDirs.some((dir) => rel === dir || rel.startsWith(`${dir}/`));
  const contextFiles = (manifest.context ?? []).flatMap((rel) => {
    const full = join2(domainDir, rel);
    return isDir(full) ? walkFiles(full, domainDir) : [rel];
  });
  const context = contextFiles.filter((rel) => rel.endsWith(".md")).filter((rel) => !isKindFile(rel)).map((rel) => entry(domainDir, rel, basename(rel, ".md"), consumedOutputs(rel, basename(rel, ".md"), consumers)));
  const workflows = context.filter((c) => c.path.includes("/workflows/"));
  const snippetsManifest = readKindManifest(domainDir, manifest.context, "snippets");
  const templatesManifest = readKindManifest(domainDir, manifest.context, "templates");
  const defaultContextDir = (manifest.context ?? []).find((rel) => isDir(join2(domainDir, rel))) ?? `context/${manifest.subdomain ?? manifest.name ?? ""}`;
  const snippetsBaseDir = snippetsManifest?.baseDir ?? toPosix(join2(defaultContextDir, "snippets"));
  const templatesBaseDir = templatesManifest?.baseDir ?? toPosix(join2(defaultContextDir, "templates"));
  const snippets = (snippetsManifest?.manifest.snippets ?? []).map((snippet) => ({
    id: snippet.id,
    name: snippet.id,
    path: `${snippetsBaseDir}/${snippet.path}`,
    description: snippet.description,
    standardsVersion: snippet.standardsVersion ?? snippetsManifest?.manifest.standardsVersion
  }));
  const templates = (templatesManifest?.manifest.templates ?? []).map((template) => ({
    id: template.id,
    name: template.id,
    path: `${templatesBaseDir}/${template.path}/README.md`,
    description: template.description,
    standardsVersion: template.standardsVersion ?? templatesManifest?.manifest.standardsVersion
  }));
  const tools = (manifest.tools ?? []).map((tool) => ({ id: tool, name: tool, path: `tools/${tool}`, layer: "tool" }));
  const scripts = (manifest.scripts ?? []).map((script) => ({ id: basename(script), name: basename(script), path: script }));
  const outputs = (projections.outputs ?? []).map((output) => {
    const consumedBy = Object.entries(consumers).filter(([, files]) => files.includes(output.file)).map(([consumer]) => consumer);
    return { file: output.file, title: output.title ?? output.file, consumedBy };
  });
  const knownAbilities = new Set(manifest.abilities ?? []);
  const knownAgents = new Set(allStudioAgents(manifest).map((rel) => basename(rel, ".md")));
  const warnings = [];
  const edges = [];
  const seenEdges = new Set;
  const addEdges = (type, from, tos) => {
    for (const to of tos) {
      const key = `${type}\x00${from}\x00${to}`;
      if (seenEdges.has(key))
        continue;
      seenEdges.add(key);
      if ((type === "agent-ability" || type === "workflow-ability") && !knownAbilities.has(to)) {
        warnings.push(`edge ${type} ${from} -> ${to}: unknown ability`);
        continue;
      }
      if (type === "workflow-agent" && !knownAgents.has(to)) {
        warnings.push(`edge ${type} ${from} -> ${to}: unknown agent`);
        continue;
      }
      edges.push({ type, from, to });
    }
  };
  for (const rel of [...roster.agents, ...roster.subagents]) {
    const fm = readFrontmatter(join2(domainDir, rel));
    addEdges("agent-ability", basename(rel, ".md"), frontmatterStringArray(fm, "abilities") ?? []);
  }
  for (const workflow of workflows) {
    const fm = readFrontmatter(join2(domainDir, workflow.path));
    addEdges("workflow-ability", workflow.id, frontmatterStringArray(fm, "abilities") ?? []);
    addEdges("workflow-agent", workflow.id, frontmatterStringArray(fm, "agents") ?? []);
  }
  edges.sort((a, b) => {
    if (a.type !== b.type)
      return a.type < b.type ? -1 : 1;
    if (a.from !== b.from)
      return a.from < b.from ? -1 : 1;
    if (a.to !== b.to)
      return a.to < b.to ? -1 : 1;
    return 0;
  });
  const counts = {
    agents: agents.length,
    subagents: subagents.length,
    commands: commands.length,
    abilities: abilities.length,
    context: context.length,
    workflows: workflows.length,
    snippets: snippets.length,
    templates: templates.length,
    tools: tools.length,
    scripts: scripts.length,
    edges: edges.length,
    warnings: warnings.length,
    studioPatterns: studioConfig.patterns.length
  };
  return {
    schemaVersion: 1,
    generatedAt,
    domain: manifest.domain ?? "",
    subdomain: manifest.subdomain ?? manifest.name ?? "",
    displayName: manifest.displayName ?? manifest.name ?? "",
    version: manifest.version ?? "",
    counts,
    agents,
    subagents,
    commands,
    abilities,
    context,
    workflows,
    snippets,
    templates,
    tools,
    scripts,
    edges,
    warnings,
    studioConfig,
    projections: { outputDir: projections.outputDir ?? null, outputs }
  };
}

// tools/shared/registry/src/render.ts
function escapeCell2(value) {
  return (value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}
function entriesTable(entries, options = {}) {
  const lines = [];
  const header = ["Id", "Name", "Path", "Description"];
  if (options.tier)
    header.push("Tier");
  if (options.model)
    header.push("Model");
  if (options.layer)
    header.push("Layer");
  if (options.realised)
    header.push("Realised as");
  if (options.consumes)
    header.push("Consumes");
  if (options.standards)
    header.push("Standards");
  lines.push(`| ${header.join(" | ")} |`);
  lines.push(`|${header.map(() => "---").join("|")}|`);
  for (const entry of entries) {
    const row = [entry.id, entry.name, `\`${entry.path}\``, escapeCell2(entry.description)];
    if (options.tier)
      row.push(entry.tier ?? "");
    if (options.model)
      row.push(entry.model ?? "");
    if (options.layer)
      row.push(entry.layer ?? "");
    if (options.realised)
      row.push(entry.realisedAs ? `\`${entry.realisedAs}\`` : "");
    if (options.consumes)
      row.push(escapeCell2((entry.consumes ?? []).join(", ")));
    if (options.standards)
      row.push(entry.standardsVersion ?? "");
    lines.push(`| ${row.join(" | ")} |`);
  }
  return lines;
}
function section(lines, title, entries, options) {
  if (entries.length === 0)
    return;
  lines.push(`## ${title}`);
  lines.push("");
  lines.push(...entriesTable(entries, options));
  lines.push("");
}
function studioConfigSection(lines, studio) {
  lines.push("## Studio Config");
  lines.push("");
  if (studio.present) {
    lines.push(`Source: \`${studio.path ?? "unity-studio.json"}\``);
    lines.push("");
  } else {
    lines.push("> No `.opencode/unity-studio.json` found; using defaults (fail-soft).");
    lines.push("");
  }
  lines.push(...renderStudioConfigLines(studio));
  lines.push("");
}
var EDGE_ORDER = ["agent-ability", "workflow-ability", "workflow-agent"];
function edgesSection(lines, edges) {
  if (edges.length === 0)
    return;
  lines.push("## Edges");
  lines.push("");
  for (const type of EDGE_ORDER) {
    const group = edges.filter((edge) => edge.type === type);
    if (group.length === 0)
      continue;
    lines.push(`### ${type}`);
    lines.push("");
    for (const edge of group)
      lines.push(`- \`${edge.from}\` → \`${edge.to}\``);
    lines.push("");
  }
}
function warningsSection(lines, warnings) {
  if (warnings.length === 0)
    return;
  lines.push("## Warnings");
  lines.push("");
  for (const warning of warnings)
    lines.push(`- ${warning}`);
  lines.push("");
}
function renderRegistry(registry) {
  const lines = [];
  const date = registry.generatedAt.slice(0, 10);
  lines.push(`<!-- Context: ${registry.subdomain}/registry | Priority: high | Version: 1.0 | Updated: ${date} -->`);
  lines.push("");
  lines.push(`# ${registry.displayName} Registry`);
  lines.push("");
  lines.push("> Generated from `sb-domain.json`, asset frontmatter, and `context-projections.json`.");
  lines.push("> Do not edit by hand; regenerate with `build-registry.mjs`.");
  lines.push("");
  lines.push(`- Domain: \`${registry.domain}\``);
  lines.push(`- Sub-domain: \`${registry.subdomain}\``);
  lines.push(`- Version: ${registry.version}`);
  lines.push(`- Generated: ${registry.generatedAt}`);
  lines.push("");
  lines.push("## Counts");
  lines.push("");
  for (const [key, value] of Object.entries(registry.counts))
    lines.push(`- ${key}: ${value}`);
  lines.push("");
  lines.push("> Layering: **tool** = thin typed adapter (no workflow logic); **ability** = named capability composing tools; **command** = user-invocable entry realising an ability (ADR-0004 / ADR-0012).");
  lines.push("");
  studioConfigSection(lines, registry.studioConfig);
  section(lines, "Agents", registry.agents, { consumes: true, tier: true, model: true });
  section(lines, "SubAgents", registry.subagents, { consumes: true, tier: true, model: true });
  section(lines, "Commands", registry.commands, { consumes: true, layer: true });
  section(lines, "Abilities", registry.abilities, { realised: true, layer: true });
  section(lines, "Context", registry.context, { consumes: true });
  section(lines, "Workflows", registry.workflows, { consumes: true });
  section(lines, "Snippets", registry.snippets, { standards: true });
  section(lines, "Templates", registry.templates, { standards: true });
  section(lines, "Tools", registry.tools, { layer: true });
  section(lines, "Scripts", registry.scripts);
  edgesSection(lines, registry.edges);
  warningsSection(lines, registry.warnings);
  if (registry.projections.outputs.length > 0) {
    lines.push("## Projected Context");
    lines.push("");
    if (registry.projections.outputDir) {
      lines.push(`Output directory: \`${registry.projections.outputDir}\``);
      lines.push("");
    }
    lines.push("| File | Title | Consumed by |");
    lines.push("|---|---|---|");
    for (const output of registry.projections.outputs) {
      lines.push(`| \`${output.file}\` | ${escapeCell2(output.title)} | ${escapeCell2(output.consumedBy.join(", "))} |`);
    }
    lines.push("");
  }
  return lines.join(`
`);
}

// tools/shared/registry/src/index.ts
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
function write(path, body) {
  mkdirSync2(dirname(path), { recursive: true });
  writeFileSync2(path, body);
}
function main() {
  const args = parseArgs(process.argv.slice(2));
  const domainDirArg = args["domain-dir"];
  if (!domainDirArg) {
    process.stderr.write(`Usage: build-registry.mjs --domain-dir <dir> [--opencode-dir <dir>] [--out-json <file>] [--out-md <file>]
`);
    process.exitCode = 2;
    return;
  }
  const domainDir = resolve(String(domainDirArg));
  const opencodeDir = resolve(String(args["opencode-dir"] || ".opencode"));
  const registry = buildRegistry(domainDir, nowIso(), opencodeDir);
  const subdomain = registry.subdomain || "unity";
  const outJson = resolve(String(args["out-json"] || join3(opencodeDir, "registry.json")));
  const outMd = resolve(String(args["out-md"] || join3(opencodeDir, "context", subdomain, "registry.md")));
  write(outJson, JSON.stringify(registry, null, 2) + `
`);
  write(outMd, renderRegistry(registry));
  process.stdout.write(JSON.stringify({
    generatedAt: registry.generatedAt,
    domain: registry.domain,
    subdomain: registry.subdomain,
    counts: registry.counts,
    paths: { json: outJson, markdown: outMd }
  }, null, 2) + `
`);
}
main();
