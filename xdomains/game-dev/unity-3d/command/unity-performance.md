---
id: unity-performance
summary: Profile a running Unity Player through the Unity CLI live channel — capture profiler counters and snapshots and diagnose bottlenecks against the performance budget.
family: run
mode: live
description: The performance loop. Routes to the Unity 3D Orchestrator to read profiler counters and capture profiler snapshots from a live Editor/Player and diagnose CPU/GPU/memory bottlenecks against the budget. Requires the Unity CLI live channel; with no bridge it reports unavailable (fail-soft) and never throws.
inputs: { projectRoot: "string", opencodeDir: "string", operation: "profiler_counters|profiler_snapshot", budget: "string?" }
outputs: { status: "string", transport: "string", counters: "object", bottlenecks: "array" }
sideEffects: []
safetyGate: { mutates: false, requiresEditor: true, requiresApproval: false }
uses: [performance-diagnostics, gather-unity-context]
provides: [unity-performance, performance-report]
requires: [unity-cli]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# unity-performance

Profile the running Player. Routes to the Unity 3D Orchestrator to run the performance loop.

## Usage

```
/unity-performance {target or budget}
```

Example: `/unity-performance hold 60 fps with the wave of 200 enemies on screen`

## Context

1. `.opencode/context/unity-3d/navigation.md` (always)
2. `lookup/performance-budgets.md`
3. `workflows/quality-gate.md`

## Workflow

1. Resolve the target Player/Editor and confirm the Unity CLI live channel is reachable.
2. `performance-diagnostics` — read profiler counters (`profiler_counters`) and capture snapshots
   (`profiler_snapshot`).
3. Diagnose bottlenecks against `lookup/performance-budgets.md` and report them with evidence.
4. Feed the performance gate of the change loop when a fix follows.

## Gating

This loop is **gated by runtime/bridge availability**. With no live channel it reports `unavailable`
and never throws (fail-soft). Read-only: it never mutates Player or project state.
