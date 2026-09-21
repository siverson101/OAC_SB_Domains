---
id: gate-review
summary: Fold the named verification gates (compile, EditMode/PlayMode, scene/asset, build, performance, visual) strictest-wins under a review-intensity knob.
family: verify
mode: offline
description: Read gate-state.json, unity-verification-report.json, compile-state.json and test-inventory.json and fold the applicable named gates strictest-wins; no Editor required.
inputs: { projectRoot: "string", opencodeDir: "string", reviewIntensity: "full|lean|solo", gates: "array", externalVerdict: "confirmed|uncertain" }
outputs: { status: "string", gates: "object" }
sideEffects: []
safetyGate: { mutates: false, requiresEditor: false }
uses: [compile-and-verify-project, run-edit-mode-tests, run-play-mode-tests]
provides: [gate-review]
requires: [gate-state, unity-verification-report]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# gate-review

Folds the named gates into one verdict with **strictest-wins** (ADR-0015). The review-intensity knob
selects which gates apply: `full` (all), `lean` (drops performance/visual), `solo` (compile +
EditMode + PlayMode only).

```bash
node .opencode/xdomains/scripts/unity/unity-verify.mjs \
  --project-root . --opencode-dir .opencode \
  --ability gate-review --review-intensity lean --json
```

- Named gates: `compile`, `editMode`, `playMode`, `scene`, `asset`, `build`, `performance`, `visual`.
- `compile` is derived from `compile-state.json`; `editMode`/`playMode` from
  `unity-verification-report.json`; `visual` from `test-inventory.json`. Gates that cannot be derived
  from on-disk state stay `not_run`.
- `--gates '[{"gate":"build","status":"failed"}]'` overrides a gate (valid statuses: `passed`,
  `failed`, `warning`, `not_run`, `unavailable`, `unknown`).
- A gate entry may carry an external verdict: `--gates '[{"gate":"scene","status":"not_run","externalVerdict":"confirmed"}]'`.
  `uncertain` folds at least as strict as `warning`; `confirmed` contributes a `passed` verdict and so
  cannot override a harder on-disk status. Strictest-wins is otherwise unchanged.
- The folded `status` is the strictest applicable gate; `hardFailures` counts failed gates and
  `reviewRequired` counts warnings. Offline and fail-soft: missing artefacts yield `not_run`.
