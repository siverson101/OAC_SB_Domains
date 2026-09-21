---
id: compile-and-verify-project
summary: Capture a compile checkpoint from Library/ScriptAssemblies, then validate a mutation and report a bounded new/resolved issue delta.
family: verify
mode: both
description: Checkpoint the offline compile state (Phase 2a compile-state producer) before a mutation, re-scan after it, and diff the issue set with the honesty rules (null = no delta computed, not clean). The validate phase requires a declared change scope.
inputs: { projectRoot: "string", opencodeDir: "string", phase: "checkpoint|validate", changeScope: "string" }
outputs: { status: "string", safetyGate: "object", changeScope: "string[]?", checkpoint: "object", delta: "object", phase: "checkpoint|validate", checkpointPath: "string?" }
sideEffects: ["writes .opencode/project-data/verify/checkpoint.json on the checkpoint phase"]
safetyGate: { mutates: false, requiresEditor: false, writesState: true }
uses: [gather-unity-context]
provides: [compile-and-verify-project]
requires: [compile-state]
usedBy: [gate-review]
testPlan: ["Checkpoint the compile state before a mutation", "Introduce a compile error and confirm newIssues reports it", "Confirm a no-op reports a null delta rather than clean"]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# compile-and-verify-project

Implements the ADR-0015 checkpoint → mutate → validate → delta model for compile state. It anchors
on the Phase 2a `compile-state` producer (`Library/ScriptAssemblies/*.dll` mtimes + `Editor.log`).

```bash
node .opencode/xdomains/scripts/unity/unity-verify.mjs \
  --project-root . --opencode-dir .opencode \
  --ability compile-and-verify-project --phase checkpoint --json

node .opencode/xdomains/scripts/unity/unity-verify.mjs \
  --project-root . --opencode-dir .opencode \
  --ability compile-and-verify-project --change-scope Assets/Player.cs,PlayerController --json
```

- **Checkpoint** (`--phase checkpoint`) records the current compile state, the Editor-log issues and
  the gate result to `.opencode/project-data/verify/checkpoint.json`. No delta is computed.
- **Validate** (default) requires a declared change scope (`--change-scope`, comma-separated
  files/symbols). Without one it returns `refused` and a `null` delta — never `verified`. The declared
  scope is recorded on the result and bounds the delta: only issues matching a scope token count as
  new/resolved, so a mutation cannot claim a verdict outside its declared scope.
- **Validate** re-scans and diffs against the stored checkpoint: `newIssues` are issues present after
  the mutation but not before; `resolvedIssues` are the reverse.
- `delta.newIssues`/`delta.resolvedIssues` are `null` — never `[]` — when no delta was computed
  (no checkpoint, unavailable compile state, or a pending/no-op recompile). `compilePending` and
  `validateScanFailed` are reported explicitly.

Read-only apart from the checkpoint file; fail-soft with no Editor.
