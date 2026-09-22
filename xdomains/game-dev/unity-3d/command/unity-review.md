---
id: unity-review
summary: Review Unity 3D work against the spec and the gates — fold the verification gates under the review-intensity knob and report findings with evidence.
family: verify
mode: both
description: The review entry point. Routes to the Unity 3D Orchestrator to fold the named verification gates strictest-wins (gate-review) and, where asked, run a code review of the change. Review intensity is read from .opencode/unity-studio.json (full | lean | solo). Offline; the gate fold needs no Editor.
inputs: { projectRoot: "string", opencodeDir: "string", changeScope: "array", reviewIntensity: "full|lean|solo", externalVerdict: "confirmed|uncertain?" }
outputs: { status: "string", gates: "object", findings: "array", reviewRequired: "number" }
sideEffects: []
safetyGate: { mutates: false, requiresEditor: false }
uses: [gate-review, compile-and-verify-project, run-edit-mode-tests, run-play-mode-tests]
provides: [unity-review, review-verdict]
requires: [gate-state, unity-verification-report]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# unity-review

Review the work before release. Routes to the Unity 3D Orchestrator to run the **Release** gate and a
code review of the change.

## Usage

```
/unity-review {change scope}
```

## Context

1. `.opencode/context/unity-3d/navigation.md` (always)
2. `lookup/validation-rules.md`
3. `../domain/unity-common.md`

## Workflow

1. `gate-review` — fold compile, EditMode/PlayMode, scene/asset, build, performance and visual gates
   strictest-wins under the review-intensity knob. Gates that cannot be derived from on-disk state
   stay `not_run`.
2. Review the change against the originating plan/spec; route a general review to `CodeReviewer`.
3. Report findings with evidence; on failure report → propose → request approval before fixing.

## Success Criteria

- [ ] Gates folded strictest-wins with evidence
- [ ] Findings reported, not silently fixed
- [ ] Review intensity honoured (`full | lean | solo`)
