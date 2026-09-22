---
id: unity-brainstorm
summary: Turn a game idea into a documented concept and, optionally, a feature plan — scope the idea, decompose it into systems, and name the patterns before any code.
family: compose
mode: offline
description: The Concept entry point. Routes to the Unity 3D Orchestrator to restate the idea with the user, decompose it into systems and primitives, and capture the concept as a plan artifact when the user wants one. Offline and read-only; it writes nothing unless a plan is requested.
inputs: { projectRoot: "string", opencodeDir: "string", idea: "string", systems: "string?", plan: "boolean?" }
outputs: { status: "string", concept: "string", systems: "array", planPath: "string?" }
sideEffects: ["writes .opencode/plans/<slug>.md only when a plan is requested"]
safetyGate: { mutates: false, requiresEditor: false, writesState: true }
uses: [plan-feature, primitive-composition, contract-aware-design, pattern-library]
provides: [unity-brainstorm, concept]
requires: [unity-project]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# unity-brainstorm

Turn a game idea into a documented concept. Routes to the Unity 3D Orchestrator to run the
**Concept** and **Systems Design** phases of the lifecycle catalog (ADR-0016).

## Usage

```
/unity-brainstorm {idea}
```

Example: `/unity-brainstorm a co-op twin-stick shooter with wave-based enemies`

## Context

1. `.opencode/context/unity-3d/navigation.md` (always)
2. `concepts/unity-3d-core.md` + `concepts/project-layout.md`
3. `../domain/unity-common.md`

## Workflow

1. Restate the idea, audience and constraints; confirm ambiguity with the user.
2. `primitive-composition` — decompose the concept into systems and primitives; surface cycles and
   unresolved references.
3. `contract-aware-design` — validate every capability contract the systems imply.
4. `pattern-library` (optional) — select the enabled patterns and surface conflicts; never choose silently.
5. `plan-feature` (optional, TDD-gated) — capture the concept as `.opencode/plans/<slug>.md` when asked.

## Success Criteria

- [ ] Idea restated and confirmed
- [ ] Systems map with cycles/unresolved references surfaced
- [ ] Pattern conflicts surfaced, never silently chosen
- [ ] Optional concept plan written (if requested)
