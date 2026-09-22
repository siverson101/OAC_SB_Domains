<!-- Context: unity-3d/agent-system-blueprint | Priority: high | Version: 1.0 -->

# Unity 3D Agent System Blueprint

> Generated from `sb-domain.json`, agent frontmatter, and the studio config. Do not edit by hand; regenerate with `build-registry.mjs`.

- Domain: `game-dev`
- Sub-domain: `unity-3d`
- Version: 0.2.0

## Model Tiers

| Tier | Model |
|---|---|
| router | (unset) |
| lead | (unset) |
| specialist | (unset) |

## Lean Hierarchy

Orchestrator: `unity-3d-orchestrator`; subagents: 9.

### Agents

| Id | Name | Path | Tier | Model | Abilities | Gate |
|---|---|---|---|---|---|---|
| unity-3d-orchestrator | Unity3DOrchestrator | `agent/unity-3d-orchestrator.md` | router |  | gather-unity-context, unity-read-project, project-status, coordination-board, gate-review |  |

### SubAgents

| Id | Name | Path | Tier | Model | Abilities | Gate |
|---|---|---|---|---|---|---|
| implementer | UnityImplementer | `agent/subagents/unity/implementer.md` | specialist |  | unity-read-project, script-scaffolding, input-automation, pattern-library, compile-and-verify-project, code-navigation, coordination-board |  |
| scene | UnityScene | `agent/subagents/unity/scene.md` | specialist |  | unity-read-project, scene-editing, prefab-automation, primitive-composition, coordination-board |  |
| uitk | UnityUITK | `agent/subagents/unity/uitk.md` | specialist |  | unity-read-project, uitk-interaction, runtime-ui-validation, script-scaffolding, coordination-board |  |
| animator | UnityAnimator | `agent/subagents/unity/animator.md` | specialist |  | unity-read-project, asset-intelligence, code-navigation, script-scaffolding, coordination-board |  |
| shadervfx | UnityShaderVFX | `agent/subagents/unity/shadervfx.md` | specialist |  | unity-read-project, shader-helper, performance-diagnostics, asset-intelligence, coordination-board |  |
| artasset | UnityArtAsset | `agent/subagents/unity/artasset.md` | specialist |  | unity-read-project, asset-intelligence, offline-project-inspection, performance-diagnostics, coordination-board |  |
| qa | UnityQA | `agent/subagents/unity/qa.md` | specialist |  | unity-run-tests, unity-build, run-edit-mode-tests, run-play-mode-tests, compile-and-verify-project, gate-review, ci-status-baseline, coordination-board |  |
| tdd-specialist | UnityTddSpecialist | `agent/subagents/unity/tdd-specialist.md` | specialist |  | unity-run-tests, run-edit-mode-tests, compile-and-verify-project, script-scaffolding, unity-change-loop, coordination-board | tdd |
| native-plugin | UnityNativePlugin | `agent/subagents/unity/native-plugin.md` | specialist |  | unity-read-project, script-scaffolding, code-navigation, compile-and-verify-project, unity-build, platform-info, coordination-board | native-subproject |

### Delegation Maps

- **unity-3d-orchestrator** — Reports to: the user (project owner); Implements from: project requests and the Unity commands (`/unity-setup`, `/unity-brainstorm`, `/unity-plan`, `/unity-implement`, `/unity-debug`, `/unity-polish`, `/unity-review`, `/unity-scene`, `/unity-test`, `/unity-build`, `/unity-architecture`, `/unity-animator`, `/unity-vfx`, `/unity-ase`, `/uitk`, `/unity-runtime-target`, `/unity-prefab-sweep`, `/unity-performance`); Escalation targets: the user for scope, approval, or blocked work; `CodeReviewer`, `DocWriter`, `OpenRepoManager` for non-Unity concerns; Siblings: none — top of the Lean hierarchy
- **implementer** — Reports to: `Unity3DOrchestrator`; Implements from: `/unity-implement` specs and orchestrator task briefs; Escalation targets: `Unity3DOrchestrator` for scope changes, blocked work, or approval; Siblings: `UnityScene`, `UnityUITK`, `UnityAnimator`, `UnityShaderVFX`, `UnityArtAsset`, `UnityQA`, `UnityTddSpecialist`, `UnityNativePlugin`
- **scene** — Reports to: `Unity3DOrchestrator`; Implements from: `/unity-scene` specs and orchestrator task briefs; Escalation targets: `Unity3DOrchestrator` for scope changes, blocked work, or approval; Siblings: `UnityImplementer`, `UnityUITK`, `UnityAnimator`, `UnityShaderVFX`, `UnityArtAsset`, `UnityQA`, `UnityTddSpecialist`, `UnityNativePlugin`
- **uitk** — Reports to: `Unity3DOrchestrator`; Implements from: `/uitk` specs and orchestrator task briefs; Escalation targets: `Unity3DOrchestrator` for scope changes, blocked work, or approval; Siblings: `UnityImplementer`, `UnityScene`, `UnityAnimator`, `UnityShaderVFX`, `UnityArtAsset`, `UnityQA`, `UnityTddSpecialist`, `UnityNativePlugin`
- **animator** — Reports to: `Unity3DOrchestrator`; Implements from: `/unity-animator` specs and orchestrator task briefs; Escalation targets: `Unity3DOrchestrator` for scope changes, blocked work, or approval; `UnityArtAsset` for import/rig settings; Siblings: `UnityImplementer`, `UnityScene`, `UnityUITK`, `UnityShaderVFX`, `UnityArtAsset`, `UnityQA`, `UnityTddSpecialist`, `UnityNativePlugin`
- **shadervfx** — Reports to: `Unity3DOrchestrator`; Implements from: `/unity-vfx` and `/unity-ase` specs and orchestrator task briefs; Escalation targets: `Unity3DOrchestrator` for scope changes, blocked work, or approval; Siblings: `UnityImplementer`, `UnityScene`, `UnityUITK`, `UnityAnimator`, `UnityArtAsset`, `UnityQA`, `UnityTddSpecialist`, `UnityNativePlugin`
- **artasset** — Reports to: `Unity3DOrchestrator`; Implements from: asset import/organization requests and orchestrator task briefs; Escalation targets: `Unity3DOrchestrator` for scope changes, blocked work, or approval; Siblings: `UnityImplementer`, `UnityScene`, `UnityUITK`, `UnityAnimator`, `UnityShaderVFX`, `UnityQA`, `UnityTddSpecialist`, `UnityNativePlugin`
- **qa** — Reports to: `Unity3DOrchestrator`; Implements from: `/unity-test` and `/unity-build` specs and orchestrator task briefs; Escalation targets: `Unity3DOrchestrator` for scope changes, blocked work, or approval; Siblings: `UnityImplementer`, `UnityScene`, `UnityUITK`, `UnityAnimator`, `UnityShaderVFX`, `UnityArtAsset`, `UnityTddSpecialist`, `UnityNativePlugin`
- **tdd-specialist** — Reports to: `Unity3DOrchestrator`; Implements from: `/unity-implement` and `/unity-test` specs and orchestrator task briefs; Escalation targets: `Unity3DOrchestrator` for scope changes, blocked work, or approval; Siblings: `UnityImplementer`, `UnityScene`, `UnityUITK`, `UnityAnimator`, `UnityShaderVFX`, `UnityArtAsset`, `UnityQA`, `UnityNativePlugin`
- **native-plugin** — Reports to: `Unity3DOrchestrator`; Implements from: native sub-project requests and orchestrator task briefs; Escalation targets: `Unity3DOrchestrator` for scope changes, blocked work, or approval; Siblings: `UnityImplementer`, `UnityScene`, `UnityUITK`, `UnityAnimator`, `UnityShaderVFX`, `UnityArtAsset`, `UnityQA`, `UnityTddSpecialist`

## Full Studio Hierarchy

Orchestrator: `full-studio-orchestrator`; subagents: 17.

### Agents

| Id | Name | Path | Tier | Model | Abilities | Gate |
|---|---|---|---|---|---|---|
| full-studio-orchestrator | FullStudioOrchestrator | `agent/full-studio/full-studio-orchestrator.md` | router |  | gather-unity-context, unity-read-project, project-status, coordination-board, gate-review |  |

### SubAgents

| Id | Name | Path | Tier | Model | Abilities | Gate |
|---|---|---|---|---|---|---|
| art-director | ArtDirector | `agent/full-studio/art-director.md` | lead |  | unity-read-project, asset-intelligence, project-status, contract-aware-design, gate-review |  |
| art-lead | ArtLead | `agent/full-studio/art-lead.md` | lead |  | unity-read-project, asset-intelligence, scene-editing, shader-helper, project-status |  |
| audio-specialist | AudioSpecialist | `agent/full-studio/audio-specialist.md` | specialist |  | asset-intelligence, script-scaffolding, code-navigation, compile-and-verify-project, unity-read-project |  |
| creative-director | CreativeDirector | `agent/full-studio/creative-director.md` | lead |  | gather-unity-context, unity-read-project, project-status, contract-aware-design, gate-review |  |
| game-designer | GameDesigner | `agent/full-studio/game-designer.md` | lead |  | unity-read-project, project-status, contract-aware-design, primitive-composition, code-navigation |  |
| gameplay-programmer | GameplayProgrammer | `agent/full-studio/gameplay-programmer.md` | specialist |  | script-scaffolding, input-automation, pattern-library, code-navigation, compile-and-verify-project, run-edit-mode-tests |  |
| lead-programmer | LeadProgrammer | `agent/full-studio/lead-programmer.md` | lead |  | unity-read-project, code-navigation, script-scaffolding, pattern-library, compile-and-verify-project, contract-aware-design, coordination-board |  |
| level-designer | LevelDesigner | `agent/full-studio/level-designer.md` | specialist |  | scene-editing, prefab-automation, asset-intelligence, project-status, primitive-composition |  |
| native-plugin | NativePlugin | `agent/full-studio/native-plugin.md` | specialist |  | script-scaffolding, code-navigation, compile-and-verify-project, unity-build, platform-info, unity-read-project |  |
| performance-analyst | PerformanceAnalyst | `agent/full-studio/performance-analyst.md` | specialist |  | performance-diagnostics, project-status, runtime-debugging, code-navigation, unity-build |  |
| producer | Producer | `agent/full-studio/producer.md` | lead |  | project-status, coordination-board, gather-unity-context, ci-status-baseline, gate-review |  |
| qa-lead | QaLead | `agent/full-studio/qa-lead.md` | lead |  | unity-run-tests, run-edit-mode-tests, run-play-mode-tests, compile-and-verify-project, gate-review, project-status |  |
| shader-specialist | ShaderSpecialist | `agent/full-studio/shader-specialist.md` | specialist |  | shader-helper, asset-intelligence, performance-diagnostics, code-navigation, compile-and-verify-project |  |
| tdd-specialist | TddSpecialist | `agent/full-studio/tdd-specialist.md` | specialist |  | unity-run-tests, run-edit-mode-tests, run-play-mode-tests, compile-and-verify-project, script-scaffolding, unity-change-loop |  |
| technical-artist | TechnicalArtist | `agent/full-studio/technical-artist.md` | specialist |  | shader-helper, asset-intelligence, prefab-automation, performance-diagnostics, scene-editing |  |
| technical-director | TechnicalDirector | `agent/full-studio/technical-director.md` | lead |  | unity-read-project, gather-unity-context, project-status, code-navigation, compile-and-verify-project, gate-review, ci-status-baseline |  |
| ui-programmer | UiProgrammer | `agent/full-studio/ui-programmer.md` | specialist |  | uitk-interaction, runtime-ui-validation, script-scaffolding, code-navigation, compile-and-verify-project |  |

### Delegation Maps

- **full-studio-orchestrator** — Reports to: the user (project owner); Implements from: studio requests, the Unity commands, and agreed scope decisions; Escalation targets: the user for scope, approval, or blocked work; a director for unresolved cross-domain conflict; Siblings: none — top of the Full Studio hierarchy
- **art-director** — Reports to: `FullStudioOrchestrator`; Implements from: orchestrator briefs and the creative pillars set by `CreativeDirector`; Escalation targets: `FullStudioOrchestrator` for scope or approval; `CreativeDirector` for visual-identity conflicts; Siblings: `CreativeDirector`, `TechnicalDirector`, `Producer`
- **art-lead** — Reports to: `ArtDirector`; Implements from: art-director style guides and asset specifications; Escalation targets: `ArtDirector` for visual-identity calls; `TechnicalDirector` for performance budgets; `Producer` for scope; Siblings: `GameDesigner`, `LeadProgrammer`, `QaLead`
- **audio-specialist** — Reports to: `ArtLead`; Implements from: `ArtDirector`/`ArtLead` sonic direction; Escalation targets: `ArtLead` for direction; `Producer` for scope; Siblings: `TechnicalArtist`, `ShaderSpecialist`
- **creative-director** — Reports to: `FullStudioOrchestrator`; Implements from: orchestrator briefs and the agreed creative pillars; Escalation targets: `FullStudioOrchestrator` for scope or approval; `TechnicalDirector` for creative decisions with technical consequences; Siblings: `TechnicalDirector`, `Producer`, `ArtDirector`
- **game-designer** — Reports to: `CreativeDirector`; Implements from: creative-director briefs and the agreed pillars; Escalation targets: `CreativeDirector` for design-intent conflicts; `Producer` for scope or schedule; `TechnicalDirector` for feasibility; Siblings: `LeadProgrammer`, `QaLead`, `ArtLead`
- **gameplay-programmer** — Reports to: `LeadProgrammer`; Implements from: `GameDesigner` specs and lead-programmer task briefs; Escalation targets: `LeadProgrammer` for structure or blocked work; `GameDesigner` for design intent; Siblings: `UiProgrammer`, `PerformanceAnalyst`, `NativePlugin`, `TddSpecialist`
- **lead-programmer** — Reports to: `TechnicalDirector`; Implements from: the technical-director's architecture and `GameDesigner` specs; Escalation targets: `TechnicalDirector` for architecture; `GameDesigner` for design intent; `Producer` for scope; Siblings: `GameDesigner`, `QaLead`, `ArtLead`
- **level-designer** — Reports to: `GameDesigner`; Implements from: `GameDesigner` level and encounter specs; Escalation targets: `GameDesigner` for design intent; `ArtLead` for environmental visuals; Siblings: `GameplayProgrammer`, `UiProgrammer`, `TechnicalArtist`, `TddSpecialist`
- **native-plugin** — Reports to: `LeadProgrammer`; Implements from: lead-programmer task briefs and native sub-project requirements; Escalation targets: `LeadProgrammer` for structure; `TechnicalDirector` for platform or ABI decisions; Siblings: `GameplayProgrammer`, `PerformanceAnalyst`, `UiProgrammer`
- **performance-analyst** — Reports to: `LeadProgrammer`; Implements from: `TechnicalDirector` budgets and lead-programmer task briefs; Escalation targets: `TechnicalDirector` for budget or strategy; `LeadProgrammer` for assignment; Siblings: `GameplayProgrammer`, `UiProgrammer`, `NativePlugin`, `TddSpecialist`
- **producer** — Reports to: `FullStudioOrchestrator`; Implements from: orchestrator briefs, milestone targets, and agreed scope; Escalation targets: `FullStudioOrchestrator` for scope or approval; `CreativeDirector` and `TechnicalDirector` when scope must be traded against vision or architecture; Siblings: `CreativeDirector`, `TechnicalDirector`, `ArtDirector`
- **qa-lead** — Reports to: `Producer` for delivery, with quality standards from `TechnicalDirector`; Implements from: producer sprint plans and the acceptance criteria on each story; Escalation targets: `Producer` for schedule; `TechnicalDirector` for quality standards; `LeadProgrammer` for testability; Siblings: `GameDesigner`, `LeadProgrammer`, `ArtLead`
- **shader-specialist** — Reports to: `ArtLead`; Implements from: `ArtDirector` visual direction and `TechnicalArtist` pipeline specs; Escalation targets: `ArtLead` for visual direction; `TechnicalDirector` for rendering architecture; Siblings: `TechnicalArtist`, `AudioSpecialist`
- **tdd-specialist** — Reports to: `LeadProgrammer`, with test-evidence standards from `QaLead`; Implements from: `GameDesigner` specs, `QaLead` test plans, and lead-programmer briefs; Escalation targets: `LeadProgrammer` for structure; `QaLead` for test strategy; Siblings: `GameplayProgrammer`, `UiProgrammer`, `PerformanceAnalyst`
- **technical-artist** — Reports to: `ArtLead`; Implements from: `ArtDirector`/`ArtLead` art bible and asset standards; Escalation targets: `ArtLead` for art standards; `TechnicalDirector` for pipeline or rendering architecture; Siblings: `ShaderSpecialist`, `AudioSpecialist`, `PerformanceAnalyst`
- **technical-director** — Reports to: `FullStudioOrchestrator`; Implements from: orchestrator briefs and the agreed architecture direction; Escalation targets: `FullStudioOrchestrator` for scope or approval; `CreativeDirector` when a technical trade-off changes the creative result; Siblings: `CreativeDirector`, `Producer`, `ArtDirector`
- **ui-programmer** — Reports to: `LeadProgrammer`; Implements from: `ArtLead` mockups, `ArtDirector` visual direction, and lead-programmer briefs; Escalation targets: `LeadProgrammer` for structure or blocked work; `ArtLead` for visual specs; Siblings: `GameplayProgrammer`, `PerformanceAnalyst`, `NativePlugin`, `TddSpecialist`
