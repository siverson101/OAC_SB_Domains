---
id: run-play-mode-tests
summary: Run the Unity PlayMode test gate live through the Unity CLI when an Editor is available, with a batch fallback, and report counts plus a bounded delta.
family: verify
mode: both
description: Wrap the existing runGate/parseNUnit path for PlayMode tests; prefer a live Editor, fall back to a batch run, and fail soft when no Unity CLI is present.
inputs: { projectRoot: "string", opencodeDir: "string", unityCli: "string" }
outputs: { status: "string", testRun: "object", checkpoint: "object", delta: "object" }
sideEffects: []
safetyGate: { mutates: false, requiresEditor: true }
uses: [gather-unity-context]
provides: [run-play-mode-tests]
requires: [unity-cli, test-inventory]
usedBy: [gate-review]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# run-play-mode-tests

Runs PlayMode tests and reports the gate verdict. A live Editor is used when the Unity CLI can find
one; otherwise the run falls back to `unity test <project> --mode PlayMode`. With no Unity CLI the
ability reports `unavailable` and never throws.

```bash
node .opencode/xdomains/scripts/unity/unity-verify.mjs \
  --project-root . --opencode-dir .opencode \
  --ability run-play-mode-tests --json
```

The result carries the `TestRun` counts (`total`/`passed`/`failed`/`skipped`), the route that served
it (`live` or `batch`), and a bounded delta against the last captured checkpoint. A failed run sets
`status: failed`; a passing run with new issues sets `status: regressed`.
