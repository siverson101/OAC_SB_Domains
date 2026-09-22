---
id: unity-prefab-sweep
summary: Sweep a prefab or scene through the ADR-0018 escalation ladder — inspector read, prefab patch with a mandatory dry run, then YAML only as the last resort.
family: act
mode: both
description: The prefab/scene sweep loop. Routes to the Unity 3D Orchestrator to inspect the target, propose prefab patch JSON ops with a mandatory dry run, and apply only on confirmation; a non-dry run without a prior dry run or confirmation is refused. The live apply needs the Unity CLI bridge; with none it reports unavailable (fail-soft). Escalates to unity-yaml-editing only when the API cannot express the edit.
inputs: { projectRoot: "string", opencodeDir: "string", target: "string", changeKind: "single-property|multi-property|structural|unsupported", opsFile: "string?", dryRun: "boolean", confirm: "boolean" }
outputs: { status: "string", rung: "string", patchId: "string?", command: "string?", escalation: "object" }
sideEffects: ["writes .opencode/project-data/act/prefab-dryrun.json receipt", "live apply mutates the prefab/scene asset through the Unity CLI"]
safetyGate: { mutates: true, requiresEditor: true, requiresApproval: true, dryRunFirst: true, writesState: true }
uses: [prefab-automation, scene-editing]
provides: [unity-prefab-sweep, prefab-sweep-receipt]
requires: [unity-project]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# unity-prefab-sweep

Sweep a prefab or scene safely. Routes to the Unity 3D Orchestrator to run the **prefab/scene
escalation** recipe (ADR-0018).

## Usage

```
/unity-prefab-sweep {target prefab or scene}
```

## Context

1. `.opencode/context/unity-3d/navigation.md` (always)
2. `workflows/scene-assembly.md` + `guides/scene-prefab-safety.md`
3. `concepts/project-layout.md`

## Workflow

1. `scene-editing` — inspect the target and choose the safest rung
   (`single-property | multi-property | structural | unsupported`).
2. `prefab-automation` — propose JSON ops (`ensure_child`, `ensure_component`, `set_property`, …) and
   run a **mandatory dry run**; the dry run mutates nothing and records a receipt.
3. Apply only with `--confirm` and a prior dry run for the same ops; otherwise refuse.
4. Escalate to `unity-yaml-editing` only when the API cannot express the edit, and justify it.
5. Route scene/prefab edits to `UnityScene`; never do a wholesale rewrite.

## Gating

The live apply needs the runtime/bridge. With no bridge it reports `unavailable` (fail-soft) rather
than throwing; the dry run remains available offline.
