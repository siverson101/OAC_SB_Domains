<!-- Hand-maintained provenance registry; it collides by basename (`registry.md`) with the generated capability registry at `<opencode-dir>/context/<subdomain>/registry.md`, which is written by `build-registry` and must not be hand-edited. -->
Unity 3D Sub-Domain — Registry & Provenance
===========================================

Registry of the agents, subagents, commands, context, workflows, and gates provided by the
`game-dev/unity-3d` sub-domain, with their source, dependencies, and consumers.

Provenance
----------
All entries originate from the OAC Unity 3D build (the generated system previously installed at
`test/.opencode/`) and were merged into this sub-domain. No third-party source was copied, so no
per-file MIT notices are required. If external repos are imported later, add them to the central
attribution file (`THIRD_PARTY_NOTICES.md`) and to the "External sources" table below.

Source legend
- `oac-build` — OAC-generated Unity 3D system (OAC/Unity).
- `claude-unity-game-studio` — Ido Cohen, MIT; reauthored design reference for the Full Studio hierarchy.

Agents
------
| Item | Type | Path | Source | Uses | Used by |
|------|------|------|--------|------|---------|
| Unity3DOrchestrator | primary agent | `agent/unity-3d-orchestrator.md` | oac-build | ContextScout; all unity subagents; unity-3d context + workflows | User; `/unity-*` commands |

Subagents
---------
| Item | Type | Path | Source | Uses | Used by |
|------|------|------|--------|------|---------|
| UnityImplementer | subagent | `agent/subagents/unity/implementer.md` | oac-build | csharp-conventions, navigation | Orchestrator; feature-delivery workflow |
| UnityScene | subagent | `agent/subagents/unity/scene.md` | oac-build | scene-prefab-safety, project-layout | Orchestrator; scene-assembly workflow |
| UnityUI | subagent | `agent/subagents/unity/ui.md` | oac-build (template `UnityUI.md`) | navigation | Orchestrator; `/ui`, `/ugui`, `/uitk` |
| UnityAnimator | subagent | `agent/subagents/unity/animator.md` | oac-build | navigation | Orchestrator; `/unity-animator` |
| UnityShaderVFX | subagent | `agent/subagents/unity/shadervfx.md` | oac-build | performance-budgets, navigation | Orchestrator; `/unity-vfx`, `/unity-ase` |
| UnityArtAsset | subagent | `agent/subagents/unity/artasset.md` | oac-build | project-layout, performance-budgets | Orchestrator; scene/art tasks |
| UnityQA | subagent | `agent/subagents/unity/qa.md` | oac-build | validation-rules, build-cli | Orchestrator; quality-gate, `/unity-test`, `/unity-build` |
| UnityTddSpecialist | subagent (gated) | `agent/subagents/unity/tdd-specialist.md` | oac-build | test seams, EditMode-first loops | Orchestrator when `toggles.tdd` is true |
| UnityNativePlugin | subagent (gated) | `agent/subagents/unity/native-plugin.md` | oac-build | native interop, platform builds | Orchestrator when native detection is affirmative |

Full Studio agents
------------------
The mutually-exclusive Full Studio hierarchy (studio mode `full`), reauthored from the MIT
`claude-unity-game-studio` template (see `docs/Attribution.md`). The orchestrator is the `mode:
primary` entry; every other row is a subagent.

| Item | Type | Path | Source | Uses | Used by |
|------|------|------|--------|------|---------|
| FullStudioOrchestrator | primary agent | `agent/full-studio/full-studio-orchestrator.md` | claude-unity-game-studio (MIT) | directors; unity-3d context | User |
| CreativeDirector | subagent | `agent/full-studio/creative-director.md` | claude-unity-game-studio (MIT) | contract-aware-design, gate-review | FullStudioOrchestrator |
| TechnicalDirector | subagent | `agent/full-studio/technical-director.md` | claude-unity-game-studio (MIT) | code-navigation, compile-and-verify-project | FullStudioOrchestrator |
| Producer | subagent | `agent/full-studio/producer.md` | claude-unity-game-studio (MIT) | coordination-board, project-status | FullStudioOrchestrator |
| ArtDirector | subagent | `agent/full-studio/art-director.md` | claude-unity-game-studio (MIT) | asset-intelligence, contract-aware-design | FullStudioOrchestrator |
| GameDesigner | subagent | `agent/full-studio/game-designer.md` | claude-unity-game-studio (MIT) | primitive-composition, contract-aware-design | FullStudioOrchestrator |
| LeadProgrammer | subagent | `agent/full-studio/lead-programmer.md` | claude-unity-game-studio (MIT) | code-navigation, pattern-library | FullStudioOrchestrator |
| QaLead | subagent | `agent/full-studio/qa-lead.md` | claude-unity-game-studio (MIT) | run-edit-mode-tests, run-play-mode-tests | FullStudioOrchestrator |
| ArtLead | subagent | `agent/full-studio/art-lead.md` | claude-unity-game-studio (MIT) | asset-intelligence, shader-helper | FullStudioOrchestrator |
| GameplayProgrammer | subagent | `agent/full-studio/gameplay-programmer.md` | claude-unity-game-studio (MIT) | input-automation, script-scaffolding | LeadProgrammer |
| UiProgrammer | subagent | `agent/full-studio/ui-programmer.md` | claude-unity-game-studio (MIT) | ui-interaction, runtime-ui-validation | LeadProgrammer |
| PerformanceAnalyst | subagent | `agent/full-studio/performance-analyst.md` | claude-unity-game-studio (MIT) | performance-diagnostics, runtime-debugging | TechnicalDirector |
| ShaderSpecialist | subagent | `agent/full-studio/shader-specialist.md` | claude-unity-game-studio (MIT) | shader-helper, performance-diagnostics | ArtLead |
| AudioSpecialist | subagent | `agent/full-studio/audio-specialist.md` | claude-unity-game-studio (MIT) | asset-intelligence, script-scaffolding | ArtLead |
| LevelDesigner | subagent | `agent/full-studio/level-designer.md` | claude-unity-game-studio (MIT) | prefab-automation, scene-editing | GameDesigner |
| TechnicalArtist | subagent | `agent/full-studio/technical-artist.md` | claude-unity-game-studio (MIT) | prefab-automation, scene-editing, shader-helper | ArtLead |
| NativePlugin | subagent | `agent/full-studio/native-plugin.md` | claude-unity-game-studio (MIT) | platform-info, unity-build | TechnicalDirector |
| TddSpecialist | subagent | `agent/full-studio/tdd-specialist.md` | claude-unity-game-studio (MIT) | unity-change-loop, run-edit-mode-tests | QaLead |

Commands
--------
| Item | Path | Source | Uses | Used by |
|------|------|--------|------|---------|
| `/unity-setup` | `command/unity-setup.md` | oac-build | navigation, project-layout, validation-rules, gather-unity-context | User |
| `/unity-brainstorm` | `command/unity-brainstorm.md` | oac-build | navigation, unity-3d-core, plan-feature | User |
| `/unity-plan` | `command/unity-plan.md` | oac-build | navigation, feature-delivery, csharp-conventions, validation-rules, plan-feature, test-plan | User |
| `/unity-implement` | `command/unity-implement.md` | oac-build | navigation, feature-delivery, feature-pipeline, csharp-conventions, validation-rules, unity-change-loop, UnityImplementer, UnityQA, UnityScene | User |
| `/unity-debug` | `command/unity-debug.md` | oac-build | navigation, common-unity-issues, validation-rules, runtime-debugging, unity-change-loop | User |
| `/unity-polish` | `command/unity-polish.md` | oac-build | navigation, quality-gate, performance-budgets, validation-rules, test-deduplication, gate-review | User |
| `/unity-review` | `command/unity-review.md` | oac-build | navigation, validation-rules, gate-review | User |
| `/unity-scene` | `command/unity-scene.md` | oac-build | scene-prefab-safety, project-layout, UnityScene | User |
| `/unity-test` | `command/unity-test.md` | oac-build | validation-rules, build-cli, UnityQA | User |
| `/unity-build` | `command/unity-build.md` | oac-build | build-cli, validation-rules, UnityQA | User |
| `/unity-architecture` | `command/unity-architecture.md` | oac-build | project-layout, performance-budgets, navigation | User |
| `/unity-animator` | `command/unity-animator.md` | oac-build | navigation, UnityAnimator | User |
| `/unity-vfx` | `command/unity-vfx.md` | oac-build | performance-budgets, UnityShaderVFX | User |
| `/unity-ase` | `command/unity-ase.md` | oac-build | performance-budgets, UnityShaderVFX | User |
| `/ui` | `command/ui.md` | oac-build | navigation, UnityUI, ui-interaction | User |
| `/ugui` | `command/ugui.md` | oac-build | navigation, UnityUI (UGUI hint) | User |
| `/uitk` | `command/uitk.md` | oac-build | navigation, UnityUI (UI Toolkit hint) | User |
| `/unity-skills` | `command/unity-skills.md` | oac-build (Phase 3.5) | unity-skills ability | User |
| `/unity-runtime-target` | `command/unity-runtime-target.md` | oac-build | navigation, common-unity-issues, runtime-debugging, runtime-ui-validation | User |
| `/unity-prefab-sweep` | `command/unity-prefab-sweep.md` | oac-build | navigation, scene-assembly, scene-prefab-safety, prefab-automation, scene-editing, UnityScene | User |
| `/unity-performance` | `command/unity-performance.md` | oac-build | navigation, performance-budgets, quality-gate, performance-diagnostics | User |
| `/workflow-catalog` | `command/workflow-catalog.md` | oac-build (Phase 6) | workflow-catalog ability, recipe-contract, capability-contract | User; `/unity-setup` |

Context (knowledge)
-------------------
| Item | Path | Source | Used by |
|------|------|--------|---------|
| Navigation | `context/unity-3d/navigation.md` | oac-build | Orchestrator, all subagents, all commands |
| Core concepts | `context/unity-3d/concepts/unity-3d-core.md` | oac-build | Orchestrator, Implementer |
| Project layout | `context/unity-3d/concepts/project-layout.md` | oac-build | Scene, ArtAsset, Architecture |
| Feature pipeline guide | `context/unity-3d/guides/feature-pipeline.md` | oac-build | feature-delivery workflow |
| Scene/prefab safety | `context/unity-3d/guides/scene-prefab-safety.md` | oac-build | Scene subagent, scene-assembly workflow |
| Build CLI guide | `context/unity-3d/guides/build-cli.md` | oac-build | QA, `/unity-build`, `/unity-test` |
| C# conventions | `context/unity-3d/lookup/csharp-conventions.md` | oac-build | Implementer |
| Validation rules | `context/unity-3d/lookup/validation-rules.md` | oac-build | QA, quality-gate workflow |
| Performance budgets | `context/unity-3d/lookup/performance-budgets.md` | oac-build | ShaderVFX, ArtAsset, `/unity-architecture`, `/unity-vfx` |
| Editor utilities | `context/unity-3d/examples/editor-utilities.md` | oac-build | Implementer, `/unity-build` |
| MonoBehaviour templates | `context/unity-3d/examples/mono-behaviour-templates.md` | oac-build | Implementer, feature-delivery workflow |
| Common issues | `context/unity-3d/errors/common-unity-issues.md` | oac-build | All subagents (troubleshooting) |
| Shared Unity context | `context/domain/unity-common.md` | oac-build | All Unity sub-domains |
| 3D starter | `context/domain/unity-3d.md` | oac-build | unity-3d sub-domain |

Workflows
---------
| Item | Path | Source | Uses | Trigger |
|------|------|--------|------|---------|
| Feature delivery | `context/unity-3d/workflows/feature-delivery.md` | oac-build | Implementer, QA, Scene | `/unity-implement` |
| Quality gate | `context/unity-3d/workflows/quality-gate.md` | oac-build | QA, build-cli, validation-rules | `/unity-test`, `/unity-build`, final gate |
| Scene assembly | `context/unity-3d/workflows/scene-assembly.md` | oac-build | Scene, ArtAsset, ShaderVFX | `/unity-scene` |

Recipes
-------
The recipes are the canonical data layer for workflow↔ability and workflow↔agent
edges (ADR-0016); the prose workflows above are knowledge, not edge sources, so
the registry derives `workflow-ability`/`workflow-agent` edges from the recipes
only. Each recipe validates against `xdomains/context/recipe.schema.json`.

| Recipe | Path | Source | Abilities | Agents | Gates |
|--------|------|--------|-----------|--------|-------|
| Unity Change Loop | `recipes/unity-change-loop.json` | oac-build (Phase 6) | code-navigation, offline-project-inspection, compile-and-verify-project, unity-run-tests, runtime-ui-validation | implementer | compile, logs, tests, observe |
| Unity Prefab / Scene Escalation | `recipes/unity-prefab-scene.json` | oac-build (Phase 6) | scene-editing, prefab-automation | scene | prefab-dry-run, yaml-escalation |

Gates
-----
Defined in `context/unity-3d/lookup/validation-rules.md`; enforced by UnityQA and the orchestrator.

| Gate | Criteria | Enforced by |
|------|----------|-------------|
| Compile | C# compiles clean (dotnet/csc or Unity CLI) | UnityQA, Orchestrator |
| Test | EditMode (and PlayMode where needed) pass via Unity Test Runner | UnityQA |
| Scene/Asset | Scene re-opens clean; no broken GUIDs; import-only CLI exits 0 | UnityScene, UnityQA |
| Build | Batch-mode build exits 0; output path reported | UnityQA, `/unity-build` |
| Performance | Within `performance-budgets.md`; no per-frame allocations | UnityShaderVFX, ArtAsset, `/unity-architecture` |

Declared abilities (realised as commands)
-----------------------------------------
Declared in `sb-domain.json` for discovery. Until the abilities runtime
(`@openagents/plugin-abilities`) ships and is installed, each declared ability is realised as a
command: the apply engine resolves `<ability>` to `command/<ability>.md` and merges into an
existing command of the same name rather than duplicating it (ADR-0004). An ability with no
matching command is reported as a warning, never silently invented.

| Ability | Realised as | Would use |
|---------|-------------|-----------|
| `unity-read-project` | command `unity-read-project` (not yet authored) | Project scan (ProjectSettings, Packages/manifest.json) |
| `unity-build` | command `unity-build` (shipped) | Unity CLI batch build |
| `unity-run-tests` | command `unity-test` (shipped) | Unity Test Runner (EditMode/PlayMode) |
| `failing-test-first` | command `failing-test-first` (shipped, Phase 5) | Test results (`--test-results`); red-step decision; `unity-coding-skills` design reference |
| `plan-feature` | command `plan-feature` (shipped, Phase 5) | Plan artifact + Testability verdict; `MattSkills/skills/engineering` design reference |
| `test-plan` | command `test-plan` (shipped, Phase 5) | Capability/primitive `testPlan` data |
| `test-deduplication` | command `test-deduplication` (shipped, Phase 5) | Test descriptors / `*.cs` test scan; `unity-coding-skills` design reference |
| `version-drift` | command `version-drift` (shipped) | `ProjectSettings/ProjectVersion.txt`, `Packages/manifest.json`, Unity CLI (`unity --version`, `unity command --format json`); baselines under `project-data/version-baselines/` |
| `workflow-catalog` | command `workflow-catalog` (shipped, Phase 6) | `xdomains/context/workflow-catalog.json` + `recipes/*.json`; lifecycle progression via `evaluateArtifactCheck` |

Phase 5 also modified two existing abilities without changing their source: `gate-review` gained an
`externalVerdict` (`confirmed`/`uncertain`) fold, and `compile-and-verify-project` now requires a
declared change scope on validate. Both remain `oac-build`.

External sources
----------------
The central attribution record is `docs/Attribution.md` (LR1–LR3). Imported primitives live under
`primitives/<id>/` with their `source_repo` + `license` in each `primitive.yaml`; the skip ledger is
`primitive-not-imported.md`. The seven analysed upstream repositories, the 12 imported primitives,
the gated-out copyleft set, and the required license texts are all recorded in that central file.

| Source | Holder | License | Used by |
|--------|--------|---------|---------|
| `unity-skills` | Pravesh Koirala | MIT | `primitives/` (12 imported primitives); `primitive-composition`, `contract-aware-design` |
| `claude-unity-game-studio` | Ido Cohen | MIT | Full-studio hierarchy (design reference; Phase 4) |
| `UnityCLI.AgenticExtensions` | Thomas Moore | MIT | Coordination board, profiling, UI Toolkit (design reference) |
| `Unity-Open-MCP` | Alexey Perov | MIT | Verify family, offline reads; `unity-open-mcp-missing-tools.md` (design reference) |
| `AIBridge` | liyingsong | MIT | Prefab/scene automation, runtime workflows (design reference) |
| `unity-coding-skills` | Koji Hasegawa | Unlicense | TDD workflow and test subagents; `failing-test-first`/`test-deduplication`/test-designer design (design reference) |
| `MattSkills/skills/engineering` | Matt Pocock | MIT | Plan-artifact and TDD-loop workflow (`to-spec`, `tdd`, `to-tickets`, `wayfinder`) (design reference) |
| `Unity-Developer-Tools` | TM Hospitality Strategies | CC-BY-NC-ND-4.0 | Design reference only — no verbatim copy |
