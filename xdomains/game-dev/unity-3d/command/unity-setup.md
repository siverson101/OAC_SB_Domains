---
id: unity-setup
summary: Bootstrap a Unity 3D project for OAC — scan the project, record the architecture and version baselines, and confirm a clean compile and log baseline.
family: compose
mode: both
description: The Concept / Technical Setup entry point. Routes to the Unity 3D Orchestrator, which runs the offline project scan and architecture baseline, then the compile and log baselines so later phases read evidence rather than guesses. Fail-soft: a missing Unity project or Editor is reported, never thrown.
inputs: { projectRoot: "string", opencodeDir: "string", projectName: "string?", unityVersion: "string?" }
outputs: { status: "string", scanned: "boolean", compileClean: "boolean", currentPhase: "string?", nextCommand: "string?" }
sideEffects: ["writes .opencode/project-data/ (project structure, compile-state, log-digest, version baselines)"]
safetyGate: { mutates: false, requiresEditor: true, writesState: true }
uses: [gather-unity-context, version-drift, unity-architecture, compile-and-verify-project, workflow-catalog]
provides: [unity-setup, project-baseline]
requires: [unity-project]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# unity-setup

Bootstrap the project before any feature work. Routes to the Unity 3D Orchestrator to run the
**Concept** and **Technical Setup** phases of the lifecycle catalog (ADR-0016).

## Usage

```
/unity-setup [project name or Unity version]
```

## Context

1. `.opencode/context/unity-3d/navigation.md` (always)
2. `concepts/project-layout.md` + `../domain/unity-common.md`
3. `lookup/validation-rules.md`

## Workflow

1. `gather-unity-context` — scan structure, packages, commands, pipeline and MCP status (offline).
2. `version-drift` — record Editor, package and Unity CLI baselines under `project-data/version-baselines/`.
3. `unity-architecture` — author the architecture baseline from the scan.
4. `compile-and-verify-project` — checkpoint a clean compile; the gather `--gate` pass records the log
   baseline. Requires the Editor; with none open, report the gap rather than guessing.
5. `workflow-catalog` — report the current lifecycle phase and the next command.

## Success Criteria

- [ ] `.opencode/project-data/project-structure.json` written
- [ ] Compile clean (or the missing Editor reported)
- [ ] Version baselines recorded
- [ ] Current phase + next command reported
