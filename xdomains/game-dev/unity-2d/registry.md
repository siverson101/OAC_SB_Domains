Unity 2D Sub-Domain — Registry & Provenance
===========================================

Registry of the agents, subagents, commands, context, workflows, and gates provided by the
`game-dev/unity-2d` sub-domain, with their source, dependencies, and consumers.

Provenance
----------
The 2D sub-domain was split out of the original `unity-game-dev` plugin. All entries originate
from the OAC Unity build; no third-party source was copied, so no per-file MIT notices are
required. If external repos are imported later, add them to the central attribution file
(`THIRD_PARTY_NOTICES.md`) and to the "External sources" table below.

Source legend
- `oac-build` — OAC-generated Unity system (split into this sub-domain).

Agents
------
| Item | Type | Path | Source | Uses | Used by |
|------|------|------|--------|------|---------|
| Unity2DOrchestrator | primary agent | `agent/unity-2d-orchestrator.md` | oac-build | ContextScout; all unity subagents; unity-2d context + workflows | User; `/unity-*` commands |

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

Commands
--------
| Item | Path | Source | Uses | Used by |
|------|------|--------|------|---------|
| `/unity-feature` | `command/unity-feature.md` | oac-build | navigation, feature-delivery, UnityImplementer, UnityQA, UnityScene | User |
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

Context (knowledge)
-------------------
| Item | Path | Source | Used by |
|------|------|--------|---------|
| Navigation | `context/unity-2d/navigation.md` | oac-build | Orchestrator, all subagents, all commands |
| Core concepts | `context/unity-2d/concepts/unity-2d-core.md` | oac-build | Orchestrator, Implementer |
| Project layout | `context/unity-2d/concepts/project-layout.md` | oac-build | Scene, ArtAsset, Architecture |
| Feature pipeline guide | `context/unity-2d/guides/feature-pipeline.md` | oac-build | feature-delivery workflow |
| Scene/prefab safety | `context/unity-2d/guides/scene-prefab-safety.md` | oac-build | Scene subagent, scene-assembly workflow |
| Build CLI guide | `context/unity-2d/guides/build-cli.md` | oac-build | QA, `/unity-build`, `/unity-test` |
| C# conventions | `context/unity-2d/lookup/csharp-conventions.md` | oac-build | Implementer |
| Validation rules | `context/unity-2d/lookup/validation-rules.md` | oac-build | QA, quality-gate workflow |
| Performance budgets | `context/unity-2d/lookup/performance-budgets.md` | oac-build | ShaderVFX, ArtAsset, `/unity-architecture`, `/unity-vfx` |
| Editor utilities | `context/unity-2d/examples/editor-utilities.md` | oac-build | Implementer, `/unity-build` |
| MonoBehaviour templates | `context/unity-2d/examples/mono-behaviour-templates.md` | oac-build | Implementer, feature-delivery workflow |
| Common issues | `context/unity-2d/errors/common-unity-issues.md` | oac-build | All subagents (troubleshooting) |
| Shared Unity context | `context/domain/unity-common.md` | oac-build | All Unity sub-domains |
| 2D starter | `context/domain/unity-2d.md` | oac-build | unity-2d sub-domain |

Workflows
---------
| Item | Path | Source | Uses | Trigger |
|------|------|--------|------|---------|
| Feature delivery | `context/unity-2d/workflows/feature-delivery.md` | oac-build | Implementer, QA, Scene | `/unity-feature` |
| Quality gate | `context/unity-2d/workflows/quality-gate.md` | oac-build | QA, build-cli, validation-rules | `/unity-test`, `/unity-build`, final gate |
| Scene assembly | `context/unity-2d/workflows/scene-assembly.md` | oac-build | Scene, ArtAsset, ShaderVFX | `/unity-scene` |

Gates
-----
Defined in `context/unity-2d/lookup/validation-rules.md`; enforced by UnityQA and the orchestrator.

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

External sources
----------------
None yet. When importing MIT-licensed repos, add: repo name, author, license, and which parts of
the sub-domain use it. Also update the central attribution file and add copyright + MIT notices to
any adapted source files.
