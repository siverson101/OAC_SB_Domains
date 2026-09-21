---
id: test-plan
summary: Generate a per-feature test plan (.opencode/test-plans/<slug>.md) from the testPlan fields of the named capabilities, assembling a deduplicated checklist; the capability contract is the single source of truth.
family: compose
mode: offline
description: For each capability or primitive named by --abilities, read command/<ability>.md frontmatter or the primitive's primitive.yaml testPlan/id/summary and render a section, then assemble a deduplicated checklist. A missing capability or one with no testPlan is reported as a problem, never a crash. Offline and fail-soft: writes only under .opencode/test-plans/.
inputs: { projectRoot: "string", opencodeDir: "string", feature: "string", abilities: "string?", commandsDir: "string?", primitivesDir: "string?" }
outputs: { status: "string", safetyGate: "object", action: "string", feature: "string?", planPath: "string", written: "boolean", sections: "number", checklist: "number", problems: "string[]" }
sideEffects: ["writes .opencode/test-plans/<slug>.md"]
safetyGate: { mutates: false, requiresEditor: false, writesState: true }
uses: []
provides: [test-plan, test-plan-artifact]
requires: [capability-contract, plan-feature]
testPlan: ["Run test-plan for a feature and confirm every named capability has a section", "Confirm a missing capability is reported as a problem without a crash", "Confirm a step shared by two capabilities is listed once"]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# test-plan

Generates a **per-feature test plan** from capability contract data. The
`testPlan` field in each capability's command frontmatter is the single source of
truth — there is no hand-maintained parallel list.

```bash
node .opencode/xdomains/scripts/unity/unity-compose.mjs \
  --project-root . --opencode-dir .opencode \
  --ability test-plan --feature player-jump \
  --abilities compile-and-verify-project,run-edit-mode-tests --json
```

## Inputs

- `--feature <slug>` — the feature the plan is for; the artifact lands at
  `.opencode/test-plans/<slug>.md`. The slug must be kebab-case so it can never
  escape the output directory.
- `--abilities a,b,c` — the capabilities or primitives to include (explicit,
  comma-separated). There is no hand-maintained feature→abilities mapping.
- `--commands-dir <dir>` — where the capability contracts live; defaults to the
  shipped `xdomains/game-dev/unity-3d/command` directory.
- `--primitives-dir <dir>` — where the primitive contracts live; defaults to the
  shipped `xdomains/game-dev/unity-3d/primitives` directory. A primitive's plan
  is read from `primitive.yaml` (`testPlan`/`test_plan`).

## Behaviour

- For each named capability or primitive, read `id`, `summary` and `testPlan`
  from its contract and render a section with the steps as a checklist.
- Assemble a **deduplicated** checklist: a step already emitted by an earlier
  capability is not repeated (the artifact records the dropped duplicates).
- A missing capability file, or a capability with no `testPlan`, is recorded as a
  problem and the run continues — fail-soft, never a crash.

Offline: it reads contract frontmatter and writes only under
`.opencode/test-plans/`, never touching project assets.
