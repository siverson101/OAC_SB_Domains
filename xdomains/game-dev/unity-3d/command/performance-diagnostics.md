---
id: performance-diagnostics
summary: Capture profiler counters and snapshots from the running Player through the Unity CLI live channel to diagnose performance.
family: run
mode: live
description: Read profiler counters and take profiler snapshots (profiler_counters, profiler_snapshot) from a live Editor/Player. Fail-soft to unavailable without a live channel.
inputs: { projectRoot: "string", opencodeDir: "string", operation: "profiler_counters|profiler_snapshot" }
outputs: { status: "string", operation: "string", transport: "string", data: "object" }
sideEffects: []
safetyGate: { requiresEditor: true, requiresApproval: false }
uses: [gather-unity-context]
provides: [performance-diagnostics]
requires: [unity-cli]
usedBy: [unity-change-loop]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# performance-diagnostics

Reads profiler counters and captures profiler snapshots from the running Player over the Unity CLI
live channel (`profiler_counters`, `profiler_snapshot`). It feeds the performance gate of the change
loop and the ADR-0015 named gates.

```bash
node .opencode/xdomains/scripts/unity/unity-run.mjs \
  --project-root . --opencode-dir .opencode \
  --ability performance-diagnostics --operation profiler_counters --json
```

Read-only; fail-soft with no live channel/Editor (`unavailable`, never throws).
