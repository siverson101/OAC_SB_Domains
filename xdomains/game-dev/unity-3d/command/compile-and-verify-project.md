---
id: compile-and-verify-project
summary: Capture a compile checkpoint from Library/ScriptAssemblies, then validate a mutation and report a bounded new/resolved issue delta.
family: verify
mode: both
description: Checkpoint the offline compile state (Phase 2a compile-state producer) before a mutation, re-scan after it, and diff the issue set with the honesty rules (null = no delta computed, not clean).
inputs: { projectRoot: "string", opencodeDir: "string", phase: "checkpoint|validate" }
outputs: { status: "string", checkpoint: "object", delta: "object", compile: "object" }
sideEffects: ["writes .opencode/project-data/verify/checkpoint.json on the checkpoint phase"]
safetyGate: { mutates: false, requiresEditor: false, writesState: true }
uses: [gather-unity-context]
provides: [compile-and-verify-project]
requires: [compile-state]
usedBy: [gate-review]
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
  --ability compile-and-verify-project --json
```

- **Checkpoint** (`--phase checkpoint`) records the current compile state, the Editor-log issues and
  the gate result to `.opencode/project-data/verify/checkpoint.json`. No delta is computed.
- **Validate** (default) re-scans and diffs against the stored checkpoint: `newIssues` are issues
  present after the mutation but not before; `resolvedIssues` are the reverse.
- `delta.newIssues`/`delta.resolvedIssues` are `null` — never `[]` — when no delta was computed
  (no checkpoint, unavailable compile state, or a pending/no-op recompile). `compilePending` and
  `validateScanFailed` are reported explicitly.

Read-only apart from the checkpoint file; fail-soft with no Editor.
