---
id: scene-editing
summary: Decide and drive scene/prefab edits through the ADR-0018 escalation ladder (inspector to prefab patch to YAML).
family: act
mode: both
description: Choose the safest rung for a scene or prefab change and hand the caller the concrete steps plus the gate plan.
inputs: { projectRoot: "string", opencodeDir: "string", changeKind: "single-property|multi-property|structural|unsupported", gate: "boolean" }
outputs: { rung: "string", ladder: "array", requiresDryRun: "boolean", fallback: "string", steps: "array", gate: "object" }
sideEffects: []
safetyGate: { mutates: true, requiresApproval: true, dryRunFirst: true }
uses: [inspector, prefab-automation]
provides: [scene-editing]
requires: [unity-project]
usedBy: [prefab-automation]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# scene-editing

Scene and prefab assets are GUID-linked structures that are unsafe to hand-author. This ability picks
the correct rung of the ADR-0018 ladder instead of guessing:

1. **inspector** / `SerializedProperty` — a single serialized field.
2. **prefab patch** with JSON ops and a **mandatory `--dryRun` first pass** — multi-op or structural
   child/component changes.
3. **unity-yaml-editing** — the last-resort fallback when neither can express the edit.

The decision helper mutates nothing; it returns the rung, the required dry run, the fallback and the
ordered steps. Use `--change-kind` to describe the edit.

## Runs offline (decision)

```bash
node .opencode/xdomains/scripts/unity/unity-act.mjs \
  --project-root . --opencode-dir .opencode --ability scene-editing \
  --change-kind structural --json
```

Add `--gate` to attach the checkpoint → mutate → validate → delta gate plan. The gate is opt-in and
needs a live Editor; without the Unity CLI it reports `unavailable` (fail-soft).
