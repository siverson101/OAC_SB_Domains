<!-- Context: unity-3d/navigation | Priority: critical | Version: 1.0 | Updated: 2026-09-07 -->

# Unity 3D Game Dev Navigation

**Purpose**: Producing Unity 3D games — feature implementation, scene/prefab work, build pipeline, testing, art/shaders/animation.

**Shared plugin context**: `../domain/unity-common.md` (all Unity) + `../domain/unity-3d.md` (3D starter).

---

## Structure

```
unity-3d/
├── navigation.md
├── concepts/           # Core Unity 3D concepts & project layout
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
| **Core Unity 3D concepts** | `concepts/unity-3d-core.md` |
| **Project layout** | `concepts/project-layout.md` |
| **Implement a feature** | `/unity-implement` → `workflows/feature-delivery.md` + `guides/feature-pipeline.md` |
| **Scene/prefab changes** | `workflows/scene-assembly.md` + `guides/scene-prefab-safety.md` |
| **QA & validation** | `workflows/quality-gate.md` |
| **Build via CLI** | `guides/build-cli.md` |
| **C# conventions** | `lookup/csharp-conventions.md` |
| **Validation rules** | `lookup/validation-rules.md` |
| **Performance budgets** | `lookup/performance-budgets.md` |
| **Troubleshooting** | `errors/common-unity-issues.md` |

---

## Command Routes

Lifecycle commands route to the Unity 3D Orchestrator and run the lifecycle catalog (ADR-0016).

| Command | Purpose | Loads |
|---------|---------|-------|
| `/unity-setup` | Bootstrap: project scan, architecture/version/compile/log baselines | `concepts/project-layout.md`, `lookup/validation-rules.md` |
| `/unity-brainstorm` | Turn an idea into a concept and systems map | `concepts/unity-3d-core.md`, `concepts/project-layout.md` |
| `/unity-plan` | Plan artifact + test plan before implementing | `workflows/feature-delivery.md`, `lookup/csharp-conventions.md`, `lookup/validation-rules.md` |
| `/unity-implement` | Implement a feature end-to-end through the change loop (supersedes the former feature command) | `workflows/feature-delivery.md`, `guides/feature-pipeline.md`, `lookup/csharp-conventions.md`, `lookup/validation-rules.md` |
| `/unity-debug` | Diagnose and fix a runtime/compile failure | `errors/common-unity-issues.md`, `lookup/validation-rules.md` |
| `/unity-polish` | Full test suite, deduplicate, profile, fold the gate | `workflows/quality-gate.md`, `lookup/performance-budgets.md`, `lookup/validation-rules.md` |
| `/unity-review` | Fold verification gates and review the change | `lookup/validation-rules.md` |
| `/unity-scene` | Create or restructure a scene/prefab safely | `workflows/scene-assembly.md`, `guides/scene-prefab-safety.md` |
| `/unity-test` | Run EditMode/PlayMode tests | `workflows/quality-gate.md`, `lookup/validation-rules.md` |
| `/unity-build` | Batch-mode build for a target platform | `guides/build-cli.md`, `lookup/validation-rules.md` |
| `/unity-architecture` | Review/design architecture and budgets | `concepts/project-layout.md`, `lookup/performance-budgets.md` |
| `/unity-animator` | Animator controllers, clips, retargeting | `concepts/unity-3d-core.md` |
| `/unity-vfx` | Shaders / VFX Graph / materials | `lookup/performance-budgets.md` |
| `/unity-ase` | Amplify Shader Editor node graphs | `lookup/performance-budgets.md` |
| `/uitk` | UI Toolkit screens (UXML/USS/C#) | `concepts/project-layout.md` |
| `/workflow-catalog` | Validate the lifecycle catalog and recipes; report phase progression and the next command | `workflows/feature-delivery.md` |

## Runtime Loops

Runtime loops are **gated by runtime/bridge availability** and fail soft: with no Unity CLI live
channel they report `unavailable`, never throw.

| Command | Purpose | Loads |
|---------|---------|-------|
| `/unity-runtime-target` | Read runtime logs, snapshot/find/click/key the live UI | `errors/common-unity-issues.md` |
| `/unity-prefab-sweep` | Inspector → prefab patch `--dryRun` → YAML escalation | `workflows/scene-assembly.md`, `guides/scene-prefab-safety.md` |
| `/unity-performance` | Profiler counters/snapshots against the budget | `lookup/performance-budgets.md`, `workflows/quality-gate.md` |

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
| Unity CLI MCP | `project/mcp.md` |
| Verification gate | `project/gate.md` |

The full sub-domain registry (agents, sub-agents, commands, abilities, context, consumers) is at
`registry.md`.

---

## Agent Map

| Concern | Agent | Route |
|---------|-------|-------|
| Entry & coordination | Unity 3D Orchestrator | `agent/unity-3d-orchestrator.md` |
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
