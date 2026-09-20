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
function parseFrontmatter(content) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!match)
    return {};
  const fm = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!m)
      continue;
    let value = m[2].trim();
    if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    fm[m[1]] = value;
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
function entry(domainDir, relPath, id, consumes) {
  const fm = readFrontmatter(join(domainDir, relPath));
  return {
    id,
    name: fm.name || id,
    path: relPath,
    description: fm.description,
    consumes: consumes.length > 0 ? consumes : undefined
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
  const mapEntries = (paths, folder) => (paths ?? []).map((rel) => entry(domainDir, rel, basename(rel, ".md"), consumedOutputs(rel, basename(rel, ".md"), consumers)));
  const agents = mapEntries(manifest.agents, "agent");
  const subagents = mapEntries(manifest.subagents, "subagents");
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
    return { id: ability, name: ability, path: rel, realisedAs: exists ? rel : undefined };
  });
  const contextFiles = (manifest.context ?? []).flatMap((rel) => {
    const full = join(domainDir, rel);
    return isDir(full) ? walkFiles(full, domainDir) : [rel];
  });
  const context = contextFiles.filter((rel) => rel.endsWith(".md")).map((rel) => entry(domainDir, rel, basename(rel, ".md"), consumedOutputs(rel, basename(rel, ".md"), consumers)));
  const workflows = context.filter((c) => c.path.includes("/workflows/"));
  const tools = (manifest.tools ?? []).map((tool) => ({ id: tool, name: tool, path: `tools/${tool}` }));
  const scripts = (manifest.scripts ?? []).map((script) => ({ id: basename(script), name: basename(script), path: script }));
  const outputs = (projections.outputs ?? []).map((output) => {
    const consumedBy = Object.entries(consumers).filter(([, files]) => files.includes(output.file)).map(([consumer]) => consumer);
    return { file: output.file, title: output.title ?? output.file, consumedBy };
  });
  const counts = {
    agents: agents.length,
    subagents: subagents.length,
    commands: commands.length,
    abilities: abilities.length,
    context: context.length,
    workflows: workflows.length,
    tools: tools.length,
    scripts: scripts.length
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
  if (options.realised)
    header.push("Realised as");
  if (options.consumes)
    header.push("Consumes");
  lines.push(`| ${header.join(" | ")} |`);
  lines.push(`|${header.map(() => "---").join("|")}|`);
  for (const entry of entries) {
    const row = [entry.id, entry.name, `\`${entry.path}\``, escapeCell(entry.description)];
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
  section(lines, "Agents", registry.agents, { consumes: true });
  section(lines, "SubAgents", registry.subagents, { consumes: true });
  section(lines, "Commands", registry.commands, { consumes: true });
  section(lines, "Abilities", registry.abilities, { realised: true });
  section(lines, "Context", registry.context, { consumes: true });
  section(lines, "Workflows", registry.workflows, { consumes: true });
  section(lines, "Tools", registry.tools);
  section(lines, "Scripts", registry.scripts);
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
