---
id: unity-runtime-target
summary: Target and drive a running Unity Player through the Unity CLI live channel — read logs/errors, snapshot and interact with the UI — gated by bridge availability and fail-soft.
family: run
mode: live
description: The runtime-target loop. Routes to the Unity 3D Orchestrator to read runtime logs/errors, snapshot the UI, and dispatch clicks/keys against a live Editor/Player. Requires the Unity CLI live channel; with no bridge the loop reports unavailable (fail-soft) and never throws. Arbitrary runtime code execution stays behind an explicit approval gate.
inputs: { projectRoot: "string", opencodeDir: "string", target: "string?", operation: "get_logs|ui_snapshot|ui_find|ui_click|ui_key", code: "string?" }
outputs: { status: "string", transport: "string", observations: "array", approval: "object" }
sideEffects: ["ui_click/ui_key may mutate Player state", "approval-gated runtime code execution may mutate Player state"]
safetyGate: { mutates: false, requiresEditor: true, requiresApproval: true }
uses: [runtime-debugging, runtime-ui-validation, gather-unity-context]
provides: [unity-runtime-target, runtime-observation]
requires: [unity-cli]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# unity-runtime-target

Target and drive the running Player. Routes to the Unity 3D Orchestrator to run the runtime-target
loop (ADR-0018).

## Usage

```
/unity-runtime-target {target or observation goal}
```

Example: `/unity-runtime-target confirm the health HUD updates when the player takes damage`

## Context

1. `.opencode/context/unity-3d/navigation.md` (always)
2. `errors/common-unity-issues.md`
3. `lookup/validation-rules.md`

## Workflow

1. Resolve the target Player/Editor and confirm the Unity CLI live channel is reachable.
2. `runtime-debugging` — read logs/errors (`get_logs --logType Error`).
3. `runtime-ui-validation` — snapshot, find and interact (`ui_snapshot`, `ui_find`, `ui_click`,
   `ui_key`) to observe behaviour.
4. Report the observations with their transport. Never claim a live result the channel did not return.

## Gating

This loop is **gated by runtime/bridge availability**. With no live channel it reports `unavailable`
and never throws (fail-soft). Runtime code execution (`execute-code`) is refused before any channel is
touched unless the explicit approval gate is satisfied.
