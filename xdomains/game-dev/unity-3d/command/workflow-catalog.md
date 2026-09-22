---
id: workflow-catalog
summary: Validate the 7-phase lifecycle catalog and the recipes, evaluate the catalog's artifact checks to report phase progression, and surface the next command.
family: compose
mode: offline
description: Read xdomains/context/workflow-catalog.json and every recipe under xdomains/game-dev/unity-3d/recipes/, validate both (the recipes against the recipe contract), then evaluate each catalog step's machine-checkable artifact check (glob + required pattern) to report phase progression and the next command. A step whose completion cannot be auto-detected is reported undetectable, never assumed complete. Offline, read-only and fail-soft.
inputs: { projectRoot: "string", catalog: "string?", recipesDir: "string?" }
outputs: { status: "string", safetyGate: "object", catalogPath: "string", recipesDir: "string", catalogValid: "boolean", catalogErrors: "string[]", recipes: "array", phases: "array", currentPhase: "string?", nextCommand: "string?", nextStepId: "string?" }
sideEffects: []
safetyGate: { mutates: false, requiresEditor: false }
uses: []
provides: [workflow-catalog, lifecycle-progression]
requires: [recipe-contract, capability-contract]
testPlan: ["Validate the shipped catalog and every recipe", "Confirm a malformed recipe is reported invalid without a crash", "Evaluate the artifact checks on a fixture and surface the next command"]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# workflow-catalog

Validates the lifecycle catalog and the recipes, then reports where the project
is in the 7-phase lifecycle (Concept → Systems Design → Technical Setup →
Pre-Production → Production → Polish → Release).

```bash
node .opencode/xdomains/scripts/unity/unity-compose.mjs \
  --project-root . --opencode-dir .opencode \
  --ability workflow-catalog --json
```

## Inputs

- `--catalog <file>` — the catalog to validate; defaults to
  `xdomains/context/workflow-catalog.json`.
- `--recipes-dir <dir>` — where the recipe JSON files live; defaults to
  `xdomains/game-dev/unity-3d/recipes`.

## Behaviour

- Validates the catalog (required fields, unique ids, a known `nextPhase` chain)
  and every recipe with the recipe contract validator. A malformed recipe is
  reported invalid, never a crash.
- Evaluates each step's artifact check with the same `evaluateArtifactCheck`
  seam the recipe contract uses. A phase is complete when none of its required
  steps is `unmet`; a `note`-only step is `undetectable` (not machine-checkable)
  and never blocks progression.
- Surfaces `currentPhase`, `nextStepId` and `nextCommand` for the first required
  step whose artifact check is `unmet`.

Offline, read-only and fail-soft: a missing catalog reports `unavailable`; a
missing recipes directory reports no recipes.
