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

// tools/unity/unity-skills/src/cli.ts
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
import { dirname, sep } from "node:path";
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

// tools/shared/optional-unity-skills.ts
import { join } from "node:path";
var UNITY_SKILLS_REPO = "https://github.com/Unity-Technologies/skills";
var VENDOR_REL = "xdomains/vendor/unity-skills";
var VENDOR_GITIGNORE_ENTRY = ".opencode/xdomains/vendor/";
var INSTALL_MARKER = ".oac-unity-skills.json";
function vendorPath(opencodeDir) {
  return join(opencodeDir, VENDOR_REL);
}
function installMarkerPath(vendorDir) {
  return join(vendorDir, INSTALL_MARKER);
}

// tools/unity/unity-skills/src/types.ts
var UNITY_SKILLS_ABILITY = "unity-skills";
var UNITY_SKILLS_ABILITIES = [UNITY_SKILLS_ABILITY];

// tools/unity/unity-skills/src/cli.ts
function configUiStack(opencodeDir) {
  const text = readText(join2(opencodeDir, "unity-studio.json"));
  if (!text)
    return;
  try {
    const stack = asRecord(JSON.parse(text))?.uiStack;
    return typeof stack === "string" && stack ? stack : undefined;
  } catch {
    return;
  }
}
function resolveOptions(argv) {
  const { values: args, positional } = parseArgs(argv);
  rejectPositionals(positional);
  const projectRoot = resolve(String(args["project-root"] || process.cwd()));
  const opencodeDir = resolve(String(args["opencode-dir"] || join2(projectRoot, ".opencode")));
  const ability = resolveAbility(String(args.ability || "unity-skills"), UNITY_SKILLS_ABILITIES, "unity-skills");
  const off = parseBool(args.off, false);
  const status = parseBool(args.status, false);
  const install = parseBool(args.install, false) || parseBool(args.yes, false);
  const uiStack = firstString(args, ["ui-stack", "uiStack"]) ?? configUiStack(opencodeDir) ?? "";
  return {
    projectRoot,
    opencodeDir,
    ability,
    json: parseBool(args.json, false),
    list: parseBool(args.list, false),
    install,
    off,
    status,
    consent: parseBool(args.yes, false),
    uiStack,
    ref: firstString(args, ["ref"]),
    now: firstString(args, ["now"]) ?? nowIso(),
    source: firstString(args, ["source"])
  };
}

// tools/unity/unity-skills/src/installer.ts
import { cpSync, existsSync as existsSync2, mkdirSync as mkdirSync2, readFileSync as readFileSync2, rmSync, writeFileSync as writeFileSync2 } from "node:fs";
import { dirname as dirname2, join as join3 } from "node:path";
import { spawnSync } from "node:child_process";
function verifySkillsDir(vendorDir) {
  const skillsDir = join3(vendorDir, "skills");
  if (!existsSync2(skillsDir))
    return { ok: false, reason: "the downloaded repository has no skills/ directory" };
  return { ok: true, reason: "skills/ present" };
}
function verifyLicense(vendorDir) {
  const licensePath = join3(vendorDir, "LICENSE.md");
  if (!existsSync2(licensePath))
    return { ok: false, reason: "LICENSE.md is missing from the downloaded repository" };
  const text = readText(licensePath) ?? "";
  if (!/Unity Companion License/i.test(text)) {
    return { ok: false, reason: "LICENSE.md does not name the Unity Companion License" };
  }
  if (!/Unity Technologies/i.test(text)) {
    return { ok: false, reason: "LICENSE.md has no Unity Technologies copyright line" };
  }
  return { ok: true, reason: "Unity Companion License verified" };
}
function gitDownload(dest, ref) {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync2(dirname2(dest), { recursive: true });
  const args = ["clone", "--depth", "1"];
  if (ref)
    args.push("--branch", ref);
  args.push(UNITY_SKILLS_REPO, dest);
  const clone = spawnSync("git", args, { encoding: "utf8" });
  if (clone.status !== 0) {
    return { ok: false, error: (clone.stderr || "").trim() || `git clone exited ${clone.status}` };
  }
  const head = spawnSync("git", ["-C", dest, "rev-parse", "HEAD"], { encoding: "utf8" });
  const commit = head.status === 0 ? (head.stdout || "").trim() : undefined;
  rmSync(join3(dest, ".git"), { recursive: true, force: true });
  return { ok: true, commit };
}
function readConfig(opencodeDir) {
  const text = readText(join3(opencodeDir, "unity-studio.json"));
  if (!text)
    return {};
  try {
    return asRecord(JSON.parse(text)) ?? {};
  } catch {
    return {};
  }
}
function writeConfig(opencodeDir, config) {
  mkdirSync2(opencodeDir, { recursive: true });
  writeJson(join3(opencodeDir, "unity-studio.json"), config);
}
function setToggle(opencodeDir, enabled, uiStack) {
  const config = readConfig(opencodeDir);
  if (typeof config.schemaVersion !== "number")
    config.schemaVersion = 1;
  const toggles = asRecord(config.toggles) ?? {};
  toggles.unitySkills = enabled;
  config.toggles = toggles;
  config.uiStack = uiStack;
  writeConfig(opencodeDir, config);
}
function localDownload(sourceDir) {
  return (dest) => {
    rmSync(dest, { recursive: true, force: true });
    mkdirSync2(dirname2(dest), { recursive: true });
    cpSync(sourceDir, dest, { recursive: true });
    return { ok: true };
  };
}
function ensureGitignore(projectRoot, entry = VENDOR_GITIGNORE_ENTRY) {
  const file = join3(projectRoot, ".gitignore");
  const text = existsSync2(file) ? readFileSync2(file, "utf8") : "";
  const lines = text.split(/\r?\n/);
  if (lines.some((line) => line.trim() === entry))
    return false;
  const next = text && !text.endsWith(`
`) ? `${text}
${entry}
` : `${text}${entry}
`;
  writeFileSync2(file, next);
  return true;
}
function writeVendorGitignore(vendorDir) {
  mkdirSync2(vendorDir, { recursive: true });
  writeFileSync2(join3(vendorDir, ".gitignore"), `*
`);
}
function baseResult(options, status, summary) {
  return {
    schemaVersion: 1,
    generatedAt: options.now,
    ability: options.ability,
    family: "compose",
    mode: "both",
    status,
    summary,
    errors: [],
    vendorPath: vendorPath(options.opencodeDir),
    installed: existsSync2(vendorPath(options.opencodeDir)),
    licenseVerified: false,
    commit: null,
    uiStack: options.uiStack,
    enabled: readConfig(options.opencodeDir).toggles ? asRecord(readConfig(options.opencodeDir).toggles)?.unitySkills === true : false,
    gitignoreUpdated: false,
    action: null
  };
}
async function runUnitySkills(options) {
  const vendor = vendorPath(options.opencodeDir);
  if (options.off) {
    setToggle(options.opencodeDir, false, options.uiStack);
    const result = baseResult(options, "disabled", "Unity skills disabled; re-apply to restore the base agents.");
    result.enabled = false;
    result.action = "Run the domain apply step (or /unity-studio-mode) to swap back to the base agents.";
    return result;
  }
  if (options.status || !options.install && !options.off) {
    if (!existsSync2(vendor))
      return baseResult(options, "absent", "Unity skills are not installed.");
    const license = verifyLicense(vendor);
    const result = baseResult(options, "installed", `Unity skills installed${license.ok ? "" : ` (license: ${license.reason})`}.`);
    result.licenseVerified = license.ok;
    return result;
  }
  const consent = options.consent || (options.confirm ? await options.confirm() : false);
  if (!consent) {
    return baseResult(options, "refused", "Install declined; no changes made.");
  }
  const download = options.download ?? gitDownload;
  const downloaded = download(vendor, options.ref);
  if (!downloaded.ok) {
    rmSync(vendor, { recursive: true, force: true });
    const result = baseResult(options, "refused", `Download failed: ${downloaded.error ?? "unknown error"}`);
    result.errors.push(downloaded.error ?? "download failed");
    return result;
  }
  const license = verifyLicense(vendor);
  const skillsDir = license.ok ? verifySkillsDir(vendor) : { ok: false, reason: "" };
  const failure = !license.ok ? license.reason : !skillsDir.ok ? skillsDir.reason : null;
  if (failure) {
    rmSync(vendor, { recursive: true, force: true });
    const result = baseResult(options, "refused", `Install verification failed: ${failure}. Partial download removed.`);
    result.errors.push(failure);
    return result;
  }
  writeVendorGitignore(vendor);
  writeJson(installMarkerPath(vendor), {
    schemaVersion: 1,
    repo: UNITY_SKILLS_REPO,
    commit: downloaded.commit ?? null,
    installedAt: options.now
  });
  const gitignoreUpdated = ensureGitignore(options.projectRoot);
  setToggle(options.opencodeDir, true, options.uiStack);
  const result = baseResult(options, "installed", `Unity skills installed at ${vendor} (${license.reason}).`);
  result.licenseVerified = true;
  result.installed = true;
  result.enabled = true;
  result.commit = downloaded.commit ?? null;
  result.gitignoreUpdated = gitignoreUpdated;
  result.action = "Run the domain apply step (or /unity-studio-mode) so the apply engine resolves the sk agent variants.";
  return result;
}

// tools/unity/unity-skills/src/index.ts
var UI_STACKS = ["uitk", "ugui", "mixed"];
async function promptLine(question) {
  const readline = await import("node:readline/promises");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}
async function promptYesNo(question) {
  return /^y(es)?$/i.test(await promptLine(question));
}
function render(result) {
  const lines = [`[unity-skills] ${result.status} — ${result.summary}`];
  lines.push(`  vendor: ${result.vendorPath}`);
  if (result.commit)
    lines.push(`  commit: ${result.commit}`);
  lines.push(`  license verified: ${result.licenseVerified ? "yes" : "no"}`);
  lines.push(`  enabled: ${result.enabled ? "yes" : "no"}`);
  if (result.gitignoreUpdated)
    lines.push("  updated .gitignore");
  for (const error of result.errors)
    lines.push(`  error: ${error}`);
  if (result.action)
    lines.push(`  ACTION: ${result.action}`);
  return lines.join(`
`);
}
runCli({
  abilities: UNITY_SKILLS_ABILITIES,
  resolveOptions,
  run: async (options) => {
    if (options.source)
      options.download = localDownload(options.source);
    const interactive = Boolean(process.stdin.isTTY);
    if (options.install && !options.consent && interactive) {
      options.confirm = () => promptYesNo("Install Unity Technologies' unity-skills? It is downloaded into a gitignored vendor path and not redistributed by this repo [y/N]: ");
    }
    if (!options.uiStack) {
      const answer = interactive ? await promptLine(`UI stack (${UI_STACKS.join("|")}) [uitk]: `) : "";
      options.uiStack = UI_STACKS.includes(answer) ? answer : "uitk";
    }
    return runUnitySkills(options);
  },
  render
});
