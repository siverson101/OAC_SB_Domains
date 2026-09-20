---
id: unity-change-loop
summary: Drive resolve → inspect → smallest change → compile → logs → tests → observe as a data-driven loop with named gates, citing evidence and refusing "done" without green tests.
family: run
mode: both
description: Fold the offline evidence produced by the Sense/Verify families (compile-state, log-digest, test results, screenshot) into a gated change loop. The loop refuses "done" unless compile, logs and tests are all green.
inputs: { projectRoot: "string", opencodeDir: "string", claim: "string?" }
outputs: { status: "string", stages: "array", gates: "array", evidence: "array", done: "boolean", refusals: "array" }
sideEffects: []
safetyGate: { mutates: false, requiresEditor: false, requiresApproval: false }
uses: [gather-unity-context, compile-and-verify-project, run-edit-mode-tests, run-play-mode-tests]
provides: [unity-change-loop]
requires: [compile-state, log-digest, test-inventory]
usedBy: [gate-review]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# unity-change-loop

The loop is data, not prose. Seven stages run in order — **resolve → inspect → smallest change →
compile → logs → tests → observe** — and each feeds a named gate (`compile`, `logs`, `tests`,
`observe`). The ability folds the on-disk evidence the earlier families wrote:

- `project-data/compile-state.json` (fresh assemblies, no silent no-op recompile),
- `project-data/log-digest.json` (error count),
- `project-data/unity-verification-report.json` (EditMode/PlayMode counts),
- `project-data/run/screenshot.json` (observe evidence, when captured).

```bash
node .opencode/xdomains/scripts/unity/unity-run.mjs \
  --project-root . --opencode-dir .opencode \
  --ability unity-change-loop --claim done --json
```

Every result **cites evidence** (present/absent, source, detail). `done` is `true` only when the
required gates — compile, logs and tests — are all green. Claiming `--claim done` without green tests
sets `status: refused` and lists the unmet gates; the loop never declares done on a hunch.

Read-only; fail-soft with no Editor.
