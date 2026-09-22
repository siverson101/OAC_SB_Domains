---
id: unity-polish
summary: Harden a Unity 3D feature before release — run the full test suite, remove redundant tests, profile against the performance budget, and fold the verification gate.
family: compose
mode: both
description: The Polish entry point. Routes to the Unity 3D Orchestrator to run the EditMode/PlayMode suite, deduplicate redundant tests, profile CPU/GPU/memory when a live bridge is available (fail-soft otherwise), and fold the named verification gates strictest-wins. Offline-first; only the profiler stage needs a live channel.
inputs: { projectRoot: "string", opencodeDir: "string", feature: "string", apply: "boolean?", reviewIntensity: "full|lean|solo" }
outputs: { status: "string", testsGreen: "boolean", removals: "array", gate: "object" }
sideEffects: ["edits *.cs test files on an approved deduplication apply", "writes .opencode/test-dedup/<feature>.json"]
safetyGate: { mutates: true, requiresEditor: true, requiresApproval: true, dryRunFirst: true }
uses: [unity-run-tests, test-deduplication, performance-diagnostics, gate-review]
provides: [unity-polish, polish-pass]
requires: [unity-verification-report, test-inventory]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# unity-polish

Harden the feature before release. Routes to the Unity 3D Orchestrator to run the **Polish** phase of
the lifecycle catalog (ADR-0016).

## Usage

```
/unity-polish {feature}
```

## Context

1. `.opencode/context/unity-3d/navigation.md` (always)
2. `workflows/quality-gate.md`
3. `lookup/performance-budgets.md` + `lookup/validation-rules.md`

## Workflow

1. `unity-run-tests` — run the full EditMode/PlayMode suite and record the verification report.
2. `test-deduplication` — propose removals/merges in dry-run; apply only with approval, recording
   every removal. Never trade coverage for tidiness.
3. `performance-diagnostics` — profile against the budget when a live bridge is available; fail-soft
   to `unavailable` without it.
4. `gate-review` — fold the named gates strictest-wins under the review-intensity knob
   (`full | lean | solo`).

## Success Criteria

- [ ] Test suite green
- [ ] Deduplication dry-run recorded; only approved removals applied
- [ ] Performance within budget (or unavailable reported)
- [ ] Verification gate folded with evidence
