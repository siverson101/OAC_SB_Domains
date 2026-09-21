---
id: ci-status-baseline
summary: Read or record a CI status baseline from the project data, folding compile-state, log-digest and the Unity verification report into green/red/unknown.
family: compose
mode: both
description: Record or read .opencode/project-data/ci-status-baseline.json. Recording folds compile-state.json, log-digest.json and unity-verification-report.json into a single green/red/unknown verdict; reading returns the last baseline. Offline and fail-soft.
inputs: { projectRoot: "string", opencodeDir: "string", verb: "read|record", source: "string?" }
outputs: { status: "string", action: "string", baselinePath: "string", baseline: "object?" }
sideEffects: ["record writes .opencode/project-data/ci-status-baseline.json"]
safetyGate: { mutates: false, requiresEditor: false, writesState: true }
uses: [gather-unity-context, compile-and-verify-project]
provides: [ci-status-baseline]
requires: [compile-state, log-digest, unity-verification-report]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# ci-status-baseline

A small, stable snapshot of the last known CI state, written to
`.opencode/project-data/ci-status-baseline.json`.

```bash
node .opencode/xdomains/scripts/unity/unity-compose.mjs \
  --project-root . --opencode-dir .opencode \
  --ability ci-status-baseline --verb record --json
```

`record` folds the on-disk evidence:

- `compile-state.json` — a missing/unavailable compile state leaves the verdict `unknown`,
- `log-digest.json` — any `errorCount > 0` makes the baseline `red`,
- `unity-verification-report.json` — any failing EditMode/PlayMode test makes it `red`.

The verdict is `green` only when compile and tests are present and no errors/failures were recorded;
otherwise it is `red` or `unknown` (never silently "clean"). `read` returns the last baseline or
`not_found`. Offline and fail-soft; `--source` labels where the baseline came from.
