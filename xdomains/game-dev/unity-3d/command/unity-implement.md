---
id: unity-implement
summary: Implement a Unity 3D feature end-to-end through the gated change loop — smallest change, compile, logs, tests, observe — citing evidence and refusing done without green tests.
family: compose
mode: both
description: The Production entry point, replacing the former feature command. Routes to the Unity 3D Orchestrator to implement the scoped feature (UnityImplementer), add tests (UnityQA), wire the scene (UnityScene), and drive the resolve → inspect → change → compile → logs → tests → observe loop. Offline-first; the observe stage uses the Unity CLI live channel when available and reports unavailable (fail-soft) without it.
inputs: { projectRoot: "string", opencodeDir: "string", feature: "string", acceptanceCriteria: "string?", plan: "string?" }
outputs: { status: "string", filesTouched: "array", compileClean: "boolean", testsGreen: "boolean", done: "boolean", refusals: "array" }
sideEffects: ["edits project assets", "writes .opencode/project-data/unity-verification-report.json"]
safetyGate: { mutates: true, requiresEditor: true, requiresApproval: true }
uses: [unity-change-loop, failing-test-first, script-scaffolding, compile-and-verify-project, run-edit-mode-tests, run-play-mode-tests, runtime-ui-validation]
provides: [unity-implement, feature-implementation]
requires: [unity-project, plan-artifact]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# unity-implement

Implement a feature end-to-end. Routes to the Unity 3D Orchestrator to run the **Production** phase of
the lifecycle catalog (ADR-0016) and the **feature-delivery** workflow. This command supersedes the
former feature-delivery command.

`unity-change-loop` is a **Run** ability (family `run`, read-only), not a Compose ability. This
command *composes* it and therefore declares a stricter `safetyGate` than the ability itself: the
command mutates assets and needs the Editor, while the ability only folds on-disk evidence. A command
may declare a stricter gate than the abilities it composes; it must never declare a weaker one.

## Usage

```
/unity-implement {feature}
```

Example: `/unity-implement add a player controller with Rigidbody movement and camera-relative input`

## Context

1. `.opencode/context/unity-3d/navigation.md` (always)
2. `workflows/feature-delivery.md` + `guides/feature-pipeline.md`
3. `lookup/csharp-conventions.md` + `lookup/validation-rules.md`
4. `../domain/unity-common.md`

## Workflow

1. Scope the feature and confirm acceptance criteria with the user (read the plan artifact if one exists).
2. `failing-test-first` — when TDD is on, confirm the named test fails for the expected reason first.
3. Implement via `UnityImplementer` (focused C#, testable pure logic); route scene/prefab wiring to
   `UnityScene`.
4. Add tests via `UnityQA` (EditMode first, PlayMode where needed).
5. `unity-change-loop` — drive resolve → inspect → smallest change → compile → logs → tests → observe,
   citing evidence. The loop refuses `done` without green compile, logs and tests.
6. Coordinate `UnityScene` for any scene/prefab wiring; validate compile clean, tests pass, scene loads.
7. Report files touched + results.

## Success Criteria

- [ ] C# compiles clean
- [ ] Tests pass for the feature logic
- [ ] Scene loads without console errors (if touched)
- [ ] Change loop reports `done` with cited evidence
