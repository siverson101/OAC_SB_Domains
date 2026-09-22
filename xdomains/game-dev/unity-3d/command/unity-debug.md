---
id: unity-debug
summary: Diagnose and fix a Unity runtime or compile failure through the gated change loop, reading runtime logs and errors from the live Player when a bridge is available.
family: run
mode: both
description: Routes to the Unity 3D Orchestrator to reproduce, inspect and fix a failure, then prove it through the change loop. Runtime log/error reads use the Unity CLI live channel; with no live Editor/Player the read reports unavailable (fail-soft) and the offline evidence (compile-state, log-digest, test results) is used instead.
inputs: { projectRoot: "string", opencodeDir: "string", symptom: "string", repro: "string?", claim: "string?" }
outputs: { status: "string", diagnosis: "string", evidence: "array", fixed: "boolean", done: "boolean" }
sideEffects: ["edits project assets when a fix is approved"]
safetyGate: { mutates: true, requiresEditor: true, requiresApproval: true }
uses: [runtime-debugging, unity-change-loop, compile-and-verify-project, run-edit-mode-tests, gather-unity-context]
provides: [unity-debug, diagnosis]
requires: [unity-project, log-digest, compile-state]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# unity-debug

Diagnose and fix a Unity failure. Routes to the Unity 3D Orchestrator to run the **Production**
change loop against a defect (ADR-0018).

## Usage

```
/unity-debug {symptom}
```

Example: `/unity-debug player falls through the floor on the second jump`

## Context

1. `.opencode/context/unity-3d/navigation.md` (always)
2. `errors/common-unity-issues.md`
3. `lookup/validation-rules.md`

## Workflow

1. Reproduce and restate the failure; separate new errors from the pre-existing log baseline.
2. `runtime-debugging` — read runtime logs/errors from the live Player when a bridge is available;
   otherwise fall back to the offline `log-digest`. Arbitrary runtime code execution stays behind the
   explicit approval gate.
3. `unity-change-loop` — apply the smallest change, then compile → logs → tests → observe, citing
   evidence; never claim fixed without green tests.
4. Report the diagnosis, the evidence and the fix.

## Success Criteria

- [ ] Failure reproduced and restated
- [ ] Diagnosis cites evidence (logs, compile-state, tests)
- [ ] Change loop reports `done` with green gates
- [ ] Live reads fail soft to `unavailable` when no bridge is present
