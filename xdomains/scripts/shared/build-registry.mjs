// tools/shared/registry/src/index.ts
import { mkdirSync as mkdirSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { dirname, join as join2, resolve } from "node:path";

// tools/shared/io.ts
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}
function nowIso() {
  return new Date().toISOString();
}

// tools/shared/registry/src/build.ts
import { readdirSync, statSync as statSync2 } from "node:fs";
import { basename, join, relative, sep } from "node:path";

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
function quoteBareWords(input) {
  return input.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_-]*)(\s*:)/g, '$1"$2"$3').replace(/(:\s*)([A-Za-z_][A-Za-z0-9_-]*)(?=\s*[,}\]])/g, '$1"$2"');
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
  const trimmed = collected.map((line) => line.trim()).filter((line) => line !== "");
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
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : undefined;
}

// tools/shared/registry/src/build.ts
function toPosix(path) {
  return path.split(sep).join("/");
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
    const full = join(dir, entry);
    if (isDir(full))
      walkFiles(full, base, out);
    else
      out.push(toPosix(relative(base, full)));
  }
  return out;
}
function entry(domainDir, relPath, id, consumes, layer) {
  const fm = readFrontmatter(join(domainDir, relPath));
  return {
    id,
    name: frontmatterString(fm, "name") || id,
    path: relPath,
    description: frontmatterString(fm, "description"),
    consumes: consumes.length > 0 ? consumes : undefined,
    layer
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
function buildRegistry(domainDir, generatedAt) {
  const manifest = readJson(join(domainDir, "sb-domain.json")) ?? {};
  const projections = readJson(join(domainDir, "context-projections.json")) ?? {};
  const consumers = projections.consumers ?? {};
  const mapEntries = (paths, layer) => (paths ?? []).map((rel) => entry(domainDir, rel, basename(rel, ".md"), consumedOutputs(rel, basename(rel, ".md"), consumers), layer));
  const agents = mapEntries(manifest.agents);
  const subagents = mapEntries(manifest.subagents);
  const commands = mapEntries(manifest.commands, "command");
  const abilities = (manifest.abilities ?? []).map((ability) => {
    const rel = `command/${ability}.md`;
    const exists = (() => {
      try {
        return statSync2(join(domainDir, rel)).isFile();
      } catch {
        return false;
      }
    })();
    return { id: ability, name: ability, path: rel, realisedAs: exists ? rel : undefined, layer: "ability" };
  });
  const contextFiles = (manifest.context ?? []).flatMap((rel) => {
    const full = join(domainDir, rel);
    return isDir(full) ? walkFiles(full, domainDir) : [rel];
  });
  const context = contextFiles.filter((rel) => rel.endsWith(".md")).map((rel) => entry(domainDir, rel, basename(rel, ".md"), consumedOutputs(rel, basename(rel, ".md"), consumers)));
  const workflows = context.filter((c) => c.path.includes("/workflows/"));
  const tools = (manifest.tools ?? []).map((tool) => ({ id: tool, name: tool, path: `tools/${tool}`, layer: "tool" }));
  const scripts = (manifest.scripts ?? []).map((script) => ({ id: basename(script), name: basename(script), path: script }));
  const outputs = (projections.outputs ?? []).map((output) => {
    const consumedBy = Object.entries(consumers).filter(([, files]) => files.includes(output.file)).map(([consumer]) => consumer);
    return { file: output.file, title: output.title ?? output.file, consumedBy };
  });
  const edges = [];
  const addEdges = (type, from, tos) => {
    for (const to of tos)
      edges.push({ type, from, to });
  };
  for (const rel of [...manifest.agents ?? [], ...manifest.subagents ?? []]) {
    const fm = readFrontmatter(join(domainDir, rel));
    addEdges("agent-ability", basename(rel, ".md"), frontmatterStringArray(fm, "abilities") ?? []);
  }
  for (const workflow of workflows) {
    const fm = readFrontmatter(join(domainDir, workflow.path));
    addEdges("workflow-ability", workflow.id, frontmatterStringArray(fm, "abilities") ?? []);
    addEdges("workflow-agent", workflow.id, frontmatterStringArray(fm, "agents") ?? []);
  }
  const counts = {
    agents: agents.length,
    subagents: subagents.length,
    commands: commands.length,
    abilities: abilities.length,
    context: context.length,
    workflows: workflows.length,
    tools: tools.length,
    scripts: scripts.length,
    edges: edges.length
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
    tools,
    scripts,
    edges,
    projections: { outputDir: projections.outputDir ?? null, outputs }
  };
}

// tools/shared/registry/src/render.ts
function escapeCell(value) {
  return (value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}
function entriesTable(entries, options = {}) {
  const lines = [];
  const header = ["Id", "Name", "Path", "Description"];
  if (options.layer)
    header.push("Layer");
  if (options.realised)
    header.push("Realised as");
  if (options.consumes)
    header.push("Consumes");
  lines.push(`| ${header.join(" | ")} |`);
  lines.push(`|${header.map(() => "---").join("|")}|`);
  for (const entry of entries) {
    const row = [entry.id, entry.name, `\`${entry.path}\``, escapeCell(entry.description)];
    if (options.layer)
      row.push(entry.layer ?? "");
    if (options.realised)
      row.push(entry.realisedAs ? `\`${entry.realisedAs}\`` : "");
    if (options.consumes)
      row.push(escapeCell((entry.consumes ?? []).join(", ")));
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
  section(lines, "Agents", registry.agents, { consumes: true });
  section(lines, "SubAgents", registry.subagents, { consumes: true });
  section(lines, "Commands", registry.commands, { consumes: true, layer: true });
  section(lines, "Abilities", registry.abilities, { realised: true, layer: true });
  section(lines, "Context", registry.context, { consumes: true });
  section(lines, "Workflows", registry.workflows, { consumes: true });
  section(lines, "Tools", registry.tools, { layer: true });
  section(lines, "Scripts", registry.scripts);
  edgesSection(lines, registry.edges);
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
      lines.push(`| \`${output.file}\` | ${escapeCell(output.title)} | ${escapeCell(output.consumedBy.join(", "))} |`);
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
  const registry = buildRegistry(domainDir, nowIso());
  const subdomain = registry.subdomain || "unity";
  const outJson = resolve(String(args["out-json"] || join2(opencodeDir, "registry.json")));
  const outMd = resolve(String(args["out-md"] || join2(opencodeDir, "context", subdomain, "registry.md")));
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
