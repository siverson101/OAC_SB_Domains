---
id: version-drift
summary: Detect Unity CLI, Editor and package version drift against stored baselines, applying only safe baseline updates and surfacing the rest as ACTION REQUIRED.
family: sense
mode: both
description: Offline Editor/package drift detection plus a best-effort Unity CLI probe. Reads ProjectSettings/ProjectVersion.txt and Packages/manifest.json, compares them to version-baselines/, and surfaces breaking-change and changelog reviews. Never silently upgrades.
inputs: { projectRoot: "string", opencodeDir: "string", ifDue: "boolean?", maxAgeHours: "number?", now: "string?", cliCommand: "string?" }
outputs: { safetyGate: "object", cadence: "object", editor: "object", packages: "object", cli: "object", actions: "array", baselinesUpdated: "array", report: "string" }
sideEffects: ["writes version-baselines/*.json", "writes version-baselines/*.txt"]
safetyGate: { mutates: false, requiresEditor: false, requiresApproval: false, writesState: true }
provides: [version-drift]
requires: [project-data]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# version-drift

The Session-Start Version Check. Run it **first thing each day** (once, before any other Unity
work) so drift is caught while the context is still cheap to fix. It is offline, read-only against
project assets, and fail-soft: an absent Editor file, package manifest or Unity CLI is reported, never
thrown.

```bash
node .opencode/xdomains/scripts/unity/version-drift.mjs \
  --project-root . --opencode-dir .opencode --if-due --max-age-hours 24 --json
```

- `--if-due` with `--max-age-hours 24` (default) skips when `version-baselines/last-run.json` is
  fresh; without `--if-due` it always runs. The run records the timestamp.
- It writes **only** the baseline files under `project-data/version-baselines/`
  (`unity-editor-version.txt`, `unity-cli-version.txt`, `package-versions.json`,
  `unity-cli-commands.json`, `last-run.json`).

## Detection

- **Editor** — `ProjectSettings/ProjectVersion.txt` via the offline reader, vs
  `unity-editor-version.txt`.
- **Packages** — `Packages/manifest.json` `dependencies`, vs `package-versions.json`
  (added/removed/bumped).
- **CLI** — best-effort: only when `unity` resolves, `unity --version` vs `unity-cli-version.txt`;
  on change, `unity command --format json` is captured and diffed against `unity-cli-commands.json`.
  An absent CLI reports `unavailable`. Never invokes bare `unity mcp`.

## ACTION REQUIRED

The script prints a structured report (`=== Session-Start Version Check ===`) and returns
`actions[]`. **Do not auto-apply anything it flags.** For each `ACTION REQUIRED` line, either fix it
now or record it for the user:

- **Editor version changed** — review the Unity upgrade guide for breaking changes (deprecations,
  API removals, behaviour changes) and the project's deprecation checks; confirm any
  `ProjectSettings/ProjectVersion.txt` retarget.
- **`com.unity.pipeline` changed** — review its changelog (detached jobs, eval timeout, `/api/exec`
  concurrency) before updating code that uses the Pipeline API.
- **CLI version changed** — review the command additions/removals and update the context files/docs
  that enumerate Unity CLI commands (the report lists the files it found); never edit them silently.

Report the `report` text verbatim to the user, then act on their confirmation.

## Deliberate deviations from the TODO prompt

The offline hook **detects and records** drift; it does **not** perform the network- or
judgement-bound work that `docs/TODO.md` describes. Two steps are therefore **surfaced for the agent**
as ACTION REQUIRED rather than executed here, per the fail-soft rule (a stage-3 hook must be offline,
read-only, and never fail a build):

- **Pipeline changelog fetch** — the `com.unity.pipeline` changelog is not fetched; the action line
  names it for the agent to review.
- **Editor upgrade-guide / deprecated-API file scan** — the upgrade guide is not fetched and project
  scripts are not scanned for deprecated APIs; the action line points the agent at that review.

This partial-vs-TODO behaviour is intentional: the hook stays offline and deterministic, and the
judgement-bearing work is delegated to the agent on the user's confirmation.

