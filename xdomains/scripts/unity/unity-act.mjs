// tools/shared/cli-bootstrap.ts
function isThenable(value) {
  return typeof value?.then === "function";
}
function runCli(config) {
  const argv = config.argv ?? process.argv.slice(2);
  const write = config.write ?? ((text) => process.stdout.write(text));
  const options = config.resolveOptions(argv);
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

// tools/shared/toolchain.ts
import { spawnSync } from "node:child_process";

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

// tools/shared/toolchain.ts
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

// tools/unity/unity-act/src/gate.ts
var CHECKPOINT = [
  "Record the target asset hash before the edit (checkpoint).",
  "Confirm a change scope: the exact files and properties that may change."
];
var MUTATE = [
  "Apply the approved ops (dry run first, then the confirmed write)."
];
var VALIDATE = [
  "Force a compile and read compile-state (ScriptAssemblies mtimes + Editor.log).",
  "Run EditMode tests, then PlayMode tests when the change touches runtime code.",
  "For scene/asset edits, re-read the hierarchy and confirm the delta."
];
var DELTA = [
  "Report newIssues and resolvedIssues; `null` means no delta was computed, not clean.",
  "Flag validate_scan_failed and compilePending honestly."
];
var GATES = ["compile", "EditMode", "PlayMode", "scene/asset", "build", "performance"];
function planActGate(gate, cliAvailable) {
  if (!gate) {
    return {
      status: "not_run",
      requiresEditor: false,
      cliAvailable,
      reviewIntensity: "full",
      checkpoint: [],
      mutate: [],
      validate: [],
      delta: [],
      gates: [],
      commands: [],
      errors: []
    };
  }
  if (cliAvailable !== true) {
    return {
      status: "unavailable",
      requiresEditor: true,
      cliAvailable,
      reviewIntensity: "full",
      checkpoint: CHECKPOINT,
      mutate: MUTATE,
      validate: VALIDATE,
      delta: DELTA,
      gates: GATES,
      commands: [],
      errors: ["No Unity CLI available; the Act gate is opt-in and needs a live Editor."]
    };
  }
  return {
    status: "planned",
    requiresEditor: true,
    cliAvailable,
    reviewIntensity: "full",
    checkpoint: CHECKPOINT,
    mutate: MUTATE,
    validate: VALIDATE,
    delta: DELTA,
    gates: GATES,
    commands: [
      "unity command compile --json --no-banner --quiet --non-interactive",
      "unity command run_tests --mode editor --json --no-banner --quiet --non-interactive",
      "unity command run_tests --mode playmode --json --no-banner --quiet --non-interactive"
    ],
    errors: []
  };
}
function detectUnityCli() {
  return findExecutable("unity") !== null;
}

// tools/unity/unity-act/src/patterns.ts
import { dirname as dirname2, join as join2 } from "node:path";
import { fileURLToPath } from "node:url";

// tools/unity/unity-act/src/types.ts
var ACT_ABILITY_NAMES = [
  "scene-editing",
  "prefab-automation",
  "script-scaffolding",
  "shader-helper",
  "pattern-library",
  "input-automation"
];
var ACT_ABILITIES = [...ACT_ABILITY_NAMES];
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
function stringArray(obj, key) {
  const value = obj?.[key];
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
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

// tools/unity/unity-act/src/shared.ts
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

// tools/unity/unity-act/src/shared.ts
function projectDataDir(options) {
  return join(options.opencodeDir, "project-data");
}
function makeResult(ability, status, summary, errors, route = "offline") {
  return {
    ...makeEnvelope({ ability, family: "act", mode: "offline", status, summary, errors, route }),
    mutated: false,
    safetyGate: { dryRunFirst: true, requireConfirm: true }
  };
}

// tools/unity/unity-act/src/patterns.ts
function moduleDir() {
  return dirname2(fileURLToPath(import.meta.url));
}
function patternTableCandidates() {
  const here = moduleDir();
  return [
    join2(here, "..", "..", "context", "programming-patterns.json"),
    join2(here, "..", "..", "..", "..", "xdomains", "context", "programming-patterns.json")
  ];
}
function loadPatternTable(overridePath) {
  const candidates = overridePath ? [overridePath] : patternTableCandidates();
  for (const path of candidates) {
    const data = asRecord(readJson(path));
    if (data)
      return { data, path: toPosix(path), source: "bundle" };
  }
  return { data: null, path: null, source: "missing" };
}
function toPatternSummary(entry) {
  return {
    id: str(entry, "id") ?? "",
    name: str(entry, "name") ?? "",
    category: str(entry, "category") ?? "",
    description: str(entry, "description") ?? "",
    whenToUse: str(entry, "whenToUse") ?? "",
    aliases: stringArray(entry, "aliases"),
    conflictsWith: stringArray(entry, "conflictsWith"),
    pairsWellWith: stringArray(entry, "pairsWellWith")
  };
}
function toCategorySummary(entry) {
  return {
    id: str(entry, "id") ?? "",
    name: str(entry, "name") ?? "",
    selection: str(entry, "selection") ?? "multiple",
    mutuallyExclusive: entry.mutuallyExclusive === true,
    description: str(entry, "description") ?? "",
    patterns: stringArray(entry, "patterns"),
    guidance: stringArray(entry, "guidance")
  };
}
function matchesQuery(pattern, query) {
  const needle = query.toLowerCase();
  return pattern.id.toLowerCase().includes(needle) || pattern.name.toLowerCase().includes(needle) || pattern.description.toLowerCase().includes(needle) || pattern.whenToUse.toLowerCase().includes(needle) || pattern.aliases.some((alias) => alias.toLowerCase().includes(needle));
}
function patternLibrary(options) {
  const load = loadPatternTable(options.patternsFile);
  const table = load.data;
  const categoryEntries = asArray(table?.categories).map(asRecord).filter((entry) => entry !== null);
  const patternEntries = asArray(table?.patterns).map(asRecord).filter((entry) => entry !== null);
  const categories = categoryEntries.map(toCategorySummary);
  const allPatterns = patternEntries.map(toPatternSummary);
  const query = options.query?.trim() || null;
  const categoryFilter = options.category?.trim() || null;
  const patternFilter = options.pattern?.trim() || null;
  const enabled = (options.enabled ?? []).map((item) => item.trim()).filter(Boolean);
  let matches = allPatterns;
  if (categoryFilter)
    matches = matches.filter((pattern) => pattern.category === categoryFilter);
  if (query)
    matches = matches.filter((pattern) => matchesQuery(pattern, query));
  const selected = patternFilter ? allPatterns.find((pattern) => pattern.id === patternFilter) ?? null : null;
  const enabledSet = new Set(enabled);
  const conflicts = [];
  for (const pattern of allPatterns) {
    if (!enabledSet.has(pattern.id))
      continue;
    for (const other of pattern.conflictsWith) {
      if (enabledSet.has(other) && pattern.id < other) {
        conflicts.push({
          pattern: pattern.id,
          conflictsWith: other,
          reason: `${pattern.id} conflicts with ${other}; resolve before generating code`
        });
      }
    }
  }
  const found = !query || matches.length > 0;
  const status = load.source === "missing" ? "unavailable" : patternFilter && !selected ? "unknown" : query && !found ? "unknown" : "observed_locally";
  const result = {
    ...makeResult("pattern-library", status, "Programming-pattern catalog lookup", [], "offline"),
    table: {
      source: load.source,
      path: load.path,
      categoryCount: categories.length,
      patternCount: allPatterns.length
    },
    query,
    categoryFilter,
    patternFilter,
    enabled,
    categories,
    matches,
    selected,
    conflicts
  };
  if (load.source === "missing")
    result.errors.push("programming-patterns.json not found");
  result.summary = query ? `${matches.length} pattern(s) matching "${query}"` : `${allPatterns.length} pattern(s) across ${categories.length} categor(ies)`;
  if (conflicts.length > 0)
    result.summary += ` · ${conflicts.length} conflict(s)`;
  return result;
}

// tools/unity/unity-act/src/prefab.ts
import { createHash } from "node:crypto";
import { isAbsolute, join as join3 } from "node:path";

// tools/unity/unity-act/src/escalation.ts
var ESCALATION_LADDER = ["inspector", "prefab-patch", "unity-yaml-editing"];
var INSPECTOR_STEPS = [
  "Resolve the target with the inspector / SerializedObject API.",
  "Write a single SerializedProperty and call ApplyModifiedProperties.",
  "Re-read the property to confirm the write landed."
];
var PATCH_STEPS = [
  "Describe the edit as prefab patch JSON ops (ensure_child/ensure_component/set_property/...).",
  "Run `prefab patch --dryRun true` first; the dry run must mutate nothing.",
  "Inspect the proposed ops, then re-run without --dryRun and with confirm.",
  "Validate with compile + get_logs before trusting the edit."
];
var YAML_STEPS = [
  "Confirm the edit is genuinely unsupported by the inspector and patch ops.",
  "Load the unity-yaml-editing fallback and follow its decision order.",
  "Checkpoint the asset before editing and validate the GUID links after."
];
function decideEscalation(input) {
  const changeKind = input.hasUnsupportedOps ? "unsupported" : input.changeKind;
  if (changeKind === "unsupported") {
    return {
      rung: "unity-yaml-editing",
      ladder: ESCALATION_LADDER,
      changeKind,
      reason: "One or more ops are not expressible as inspector writes or prefab patch ops.",
      requiresDryRun: false,
      fallback: null,
      steps: YAML_STEPS
    };
  }
  if (changeKind === "single-property") {
    return {
      rung: "inspector",
      ladder: ESCALATION_LADDER,
      changeKind,
      reason: "A single serialized field is the cheapest and safest edit; start at rung 1.",
      requiresDryRun: false,
      fallback: "prefab-patch",
      steps: INSPECTOR_STEPS
    };
  }
  return {
    rung: "prefab-patch",
    ladder: ESCALATION_LADDER,
    changeKind,
    reason: changeKind === "structural" ? "Structural child/component changes are covered by prefab patch ops, but not by a single property write." : "Multiple property writes belong in one prefab patch load/save cycle.",
    requiresDryRun: true,
    fallback: "unity-yaml-editing",
    steps: PATCH_STEPS
  };
}
function inferChangeKind(ops, hasUnsupportedOps) {
  if (hasUnsupportedOps)
    return "unsupported";
  if (ops.some((op) => op.op === "ensure_child" || op.op === "ensure_component"))
    return "structural";
  if (ops.length === 1 && ops[0]?.op === "set_property")
    return "single-property";
  return "multi-property";
}

// tools/unity/unity-act/src/prefab.ts
var SUPPORTED_PATCH_OPS = [
  "ensure_child",
  "ensure_component",
  "set_property",
  "set_properties",
  "set_array",
  "append_array",
  "clear_array"
];
var REQUIRED_FIELDS = {
  ensure_child: [],
  ensure_component: ["typeName"],
  set_property: ["propertyName"],
  set_properties: ["values"],
  set_array: ["propertyName", "items"],
  append_array: ["propertyName", "items"],
  clear_array: ["propertyName"]
};
function resolveInputPath(projectRoot, path) {
  return isAbsolute(path) ? path : join3(projectRoot, path);
}
function parseRawOps(options) {
  let raw = null;
  if (options.opsJson) {
    try {
      raw = JSON.parse(options.opsJson);
    } catch (error) {
      return { ops: [], error: `opsJson is not valid JSON: ${error.message}` };
    }
  } else if (options.opsFile) {
    raw = readJson(resolveInputPath(options.projectRoot, options.opsFile));
    if (raw === null)
      return { ops: [], error: `ops file not found or unreadable: ${options.opsFile}` };
  } else {
    return { ops: [], error: "missing ops; pass --ops <file> or --opsJson <json>" };
  }
  const record = asRecord(raw);
  const list = Array.isArray(raw) ? raw : record ? record.ops ?? record.operations : null;
  if (!Array.isArray(list))
    return { ops: [], error: 'ops must be a JSON array or an object with an "ops" array' };
  const ops = [];
  for (const item of list) {
    const entry = asRecord(item);
    if (!entry)
      return { ops: [], error: "every op must be a JSON object" };
    ops.push(entry);
  }
  return { ops, error: null };
}
function normalizeOps(ops) {
  const normalized = [];
  const unsupported = [];
  const errors = [];
  ops.forEach((op, index) => {
    const name = str(op, "op");
    if (!name) {
      errors.push(`op #${index + 1} is missing "op"`);
      return;
    }
    if (!SUPPORTED_PATCH_OPS.includes(name)) {
      unsupported.push(name);
      errors.push(`op #${index + 1} uses unsupported op "${name}"`);
      return;
    }
    const target = asRecord(op.target);
    const targetPath = str(target, "path") ?? str(op, "path");
    for (const field of REQUIRED_FIELDS[name]) {
      if (op[field] === undefined || op[field] === null) {
        errors.push(`op #${index + 1} (${name}) is missing "${field}"`);
      }
    }
    if ((name === "ensure_component" || name === "set_property") && !targetPath) {
      errors.push(`op #${index + 1} (${name}) needs a target path`);
    }
    normalized.push({ index, op: name, targetPath, summary: summarize(name, targetPath), payload: op });
  });
  return { normalized, unsupported, errors };
}
function canonicalize(value) {
  if (Array.isArray(value))
    return value.map(canonicalize);
  if (value && typeof value === "object") {
    const source = value;
    const out = {};
    for (const key of Object.keys(source).sort())
      out[key] = canonicalize(source[key]);
    return out;
  }
  return value;
}
function summarize(op, targetPath) {
  const where = targetPath ? ` on ${targetPath}` : "";
  switch (op) {
    case "ensure_child":
      return `ensure child${where}`;
    case "ensure_component":
      return `ensure component${where}`;
    case "set_property":
      return `set one property${where}`;
    case "set_properties":
      return `set several properties${where}`;
    case "set_array":
      return `replace an array${where}`;
    case "append_array":
      return `append to an array${where}`;
    case "clear_array":
      return `clear an array${where}`;
    default:
      return op;
  }
}
function receiptPath(options) {
  return join3(projectDataDir(options), "act", "prefab-dryrun.json");
}
function readReceipts(path) {
  const raw = readJson(path);
  return raw && typeof raw === "object" ? raw : {};
}
function prefabAutomation(options, cliAvailable = null) {
  const base = makeResult("prefab-automation", "unknown", "Prefab patch proposal", [], "offline");
  const prefab = options.prefab ?? null;
  const parsed = parseRawOps(options);
  const { normalized, unsupported, errors } = normalizeOps(parsed.ops);
  const allErrors = parsed.error ? [parsed.error, ...errors] : errors;
  const changeKind = inferChangeKind(normalized, unsupported.length > 0);
  const escalation = decideEscalation({ changeKind, opCount: normalized.length, hasUnsupportedOps: unsupported.length > 0 });
  const gate = planActGate(options.gate, cliAvailable);
  const prefabExists = prefab ? fileExists(resolveInputPath(options.projectRoot, prefab)) : false;
  const canonicalOps = normalized.map((op) => ({
    op: op.op,
    targetPath: op.targetPath,
    payload: canonicalize(op.payload)
  }));
  const patchId = prefab && allErrors.length === 0 ? createHash("sha256").update(JSON.stringify({ prefab, ops: canonicalOps })).digest("hex") : null;
  const path = receiptPath(options);
  const receipts = readReceipts(path);
  const receipt = patchId ? receipts[patchId] : undefined;
  const result = {
    ...base,
    runMode: options.dryRun ? "dry-run" : "apply",
    prefab,
    prefabExists,
    patchId,
    opCount: normalized.length,
    ops: normalized,
    unsupported,
    dryRunReceipt: { recorded: Boolean(receipt), firstPass: Boolean(receipt), path: null },
    command: null,
    changeKind,
    escalation,
    gate,
    errors: allErrors
  };
  if (allErrors.length > 0) {
    result.status = "unknown";
    result.summary = `Refusing to propose prefab patch: ${allErrors[0]}`;
    return result;
  }
  if (!prefab) {
    result.status = "unknown";
    result.summary = "Refusing to propose prefab patch without --prefab";
    result.errors = ["missing --prefab <Assets/.../Thing.prefab>"];
    return result;
  }
  const opsArg = options.opsFile ? `--ops "${options.opsFile}"` : `--opsJson '${options.opsJson ?? ""}'`;
  if (options.dryRun) {
    const next = {
      ...receipts,
      [patchId]: { patchId, prefab, opCount: normalized.length, recordedAt: new Date().toISOString() }
    };
    writeJson(path, next);
    result.status = "proposed";
    result.mutated = false;
    result.dryRunReceipt = { recorded: true, firstPass: true, path };
    result.command = `unity command prefab patch --prefabPath "${prefab}" ${opsArg} --dryRun true --json --no-banner --quiet --non-interactive`;
    result.summary = `Dry run proposed ${normalized.length} op(s); nothing mutated`;
    return result;
  }
  result.dryRunReceipt = { recorded: Boolean(receipt), firstPass: Boolean(receipt), path };
  if (!options.confirm) {
    result.status = "refused";
    result.mutated = false;
    result.errors = ["refusing a non-dry run without --confirm"];
    result.summary = "Refused: a prefab write requires --confirm";
    return result;
  }
  if (!receipt) {
    const priorForPrefab = Object.values(receipts).find((entry) => entry.prefab === prefab);
    result.status = "refused";
    result.mutated = false;
    if (priorForPrefab) {
      result.errors = [`the ops changed since the dry-run for "${prefab}"; re-run --dryRun`];
      result.summary = "Refused: ops changed since the dry run (ADR-0018)";
    } else {
      result.errors = ["no dry-run receipt for these ops; run --dryRun first"];
      result.summary = "Refused: run --dryRun first (ADR-0018)";
    }
    return result;
  }
  result.status = "ready";
  result.mutated = false;
  result.command = `unity command prefab patch --prefabPath "${prefab}" ${opsArg} --dryRun false --json --no-banner --quiet --non-interactive`;
  result.summary = `Approved to apply ${normalized.length} op(s) after a recorded dry run`;
  return result;
}

// tools/unity/unity-act/src/scene.ts
var VALID_CHANGE_KINDS = ["single-property", "multi-property", "structural", "unsupported"];
function sceneEditing(options, cliAvailable = null) {
  const requested = options.changeKind?.trim() || null;
  const valid = requested && VALID_CHANGE_KINDS.includes(requested);
  const changeKind = valid ? requested : "single-property";
  const escalation = decideEscalation({ changeKind });
  const result = {
    ...makeResult("scene-editing", "observed_locally", "Scene/prefab edit escalation decision", [], "offline"),
    changeKind,
    requestedChangeKind: requested,
    escalation,
    gate: planActGate(options.gate, cliAvailable)
  };
  if (requested && !valid) {
    result.status = "unknown";
    result.errors.push(`unknown --change-kind "${requested}"; defaulted to single-property`);
  }
  result.summary = `rung: ${escalation.rung} (${changeKind})${escalation.requiresDryRun ? " · dry run required" : ""}`;
  return result;
}

// tools/unity/unity-act/src/templates.ts
import { mkdirSync as mkdirSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { dirname as dirname3, join as join4 } from "node:path";
function namespaceWrap(namespace, body) {
  if (!namespace)
    return body;
  const indented = body.split(`
`).map((line) => line.trim() === "" ? "" : `    ${line}`).join(`
`);
  return `namespace ${namespace}
{
${indented}
}
`;
}
function scriptRegistry() {
  return {
    monobehaviour: {
      language: "csharp",
      defaultName: "NewBehaviour",
      fileName: (name) => `${name}.cs`,
      render: (name, namespace) => namespaceWrap(namespace, [
        "using UnityEngine;",
        "",
        `public sealed class ${name} : MonoBehaviour`,
        "{",
        "    [SerializeField] private float speed = 5f;",
        "",
        "    private void Awake()",
        "    {",
        "    }",
        "",
        "    private void Update()",
        "    {",
        "        transform.position += Vector3.forward * (speed * Time.deltaTime);",
        "    }",
        "}",
        ""
      ].join(`
`))
    },
    "scriptable-object": {
      language: "csharp",
      defaultName: "NewData",
      fileName: (name) => `${name}.cs`,
      render: (name, namespace) => namespaceWrap(namespace, [
        "using UnityEngine;",
        "",
        '[CreateAssetMenu(menuName = "OAC/' + name + '", fileName = "' + name + '")]',
        `public sealed class ${name} : ScriptableObject`,
        "{",
        "    [SerializeField] private string displayName;",
        "    [SerializeField, TextArea] private string description;",
        "",
        "    public string DisplayName => displayName;",
        "    public string Description => description;",
        "}",
        ""
      ].join(`
`))
    },
    "editor-window": {
      language: "csharp",
      defaultName: "NewToolWindow",
      fileName: (name) => `${name}.cs`,
      render: (name, namespace) => namespaceWrap(namespace, [
        "using UnityEditor;",
        "using UnityEngine;",
        "",
        `public sealed class ${name} : EditorWindow`,
        "{",
        '    [MenuItem("Tools/OAC/' + name + '")]',
        "    private static void Open()",
        "    {",
        `        GetWindow<${name}>("${name}");`,
        "    }",
        "",
        "    private void OnGUI()",
        "    {",
        '        EditorGUILayout.LabelField("OAC tool window");',
        "    }",
        "}",
        ""
      ].join(`
`))
    },
    test: {
      language: "csharp",
      defaultName: "NewTests",
      fileName: (name) => `${name}.cs`,
      render: (name, namespace) => namespaceWrap(namespace, [
        "using NUnit.Framework;",
        "",
        "[TestFixture]",
        `public sealed class ${name}`,
        "{",
        "    [Test]",
        "    public void Describes_the_expected_behaviour()",
        "    {",
        "        Assert.Pass();",
        "    }",
        "}",
        ""
      ].join(`
`))
    },
    asmdef: {
      language: "json",
      defaultName: "NewAssembly",
      fileName: (name) => `${name}.asmdef`,
      render: (name) => JSON.stringify({ name, references: [], includePlatforms: [], allowUnsafeCode: false }, null, 2) + `
`
    },
    interface: {
      language: "csharp",
      defaultName: "INewService",
      fileName: (name) => `${name}.cs`,
      render: (name, namespace) => namespaceWrap(namespace, [`public interface ${name}`, "{", "    void Execute();", "}", ""].join(`
`))
    },
    enum: {
      language: "csharp",
      defaultName: "NewState",
      fileName: (name) => `${name}.cs`,
      render: (name, namespace) => namespaceWrap(namespace, [`public enum ${name}`, "{", "    None = 0,", "    Active = 1,", "}", ""].join(`
`))
    }
  };
}
function shaderRegistry() {
  return {
    unlit: {
      language: "shaderlab",
      defaultName: "OacUnlit",
      fileName: (name) => `${name}.shader`,
      render: (name) => [
        `Shader "OAC/${name}"`,
        "{",
        "    Properties",
        "    {",
        '        _BaseColor ("Base Color", Color) = (1, 1, 1, 1)',
        '        _MainTex ("Texture", 2D) = "white" {}',
        "    }",
        "    SubShader",
        "    {",
        '        Tags { "RenderType" = "Opaque" "Queue" = "Geometry" }',
        "        LOD 100",
        "        Pass",
        "        {",
        "            CGPROGRAM",
        "            #pragma vertex vert",
        "            #pragma fragment frag",
        '            #include "UnityCG.cginc"',
        "",
        "            struct appdata { float4 vertex : POSITION; float2 uv : TEXCOORD0; };",
        "            struct v2f { float4 vertex : SV_POSITION; float2 uv : TEXCOORD0; };",
        "",
        "            sampler2D _MainTex; float4 _MainTex_ST; fixed4 _BaseColor;",
        "",
        "            v2f vert(appdata v)",
        "            {",
        "                v2f o;",
        "                o.vertex = UnityObjectToClipPos(v.vertex);",
        "                o.uv = TRANSFORM_TEX(v.uv, _MainTex);",
        "                return o;",
        "            }",
        "",
        "            fixed4 frag(v2f i) : SV_Target",
        "            {",
        "                return tex2D(_MainTex, i.uv) * _BaseColor;",
        "            }",
        "            ENDCG",
        "        }",
        "    }",
        "}",
        ""
      ].join(`
`)
    },
    "urp-unlit": {
      language: "shaderlab",
      defaultName: "OacUrpUnlit",
      fileName: (name) => `${name}.shader`,
      render: (name) => [
        `Shader "OAC/URP/${name}"`,
        "{",
        "    Properties",
        "    {",
        '        _BaseMap ("Base Map", 2D) = "white" {}',
        '        _BaseColor ("Base Color", Color) = (1, 1, 1, 1)',
        "    }",
        "    SubShader",
        "    {",
        '        Tags { "RenderType" = "Opaque" "RenderPipeline" = "UniversalPipeline" }',
        "        Pass",
        "        {",
        '            Name "Forward"',
        "            HLSLPROGRAM",
        "            #pragma vertex Vert",
        "            #pragma fragment Frag",
        '            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"',
        "",
        "            TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);",
        "            CBUFFER_START(UnityPerMaterial)",
        "            float4 _BaseMap_ST;",
        "            half4 _BaseColor;",
        "            CBUFFER_END",
        "",
        "            struct Attributes { float4 positionOS : POSITION; float2 uv : TEXCOORD0; };",
        "            struct Varyings { float4 positionHCS : SV_POSITION; float2 uv : TEXCOORD0; };",
        "",
        "            Varyings Vert(Attributes input)",
        "            {",
        "                Varyings output;",
        "                output.positionHCS = TransformObjectToHClip(input.positionOS.xyz);",
        "                output.uv = TRANSFORM_TEX(input.uv, _BaseMap);",
        "                return output;",
        "            }",
        "",
        "            half4 Frag(Varyings input) : SV_Target",
        "            {",
        "                return SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, input.uv) * _BaseColor;",
        "            }",
        "            ENDHLSL",
        "        }",
        "    }",
        "}",
        ""
      ].join(`
`)
    },
    "urp-lit": {
      language: "shaderlab",
      defaultName: "OacUrpLit",
      fileName: (name) => `${name}.shader`,
      render: (name) => [
        `Shader "OAC/URP/${name}"`,
        "{",
        "    Properties",
        "    {",
        '        _BaseMap ("Base Map", 2D) = "white" {}',
        '        _BaseColor ("Base Color", Color) = (1, 1, 1, 1)',
        '        _Smoothness ("Smoothness", Range(0, 1)) = 0.5',
        "    }",
        "    SubShader",
        "    {",
        '        Tags { "RenderType" = "Opaque" "RenderPipeline" = "UniversalPipeline" }',
        "        Pass",
        "        {",
        '            Name "ForwardLit"',
        '            Tags { "LightMode" = "UniversalForward" }',
        "            HLSLPROGRAM",
        "            #pragma vertex Vert",
        "            #pragma fragment Frag",
        '            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"',
        "",
        "            TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);",
        "            CBUFFER_START(UnityPerMaterial)",
        "            float4 _BaseMap_ST;",
        "            half4 _BaseColor;",
        "            half _Smoothness;",
        "            CBUFFER_END",
        "",
        "            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; float2 uv : TEXCOORD0; };",
        "            struct Varyings { float4 positionHCS : SV_POSITION; float2 uv : TEXCOORD0; float3 normalWS : TEXCOORD1; };",
        "",
        "            Varyings Vert(Attributes input)",
        "            {",
        "                Varyings output;",
        "                VertexPositionInputs positions = GetVertexPositionInputs(input.positionOS.xyz);",
        "                output.positionHCS = positions.positionCS;",
        "                output.normalWS = TransformObjectToWorldNormal(input.normalOS);",
        "                output.uv = TRANSFORM_TEX(input.uv, _BaseMap);",
        "                return output;",
        "            }",
        "",
        "            half4 Frag(Varyings input) : SV_Target",
        "            {",
        "                half3 albedo = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, input.uv).rgb * _BaseColor.rgb;",
        "                Light mainLight = GetMainLight();",
        "                half ndotl = saturate(dot(normalize(input.normalWS), mainLight.direction));",
        "                half3 lit = albedo * (mainLight.color * ndotl + 0.1h);",
        "                return half4(lit, 1.0h);",
        "            }",
        "            ENDHLSL",
        "        }",
        "    }",
        "}",
        ""
      ].join(`
`)
    },
    fullscreen: {
      language: "shaderlab",
      defaultName: "OacFullscreen",
      fileName: (name) => `${name}.shader`,
      render: (name) => [
        `Shader "OAC/Fullscreen/${name}"`,
        "{",
        "    SubShader",
        "    {",
        '        Tags { "RenderPipeline" = "UniversalPipeline" }',
        "        Cull Off ZWrite Off ZTest Always",
        "        Pass",
        "        {",
        '            Name "FullscreenBlit"',
        "            HLSLPROGRAM",
        "            #pragma vertex Vert",
        "            #pragma fragment Frag",
        '            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"',
        '            #include "Packages/com.unity.render-pipelines.core/Runtime/Utilities/Blit.hlsl"',
        "",
        "            half4 Frag(Varyings input) : SV_Target",
        "            {",
        "                float2 uv = input.texcoord;",
        "                return SAMPLE_TEXTURE2D_X(_BlitTexture, sampler_LinearClamp, uv);",
        "            }",
        "            ENDHLSL",
        "        }",
        "    }",
        "}",
        ""
      ].join(`
`)
    }
  };
}
function inputRegistry() {
  return {
    "input-actions": {
      language: "json",
      defaultName: "GameControls",
      fileName: (name) => `${name}.inputactions`,
      render: (name, _namespace, options) => renderInputActions(name, options.map ?? "Player")
    },
    "player-input-actions": {
      language: "json",
      defaultName: "PlayerControls",
      fileName: (name) => `${name}.inputactions`,
      render: (name, _namespace, options) => renderInputActions(name, options.map ?? "Player")
    },
    "input-reader": {
      language: "csharp",
      defaultName: "InputReader",
      fileName: (name) => `${name}.cs`,
      render: (name, namespace, options) => namespaceWrap(namespace, [
        "using UnityEngine;",
        "using UnityEngine.InputSystem;",
        "",
        `public sealed class ${name} : MonoBehaviour`,
        "{",
        "    [SerializeField] private InputActionAsset actions;",
        '    [SerializeField] private string actionMap = "' + (options.map ?? "Player") + '";',
        "",
        "    private InputAction moveAction;",
        "",
        "    private void OnEnable()",
        "    {",
        "        if (actions == null) return;",
        "        actions.FindActionMap(actionMap, true).Enable();",
        '        moveAction = actions.FindAction(actionMap + "/Move");',
        "    }",
        "",
        "    private void OnDisable()",
        "    {",
        "        if (actions != null) actions.FindActionMap(actionMap, false)?.Disable();",
        "    }",
        "",
        "    private void Update()",
        "    {",
        "        if (moveAction == null) return;",
        "        Vector2 move = moveAction.ReadValue<Vector2>();",
        "        transform.position += new Vector3(move.x, 0f, move.y) * Time.deltaTime;",
        "    }",
        "}",
        ""
      ].join(`
`))
    },
    "input-map-json": {
      language: "json",
      defaultName: "InputMap",
      fileName: (name) => `${name}.json`,
      render: (name, _namespace, options) => JSON.stringify({
        name,
        map: options.map ?? "Player",
        actions: [
          { name: "Move", type: "Value", controlType: "Vector2" },
          { name: "Look", type: "Value", controlType: "Vector2" },
          { name: "Jump", type: "Button", controlType: "Button" },
          { name: "Fire", type: "Button", controlType: "Button" }
        ]
      }, null, 2) + `
`
    }
  };
}
function renderInputActions(name, map) {
  const document = {
    name,
    maps: [
      {
        name: map,
        id: `${name}-${map}`,
        actions: [
          { name: "Move", type: "Value", controlType: "Vector2" },
          { name: "Look", type: "Value", controlType: "Vector2" },
          { name: "Jump", type: "Button", controlType: "Button" },
          { name: "Fire", type: "Button", controlType: "Button" }
        ],
        bindings: [
          { action: "Move", path: "<Gamepad>/leftStick", groups: "Gamepad" },
          { action: "Move", path: "2DVector", groups: "Keyboard&Mouse", isComposite: true },
          { action: "Move", path: "<Keyboard>/w", groups: "Keyboard&Mouse", isPartOfComposite: true },
          { action: "Move", path: "<Keyboard>/s", groups: "Keyboard&Mouse", isPartOfComposite: true },
          { action: "Move", path: "<Keyboard>/a", groups: "Keyboard&Mouse", isPartOfComposite: true },
          { action: "Move", path: "<Keyboard>/d", groups: "Keyboard&Mouse", isPartOfComposite: true },
          { action: "Look", path: "<Mouse>/delta", groups: "Keyboard&Mouse" },
          { action: "Look", path: "<Gamepad>/rightStick", groups: "Gamepad" },
          { action: "Jump", path: "<Keyboard>/space", groups: "Keyboard&Mouse" },
          { action: "Jump", path: "<Gamepad>/buttonSouth", groups: "Gamepad" },
          { action: "Fire", path: "<Mouse>/leftButton", groups: "Keyboard&Mouse" },
          { action: "Fire", path: "<Gamepad>/rightTrigger", groups: "Gamepad" }
        ]
      }
    ],
    controlSchemes: [
      { name: "Keyboard&Mouse", bindingGroup: "Keyboard&Mouse" },
      { name: "Gamepad", bindingGroup: "Gamepad" }
    ]
  };
  return JSON.stringify(document, null, 2) + `
`;
}
function emit(options, registry, defaultTemplate, label) {
  const template = options.template?.trim() || defaultTemplate;
  const available = Object.keys(registry);
  const entry = registry[template];
  const base = makeResult(options.ability, "unknown", `${label} template`, [], "local");
  const result = {
    ...base,
    template,
    language: null,
    fileName: null,
    content: null,
    written: false,
    outPath: null,
    available
  };
  if (!entry) {
    result.errors = [`unknown template "${template}"; available: ${available.join(", ")}`];
    result.summary = `Unknown ${label.toLowerCase()} template "${template}"`;
    return result;
  }
  const name = options.name?.trim() || entry.defaultName;
  const namespace = options.namespace?.trim() || "";
  const content = entry.render(name, namespace, options);
  const fileName = entry.fileName(name);
  result.language = entry.language;
  result.fileName = fileName;
  result.content = content;
  if (!options.out) {
    result.status = "proposed";
    result.summary = `Proposed ${fileName} (${content.length} chars); nothing written`;
    return result;
  }
  const outPath = options.out;
  if (options.dryRun) {
    result.status = "proposed";
    result.outPath = outPath;
    result.summary = `Dry run: would write ${fileName} to ${outPath}; nothing written`;
    return result;
  }
  if (!options.confirm) {
    result.status = "refused";
    result.errors = ["refusing to write without --confirm"];
    result.summary = "Refused: writing a file requires --confirm";
    return result;
  }
  const target = outPath.endsWith(fileName) ? outPath : join4(outPath, fileName);
  mkdirSync2(dirname3(target), { recursive: true });
  writeFileSync2(target, content);
  result.status = "written";
  result.written = true;
  result.mutated = true;
  result.outPath = target;
  result.summary = `Wrote ${fileName} to ${target}`;
  return result;
}
function scriptScaffolding(options) {
  return emit(options, scriptRegistry(), "monobehaviour", "Script");
}
function shaderHelper(options) {
  return emit(options, shaderRegistry(), "urp-unlit", "Shader");
}
function inputAutomation(options) {
  return emit(options, inputRegistry(), "input-actions", "Input");
}

// tools/unity/unity-act/src/abilities.ts
function runAct(options) {
  const cliAvailable = options.gate ? detectUnityCli() : null;
  switch (options.ability) {
    case "scene-editing":
      return sceneEditing(options, cliAvailable);
    case "prefab-automation":
      return prefabAutomation(options, cliAvailable);
    case "script-scaffolding":
      return scriptScaffolding(options);
    case "shader-helper":
      return shaderHelper(options);
    case "pattern-library":
      return patternLibrary(options);
    case "input-automation":
      return inputAutomation(options);
    default: {
      const exhaustive = options.ability;
      throw new Error(`unsupported Act ability: ${String(exhaustive)}`);
    }
  }
}

// tools/unity/unity-act/src/cli.ts
import { join as join5, resolve } from "node:path";

// tools/shared/cli-args.ts
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

// tools/unity/unity-act/src/cli.ts
function resolveOptions(argv) {
  const args = parseArgs(argv);
  const projectRoot = resolve(String(args["project-root"] || process.cwd()));
  const opencodeDir = resolve(String(args["opencode-dir"] || join5(projectRoot, ".opencode")));
  const requested = String(args.ability || "scene-editing");
  const ability = resolveAbility(requested, ACT_ABILITIES, "scene-editing");
  const dryRunRaw = args.dryRun ?? args["dry-run"] ?? args.dryrun;
  const enabled = firstString(args, ["enabled"]);
  return {
    projectRoot,
    opencodeDir,
    ability,
    json: Boolean(args.json),
    list: Boolean(args.list),
    dryRun: parseBool(dryRunRaw, true),
    confirm: parseBool(args.confirm, false),
    gate: parseBool(args.gate, false),
    query: firstString(args, ["query"]),
    category: firstString(args, ["category"]),
    pattern: firstString(args, ["pattern"]),
    enabled: enabled ? enabled.split(",").map((item) => item.trim()).filter(Boolean) : undefined,
    changeKind: firstString(args, ["change-kind", "changeKind"]),
    prefab: firstString(args, ["prefab", "prefab-path", "prefabPath"]),
    opsFile: firstString(args, ["ops", "ops-file"]),
    opsJson: firstString(args, ["ops-json", "opsJson"]),
    template: firstString(args, ["template"]),
    name: firstString(args, ["name"]),
    namespace: firstString(args, ["namespace"]),
    map: firstString(args, ["map"]),
    out: firstString(args, ["out"]),
    patternsFile: firstString(args, ["patterns-file", "patternsFile"])
  };
}

// tools/unity/unity-act/src/index.ts
function render(result) {
  const lines = [`[${result.ability}] ${result.status} — ${result.summary}`];
  lines.push(`  mutated: ${result.mutated} · route: ${result.route} · mode: ${result.mode}`);
  if ("escalation" in result)
    lines.push(`  rung: ${result.escalation.rung}`);
  if ("written" in result && result.fileName)
    lines.push(`  file: ${result.fileName}`);
  if ("conflicts" in result && result.conflicts.length > 0) {
    for (const conflict of result.conflicts)
      lines.push(`  conflict: ${conflict.pattern} vs ${conflict.conflictsWith}`);
  }
  for (const error of result.errors)
    lines.push(`  error: ${error}`);
  return lines.join(`
`);
}
runCli({ abilities: ACT_ABILITIES, resolveOptions, run: runAct, render });
