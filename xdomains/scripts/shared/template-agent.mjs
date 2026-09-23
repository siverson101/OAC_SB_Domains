// tools/shared/templating/src/index.ts
import { mkdirSync as mkdirSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { dirname, join } from "node:path";

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
function firstString(args, keys) {
  for (const key of keys) {
    const value = args[key];
    if (typeof value === "string" && value.trim() !== "")
      return value;
  }
  return;
}

// tools/shared/json-helpers.ts
function asRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
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
function readText(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

// tools/shared/templating/src/types.ts
class TemplateError extends Error {
}

// tools/shared/templating/src/resolve.ts
var TEMPLATE_SCHEMA_VERSION = 1;
function parseManifest(value) {
  const record = asRecord(value);
  if (!record)
    throw new TemplateError("manifest must be a JSON object");
  if (record.schemaVersion !== undefined && record.schemaVersion !== TEMPLATE_SCHEMA_VERSION) {
    throw new TemplateError(`unsupported manifest schemaVersion ${JSON.stringify(record.schemaVersion)}, expected ${TEMPLATE_SCHEMA_VERSION}`);
  }
  const base = record.base;
  if (typeof base !== "string" || base.trim() === "")
    throw new TemplateError("manifest.base must be a non-empty string");
  const installAs = record.installAs;
  if (typeof installAs !== "string" || installAs.trim() === "") {
    throw new TemplateError("manifest.installAs must be a non-empty string");
  }
  if (!Array.isArray(record.axes) || record.axes.length === 0) {
    throw new TemplateError("manifest.axes must be a non-empty array");
  }
  const axes = record.axes.map((entry, index) => {
    const axis = asRecord(entry);
    if (!axis || typeof axis.id !== "string" || axis.id.trim() === "") {
      throw new TemplateError(`manifest.axes[${index}].id must be a non-empty string`);
    }
    const values = asRecord(axis.values);
    if (!values || Object.keys(values).length === 0) {
      throw new TemplateError(`manifest.axes[${index}].values must be a non-empty object`);
    }
    let fallback;
    if (axis.default !== undefined) {
      if (typeof axis.default !== "string" || !Object.prototype.hasOwnProperty.call(values, axis.default)) {
        throw new TemplateError(`manifest.axes[${index}].default must be one of ${Object.keys(values).join("|")}`);
      }
      fallback = axis.default;
    }
    return { id: axis.id.trim(), values, default: fallback };
  });
  if (typeof record.output !== "string" || record.output.trim() === "") {
    throw new TemplateError("manifest.output must be a non-empty string");
  }
  const rawSubs = asRecord(record.substitutions);
  if (!rawSubs)
    throw new TemplateError("manifest.substitutions must be an object");
  const substitutions = {};
  for (const [key, value] of Object.entries(rawSubs)) {
    if (typeof value === "string") {
      substitutions[key] = value;
    } else {
      const map = asRecord(value);
      if (!map || !Object.values(map).every((v) => typeof v === "string")) {
        throw new TemplateError(`manifest.substitutions.${key} must be a string or a map of strings`);
      }
      substitutions[key] = map;
    }
  }
  const conditionals = asRecord(record.conditionals);
  return {
    schemaVersion: typeof record.schemaVersion === "number" ? record.schemaVersion : TEMPLATE_SCHEMA_VERSION,
    base,
    installAs,
    axes,
    output: record.output,
    substitutions,
    conditionals: conditionals ? conditionals : undefined
  };
}
function validateSelection(manifest, selection) {
  for (const axis of manifest.axes) {
    const value = selection[axis.id];
    if (value === undefined)
      throw new TemplateError(`missing value for axis "${axis.id}"`);
    if (!Object.prototype.hasOwnProperty.call(axis.values, value)) {
      throw new TemplateError(`unknown value "${value}" for axis "${axis.id}" (expected ${Object.keys(axis.values).join("|")})`);
    }
  }
}
function installStem(installAs) {
  const base = installAs.split("/").pop() ?? installAs;
  return base.replace(/\.md$/, "");
}
function placeholderValue(name, manifest, selection) {
  if (Object.prototype.hasOwnProperty.call(manifest.substitutions, name)) {
    const sub = manifest.substitutions[name];
    if (typeof sub === "string")
      return sub;
    for (const value of Object.values(selection)) {
      if (Object.prototype.hasOwnProperty.call(sub, value))
        return sub[value];
    }
    throw new TemplateError(`no substitution value for {{${name}}} with selection ${JSON.stringify(selection)}`);
  }
  if (name === "BASE_NAME")
    return manifest.base;
  if (name === "INSTALL_NAME")
    return installStem(manifest.installAs);
  if (Object.prototype.hasOwnProperty.call(selection, name))
    return selection[name];
  throw new TemplateError(`unknown placeholder {{${name}}}`);
}
var PLACEHOLDER = /\{\{([A-Za-z0-9_]+)\}\}/g;
function substitute(text, manifest, selection) {
  const out = text.replace(PLACEHOLDER, (_match, name) => placeholderValue(name, manifest, selection));
  if (out.includes("{{") || out.includes("}}")) {
    const leftover = out.match(/\{\{[^}]*\}\}|\}\}|\{\{/);
    throw new TemplateError(`unresolved placeholder remains after substitution: ${leftover?.[0] ?? "{{"}`);
  }
  return out;
}
function resolveTemplate(template, manifest, selection) {
  validateSelection(manifest, selection);
  const content = substitute(template, manifest, selection);
  const filename = substitute(manifest.output, manifest, selection);
  return { content, filename, installAs: manifest.installAs, axes: { ...selection } };
}
function combinations(manifest) {
  let out = [{}];
  for (const axis of manifest.axes) {
    const values = Object.keys(axis.values);
    const next = [];
    for (const partial of out) {
      for (const value of values)
        next.push({ ...partial, [axis.id]: value });
    }
    out = next;
  }
  return out;
}
function parseSelection(input) {
  const selection = {};
  for (const pair of input.split(",")) {
    const trimmed = pair.trim();
    if (trimmed === "")
      continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1)
      throw new TemplateError(`axis selection "${trimmed}" must be id=value`);
    selection[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return selection;
}

// tools/shared/templating/src/index.ts
function resolveOptions(argv) {
  const { values } = parseArgs(argv);
  return {
    template: firstString(values, ["template"]) ?? null,
    manifest: firstString(values, ["manifest"]) ?? "",
    axes: firstString(values, ["axes"]) ?? null,
    out: firstString(values, ["out"]) ?? null,
    print: parseBool(values.print, false),
    generate: parseBool(values.generate, false),
    listCombinations: parseBool(values.combinations, false)
  };
}
function loadManifest(path) {
  const text = readText(path);
  if (text === null)
    throw new Error(`manifest not found: ${path}`);
  return parseManifest(JSON.parse(text));
}
function writeOut(path, content) {
  mkdirSync2(dirname(path), { recursive: true });
  writeFileSync2(path, content.endsWith(`
`) ? content : `${content}
`);
}
function run(argv) {
  const options = resolveOptions(argv);
  if (!options.manifest) {
    process.stderr.write(`usage: template-agent.mjs --manifest <path> [--template <path> --axes id=value,...] [--out <path>|--print|--generate|--combinations]
`);
    return 2;
  }
  const manifest = loadManifest(options.manifest);
  if (options.listCombinations) {
    for (const combo of combinations(manifest)) {
      process.stdout.write(`${Object.entries(combo).map(([k, v]) => `${k}=${v}`).join(",")}
`);
    }
    return 0;
  }
  const templateDir = options.template ? dirname(options.template) : dirname(options.manifest);
  if (options.generate) {
    if (!options.template)
      throw new Error("--generate requires --template");
    const template = readText(options.template);
    if (template === null)
      throw new Error(`template not found: ${options.template}`);
    for (const combo of combinations(manifest)) {
      const resolved = resolveTemplate(template, manifest, combo);
      writeOut(join(templateDir, resolved.filename), resolved.content);
    }
    return 0;
  }
  if (!options.template)
    throw new Error("--template is required (or use --generate)");
  const template = readText(options.template);
  if (template === null)
    throw new Error(`template not found: ${options.template}`);
  if (!options.axes)
    throw new Error("--axes id=value,... is required");
  const resolved = resolveTemplate(template, manifest, parseSelection(options.axes));
  if (options.out) {
    writeOut(options.out, resolved.content);
    return 0;
  }
  if (options.print) {
    process.stdout.write(resolved.content);
    return 0;
  }
  process.stdout.write(`${resolved.filename}
`);
  return 0;
}
try {
  process.exitCode = run(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}
`);
  process.exitCode = 1;
}
export {
  TEMPLATE_SCHEMA_VERSION,
  combinations,
  parseManifest,
  parseSelection,
  resolveTemplate,
  run
};
