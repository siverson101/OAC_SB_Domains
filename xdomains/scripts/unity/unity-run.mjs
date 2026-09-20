// tools/shared/cli-bootstrap.ts
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
  const result = config.run(options);
  if (options.json) {
    write(JSON.stringify(result, null, 2) + `
`);
    return;
  }
  write(config.render(result) + `
`);
}

// tools/unity/unity-run/src/change-loop.ts
import { join as join2 } from "node:path";

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

// tools/unity/unity-run/src/types.ts
var RUN_ABILITY_NAMES = [
  "unity-change-loop",
  "runtime-debugging",
  "runtime-ui-validation",
  "performance-diagnostics",
  "uitk-interaction"
];
var RUN_ABILITIES = [...RUN_ABILITY_NAMES];
var RUNTIME_ABILITIES = [
  "runtime-debugging",
  "runtime-ui-validation",
  "performance-diagnostics",
  "uitk-interaction"
];
var RUN_MODES = {
  "unity-change-loop": "both",
  "runtime-debugging": "live",
  "runtime-ui-validation": "live",
  "performance-diagnostics": "live",
  "uitk-interaction": "live"
};
// tools/shared/json-helpers.ts
function asRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
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

// tools/unity/unity-run/src/shared.ts
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

// tools/unity/unity-run/src/shared.ts
function projectDataDir(options) {
  return join(options.opencodeDir, "project-data");
}
function runDataDir(options) {
  return join(projectDataDir(options), "run");
}
function makeResult(ability, status, summary, errors, options = {}) {
  return {
    ...makeEnvelope({
      ability,
      family: "run",
      mode: "offline",
      status,
      summary,
      errors,
      route: options.route ?? "offline"
    }),
    safetyGate: {
      requiresEditor: options.requiresEditor ?? false,
      requiresApproval: options.requiresApproval ?? false,
      approved: options.approved ?? false
    }
  };
}

// tools/unity/unity-run/src/change-loop.ts
var CHANGE_LOOP_STAGES = [
  { name: "resolve", order: 1, purpose: "Resolve the request to concrete files and symbols.", gate: null, requires: ["change-scope"] },
  { name: "inspect", order: 2, purpose: "Read the current code/scene before touching it.", gate: null, requires: [] },
  { name: "change", order: 3, purpose: "Make the smallest change that satisfies the request.", gate: null, requires: ["change-scope"] },
  { name: "compile", order: 4, purpose: "Compile and confirm fresh assemblies, not a silent no-op.", gate: "compile", requires: ["compile-state"] },
  { name: "logs", order: 5, purpose: "Read the Editor/runtime logs for errors introduced by the change.", gate: "logs", requires: ["logs"] },
  { name: "tests", order: 6, purpose: "Run the applicable tests; green tests are required for done.", gate: "tests", requires: ["tests"] },
  { name: "observe", order: 7, purpose: "Observe the result (screenshot/visual verification) when relevant.", gate: "observe", requires: ["screenshot"] }
];
var REQUIRED_GATES = ["compile", "logs", "tests"];
function gate(compileState) {
  if (!compileState) {
    return { gate: "compile", status: "unavailable", detail: "no compile-state artefact" };
  }
  if (str(compileState, "status") === "unavailable") {
    return { gate: "compile", status: "unavailable", detail: "Library/ScriptAssemblies missing" };
  }
  if (bool(compileState, "stale") === true) {
    return { gate: "compile", status: "failed", detail: "scripts newer than assemblies" };
  }
  if (bool(compileState, "noOpRecompile") === true) {
    return { gate: "compile", status: "failed", detail: "silent no-op recompile" };
  }
  if (num(compileState, "assemblyCount") === 0) {
    return { gate: "compile", status: "failed", detail: "no assemblies produced" };
  }
  return { gate: "compile", status: "passed", detail: "fresh assemblies observed" };
}
function logsGate(logDigest) {
  if (!logDigest) {
    return { gate: "logs", status: "unavailable", detail: "no log-digest artefact" };
  }
  if (str(logDigest, "status") === "unavailable") {
    return { gate: "logs", status: "unavailable", detail: "Editor log unavailable" };
  }
  const errors = num(logDigest, "errorCount") ?? 0;
  if (errors > 0) {
    return { gate: "logs", status: "failed", detail: `${errors} error(s) in the log digest` };
  }
  return { gate: "logs", status: "passed", detail: "no errors in the log digest" };
}
function countsTotal(counts) {
  return counts?.total ?? 0;
}
function countsFailed(counts) {
  return counts?.failed ?? 0;
}
function testsGate(testResults) {
  const editMode = testResults?.editMode ?? null;
  const playMode = testResults?.playMode ?? null;
  if (!editMode && !playMode) {
    return { gate: "tests", status: "missing", detail: "no test results recorded" };
  }
  const total = countsTotal(editMode) + countsTotal(playMode);
  const failed = countsFailed(editMode) + countsFailed(playMode);
  if (total === 0) {
    return { gate: "tests", status: "missing", detail: "tests ran but reported zero tests" };
  }
  if (failed > 0) {
    return { gate: "tests", status: "failed", detail: `${failed} failing test(s) of ${total}` };
  }
  return { gate: "tests", status: "passed", detail: `${total} test(s) green` };
}
function observeGate(screenshot) {
  if (!screenshot) {
    return { gate: "observe", status: "missing", detail: "no screenshot evidence" };
  }
  if (screenshot.captured === false) {
    return { gate: "observe", status: "missing", detail: "screenshot not captured" };
  }
  return { gate: "observe", status: "passed", detail: `screenshot: ${screenshot.path ?? "captured"}` };
}
function citation(name, present, source, detail) {
  return { name, present, source, detail };
}
function citeEvidence(evidence) {
  const compile = evidence.compileState ?? null;
  const logs = evidence.logDigest ?? null;
  const tests = evidence.testResults ?? null;
  const screenshot = evidence.screenshot ?? null;
  const hasTests = Boolean(tests && (tests.editMode || tests.playMode));
  const testDetail = hasTests ? `${countsTotal(tests?.editMode) + countsTotal(tests?.playMode)} test(s), ${countsFailed(tests?.editMode) + countsFailed(tests?.playMode)} failing` : "not recorded";
  return [
    citation("change-scope", Boolean(evidence.changeScope), "request", evidence.changeScope ?? "not recorded"),
    citation("compile-state", compile !== null, "project-data/compile-state.json", str(compile, "status") ?? "not recorded"),
    citation("logs", logs !== null, "project-data/log-digest.json", `${num(logs, "errorCount") ?? 0} error(s)`),
    citation("tests", hasTests, "project-data/unity-verification-report.json", testDetail),
    citation("screenshot", screenshot !== null, screenshot?.path ?? "project-data/run/screenshot.json", screenshot?.path ?? "not recorded")
  ];
}
function refusalReasons(gates) {
  const reasons = [];
  const tests = gates.find((entry) => entry.gate === "tests");
  const compile = gates.find((entry) => entry.gate === "compile");
  const logs = gates.find((entry) => entry.gate === "logs");
  if (!tests || tests.status !== "passed") {
    reasons.push(`refuse "done": tests are not green (${tests?.detail ?? "no test results"})`);
  }
  if (!compile || compile.status !== "passed") {
    reasons.push(`refuse "done": compile gate not green (${compile?.detail ?? "no compile state"})`);
  }
  if (!logs || logs.status !== "passed") {
    reasons.push(`refuse "done": log gate not green (${logs?.detail ?? "no logs"})`);
  }
  return reasons;
}
function evaluateChangeLoop(evidence, claim) {
  const gates = [
    gate(evidence.compileState ?? null),
    logsGate(evidence.logDigest ?? null),
    testsGate(evidence.testResults ?? null),
    observeGate(evidence.screenshot ?? null)
  ];
  const evidenceCitations = citeEvidence(evidence);
  const required = gates.filter((entry) => REQUIRED_GATES.includes(entry.gate));
  const done = required.every((entry) => entry.status === "passed");
  const wantsDone = (claim ?? "").trim().toLowerCase() === "done";
  let status;
  const refusals = [];
  if (done) {
    status = "done";
  } else if (wantsDone) {
    status = "refused";
    refusals.push(...refusalReasons(gates));
  } else {
    status = "in_progress";
  }
  const summary = done ? `done: ${required.length}/${required.length} required gates green` : wantsDone ? `refused "done": ${refusals.length} unmet required gate(s)` : `in progress: ${required.filter((entry) => entry.status === "passed").length}/${required.length} required gates green`;
  return { stages: CHANGE_LOOP_STAGES, gates, evidence: evidenceCitations, done, refusals, status, summary };
}
function testCounts(data, key) {
  const record = asRecord(data?.[key]);
  if (!record)
    return null;
  const total = num(record, "total");
  if (total === null)
    return null;
  return {
    total,
    passed: num(record, "passed") ?? 0,
    failed: num(record, "failed") ?? 0,
    skipped: num(record, "skipped") ?? 0,
    inconclusive: num(record, "inconclusive") ?? 0,
    result: str(record, "result") ?? "Unknown"
  };
}
function gatherChangeLoopEvidence(options, changeScope) {
  const dataDir = projectDataDir(options);
  const compileState = readJson(join2(dataDir, "compile-state.json"));
  const logDigest = readJson(join2(dataDir, "log-digest.json"));
  const report = readJson(join2(dataDir, "unity-verification-report.json"));
  const summary = asRecord(report?.summary);
  const screenshotRecord = readJson(join2(runDataDir(options), "screenshot.json"));
  const screenshotPath = str(screenshotRecord, "path");
  return {
    changeScope: changeScope ?? null,
    compileState,
    logDigest,
    testResults: report ? { editMode: testCounts(summary, "editMode"), playMode: testCounts(summary, "playMode") } : null,
    screenshot: screenshotRecord ? { path: screenshotPath, captured: bool(screenshotRecord, "captured") ?? screenshotPath !== null } : null
  };
}
function runChangeLoop(options) {
  const evidence = gatherChangeLoopEvidence(options, options.scope);
  const evaluation = evaluateChangeLoop(evidence, options.claim);
  const base = makeResult("unity-change-loop", evaluation.status, evaluation.summary, [], {
    route: "offline",
    requiresEditor: false
  });
  base.mode = RUN_MODES["unity-change-loop"];
  if (evaluation.status === "refused")
    base.errors.push(...evaluation.refusals);
  return { ...base, ...evaluation };
}

// tools/shared/toolchain.ts
import { spawnSync } from "node:child_process";
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

// tools/unity/gather-unity-context/src/producers.ts
function runCli2(cliCommand, args, timeout = 30000) {
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
    route: selectRoute({ live: null, cliAvailable: parsed != null }).route,
    data: parsed?.data ?? null,
    errors: parsed?.errors ?? (res.ok ? [] : [{ message: res.stderr || res.stdout || `exit ${res.status}` }]),
    warnings: parsed?.warnings ?? [],
    raw: res.stdout || res.stderr
  };
}

// tools/unity/gather-unity-context/src/editor.ts
function findLiveInstance(projectRoot, cliCommand) {
  const env = runCli2(cliCommand, [
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

// tools/unity/unity-run/src/approval.ts
function checkCodeExecutionApproval(options) {
  const approved = options.approveCodeExecution === true;
  if (!approved) {
    return {
      required: true,
      approved: false,
      allowed: false,
      reason: "runtime code execution requires explicit approval (--approve-code-execution)"
    };
  }
  return {
    required: true,
    approved: true,
    allowed: true,
    reason: "explicit approval recorded"
  };
}

// tools/unity/unity-run/src/runtime.ts
var OPERATION_SPECS = {
  get_logs: { operation: "get_logs", command: "get_logs", args: ["--logType", "Error"], codeExecution: false },
  "execute-code": { operation: "execute-code", command: "eval", args: [], codeExecution: true },
  ui_snapshot: { operation: "ui_snapshot", command: "ui_snapshot", args: [], codeExecution: false },
  ui_find: { operation: "ui_find", command: "ui_find", args: [], codeExecution: false },
  ui_click: { operation: "ui_click", command: "ui_click", args: [], codeExecution: false },
  ui_key: { operation: "ui_key", command: "ui_key", args: [], codeExecution: false },
  profiler_counters: { operation: "profiler_counters", command: "profiler_counters", args: [], codeExecution: false },
  profiler_snapshot: { operation: "profiler_snapshot", command: "profiler_snapshot", args: [], codeExecution: false },
  uitk_tree: { operation: "uitk_tree", command: "uitk_tree", args: [], codeExecution: false },
  uitk_click: { operation: "uitk_click", command: "uitk_click", args: [], codeExecution: false }
};
var ABILITY_OPERATIONS = {
  "runtime-debugging": ["get_logs", "execute-code"],
  "runtime-ui-validation": ["ui_snapshot", "ui_find", "ui_click", "ui_key"],
  "performance-diagnostics": ["profiler_counters", "profiler_snapshot"],
  "uitk-interaction": ["uitk_tree", "uitk_click"]
};
var DEFAULT_OPERATION = {
  "runtime-debugging": "get_logs",
  "runtime-ui-validation": "ui_snapshot",
  "performance-diagnostics": "profiler_counters",
  "uitk-interaction": "uitk_tree"
};
function isRuntimeAbility(ability) {
  return RUNTIME_ABILITIES.includes(ability);
}
function resolveOperation(ability, requested) {
  const allowed = ABILITY_OPERATIONS[ability];
  const errors = [];
  let operation = DEFAULT_OPERATION[ability];
  if (requested && requested.trim() !== "") {
    if (allowed.includes(requested)) {
      operation = requested;
    } else {
      errors.push(`unknown --operation "${requested}" for ${ability}; defaulted to ${operation}`);
    }
  }
  return { spec: OPERATION_SPECS[operation], errors };
}
function buildCommand(options, spec) {
  const args = spec.codeExecution ? [options.code ?? ""] : [...spec.args];
  return [
    spec.command,
    ...args,
    "--json",
    "--no-banner",
    "--quiet",
    "--non-interactive",
    "--project-path",
    options.projectRoot
  ];
}
function channelAvailable(channel) {
  if (!channel)
    return false;
  try {
    return channel.available() === true;
  } catch {
    return false;
  }
}
function resolveRuntimeChannel(options) {
  if (options.live !== undefined)
    return options.live;
  if (!findExecutable(options.cliCommand))
    return null;
  const instance = findLiveInstance(options.projectRoot, options.cliCommand);
  if (!instance)
    return null;
  return { transport: "cli", available: () => true };
}
function errorMessage(err) {
  return err instanceof Error ? err.message : String(err);
}
function runRuntimeAbility(options) {
  const ability = options.ability;
  const { spec, errors } = resolveOperation(ability, options.operation);
  const command = buildCommand(options, spec);
  const base = makeResult(ability, "unavailable", `${spec.operation} unavailable`, [], {
    route: "offline",
    requiresEditor: true,
    requiresApproval: spec.codeExecution,
    approved: spec.codeExecution && options.approveCodeExecution
  });
  base.mode = RUN_MODES[ability];
  if (spec.codeExecution && (options.code ?? "").trim() === "") {
    const reason = "execute-code requires --code <csharp>";
    return {
      ...base,
      status: "refused",
      summary: reason,
      errors: [...errors, reason],
      operation: spec.operation,
      transport: null,
      command,
      data: null,
      approval: null
    };
  }
  let approval = null;
  if (spec.codeExecution) {
    approval = checkCodeExecutionApproval(options);
    if (!approval.allowed) {
      return {
        ...base,
        status: "refused",
        summary: approval.reason,
        errors: [...errors, approval.reason],
        operation: spec.operation,
        transport: null,
        command,
        data: null,
        approval
      };
    }
  }
  const channel = resolveRuntimeChannel(options);
  const transport = channel?.transport ?? null;
  if (!channelAvailable(channel)) {
    const reason = `no live channel/Editor for ${ability}; ${spec.operation} unavailable`;
    return {
      ...base,
      status: "unavailable",
      summary: reason,
      errors: [...errors, reason],
      route: "offline",
      operation: spec.operation,
      transport,
      command,
      data: null,
      approval
    };
  }
  if (!channel?.invoke) {
    const reason = `live ${channel?.transport} channel present but no transport wired for ${spec.operation}`;
    return {
      ...base,
      status: "unavailable",
      summary: reason,
      errors: [...errors, reason],
      route: "live",
      operation: spec.operation,
      transport,
      command,
      data: null,
      approval
    };
  }
  try {
    const response = channel.invoke({ operation: spec.operation, args: command });
    if (!response.ok) {
      return {
        ...base,
        status: "unknown",
        summary: `${spec.operation} failed on the live channel`,
        errors: [...errors, ...response.errors],
        route: "live",
        operation: spec.operation,
        transport,
        command,
        data: response.data,
        approval
      };
    }
    return {
      ...base,
      status: "observed_locally",
      summary: `${spec.operation} observed on the live channel`,
      errors,
      route: "live",
      operation: spec.operation,
      transport,
      command,
      data: response.data,
      approval
    };
  } catch (err) {
    const reason = `live channel threw for ${spec.operation}: ${errorMessage(err)}`;
    return {
      ...base,
      status: "unavailable",
      summary: reason,
      errors: [...errors, reason],
      route: "live",
      operation: spec.operation,
      transport,
      command,
      data: null,
      approval
    };
  }
}

// tools/unity/unity-run/src/abilities.ts
function runRun(options) {
  if (options.ability === "unity-change-loop")
    return runChangeLoop(options);
  if (isRuntimeAbility(options.ability))
    return runRuntimeAbility(options);
  return runChangeLoop({ ...options, ability: "unity-change-loop" });
}

// tools/unity/unity-run/src/cli.ts
import { join as join3, resolve } from "node:path";

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

// tools/unity/unity-run/src/cli.ts
function resolveOptions(argv) {
  const args = parseArgs(argv);
  const projectRoot = resolve(String(args["project-root"] || process.cwd()));
  const opencodeDir = resolve(String(args["opencode-dir"] || join3(projectRoot, ".opencode")));
  const requested = String(args.ability || "unity-change-loop");
  const ability = resolveAbility(requested, RUN_ABILITIES, "unity-change-loop");
  return {
    projectRoot,
    opencodeDir,
    ability,
    json: Boolean(args.json),
    list: Boolean(args.list),
    claim: firstString(args, ["claim"]),
    scope: firstString(args, ["scope"]),
    operation: firstString(args, ["operation"]),
    code: firstString(args, ["code"]),
    approveCodeExecution: parseBool(args["approve-code-execution"] ?? args.approveCodeExecution ?? args["approve-code"], false),
    cliCommand: firstString(args, ["unity-cli", "unityCli"]) ?? "unity"
  };
}

// tools/unity/unity-run/src/index.ts
function render(result) {
  const lines = [`[${result.ability}] ${result.status} — ${result.summary}`];
  lines.push(`  route: ${result.route} · mode: ${result.mode}`);
  if ("gates" in result) {
    for (const entry of result.gates)
      lines.push(`  gate ${entry.gate}: ${entry.status} (${entry.detail})`);
    for (const citation of result.evidence) {
      lines.push(`  evidence ${citation.name}: ${citation.present ? "present" : "absent"} — ${citation.detail}`);
    }
  }
  if ("operation" in result) {
    lines.push(`  operation: ${result.operation} · transport: ${result.transport ?? "none"}`);
    lines.push(`  command: ${result.command.join(" ")}`);
  }
  for (const error of result.errors)
    lines.push(`  error: ${error}`);
  return lines.join(`
`);
}
runCli({ abilities: RUN_ABILITIES, resolveOptions, run: runRun, render });
