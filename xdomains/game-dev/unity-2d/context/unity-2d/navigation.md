<!-- Context: unity-2d/navigation | Priority: critical | Version: 1.0 | Updated: 2026-09-07 -->

# Unity 2D Game Dev Navigation

**Purpose**: Producing Unity 2D games — feature implementation, scene/prefab work, build pipeline, testing, art/shaders/animation.

**Shared domain context**: `../domain/unity-common.md` (all Unity) + `../domain/unity-2d.md` (2D starter).

---

## Structure

```
unity-2d/
├── navigation.md
├── concepts/           # Core Unity 2D concepts & project layout
├── guides/             # Step-by-step procedures (feature → test → build)
├── lookup/             # Quick reference (C#, validation, perf budgets)
├── examples/           # Reusable templates & patterns
├── errors/             # Common Unity issues & fixes
└── workflows/          # End-to-end workflow definitions
```

---

## Quick Routes

| Task | Path |
|------|------|
| **Core Unity 2D concepts** | `concepts/unity-2d-core.md` |
| **Project layout** | `concepts/project-layout.md` |
| **Implement a feature** | `workflows/feature-delivery.md` + `guides/feature-pipeline.md` |
| **Scene/prefab changes** | `workflows/scene-assembly.md` + `guides/scene-prefab-safety.md` |
| **QA & validation** | `workflows/quality-gate.md` |
| **Build via CLI** | `guides/build-cli.md` |
| **C# conventions** | `lookup/csharp-conventions.md` |
| **Validation rules** | `lookup/validation-rules.md` |
| **Performance budgets** | `lookup/performance-budgets.md` |
| **Troubleshooting** | `errors/common-unity-issues.md` |

---

## Project Context (generated)

Per-project context is generated under `project/` by the stage-3/stage-7 hooks, from
`.opencode/project-data/`. Regenerate with `build-project-context.js`.

| Concern | Path |
|---------|------|
| Project state | `project/project-state.md` |
| Packages | `project/packages.md` |
| Testing | `project/testing.md` |
| Native build | `project/native.md` |
| Skills | `project/skills.md` |
| Preferences | `project/preferences.md` |
| Files | `project/files.md` |
| Structure | `project/structure.md` |
| Commands | `project/commands.md` |
| Pipeline | `project/pipeline.md` |
| MCP | `project/mcp.md` |
| Verification gate | `project/gate.md` |

The full sub-domain registry (agents, sub-agents, commands, abilities, context, consumers) is at
`registry.md`.

---

## Agent Map

| Concern | Agent | Route |
|---------|-------|-------|
| Entry & coordination | Unity 2D Orchestrator | `agent/unity-2d-orchestrator.md` |
| Gameplay C# code | unity-implementer | `subagents/unity/implementer.md` |
| Scenes & prefabs | unity-scene | `subagents/unity/scene.md` |
| UI Toolkit | unity-uitk | `subagents/unity/uitk.md` |
| Animation | unity-animator | `subagents/unity/animator.md` |
| Shaders & VFX | unity-shadervfx | `subagents/unity/shadervfx.md` |
| Art & asset import | unity-artasset | `subagents/unity/artasset.md` |
| Testing & QA | unity-qa | `subagents/unity/qa.md` |

---

## Related Context

- **Core standards** → `../core/navigation.md`
- **Shared Unity context** → `../domain/unity-common.md`
