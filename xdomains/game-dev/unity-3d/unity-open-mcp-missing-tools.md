# Unity-Open-MCP missing-tools ledger

Unity-Open-MCP exposes a full MCP toolset (250+ tools: asset intelligence, typed editor workflows,
diagnostics, gate/validation, CI baselines, offline reads). OAC deliberately refactors that surface
into **abilities** rather than mirroring every MCP tool, and reaches the live Editor through the
Unity CLI (built-in stdio MCP + pipeline), **not** a separate MCP server (ADR-0017). This ledger
records the tools we consciously did **not** implement, with the reason and a revisit note.

> Rule: this file is updated **in the same change** as any tool skip. A tool that is neither
> implemented as an ability nor listed here is a gap, not a decision.

## Covered by the five families

| Unity-Open-MCP area | OAC ability | Family |
| --- | --- | --- |
| Asset intelligence, offline reads | `asset-intelligence`, `offline-project-inspection`, `gather-unity-context` | sense |
| Typed editor workflows (scene/prefab/script) | `scene-editing`, `prefab-automation`, `script-scaffolding`, `shader-helper` | act |
| Gate / validation, compile + tests | `compile-and-verify-project`, `run-edit-mode-tests`, `run-play-mode-tests`, `gate-review` | verify |
| Diagnostics, logs, profiling, runtime UI | `unity-change-loop`, `runtime-debugging`, `runtime-ui-validation`, `performance-diagnostics`, `uitk-interaction` | run |
| CI baselines, coordination board, composition/contract checks | `ci-status-baseline`, `coordination-board`, `primitive-composition`, `contract-aware-design` | compose |

Representative upstream tools that map to a covered ability: `get_ui_tree` / `click_ui` →
`uitk-interaction`; `list_profiler_counters` / `sample_profiler_counters` / `get_frame_timing` /
`get_top_profiler_markers` / `get_profiler_call_tree` → `performance-diagnostics`; `scaffold_script` →
`script-scaffolding`; `lookup_api` → `unity-api-lookup`; `shader_helper` → `shader-helper`;
`platform_info` → `platform-info`; `whos_here` / `post_status` / `read_board` / `hold` / `release`
→ `coordination-board`.

## Deliberately not implemented

| Tool / area | Reason not implemented | Revisit |
| --- | --- | --- |
| In-editor MCP server as a channel | The AI-assistant MCP is deprecated; OAC uses the Unity CLI live channel (pipeline + built-in stdio MCP) and **never invokes bare `unity mcp`** (ADR-0017). | Only if the Unity CLI drops the pipeline surface. |
| The long tail of per-component typed setters (animator graphs, terrain, particles, timeline, lighting probes, …) | Not needed for the Phase 2 feature loop; a per-type setter mirror would be huge, brittle, and untestable. Mutations go through the Act escalation ladder instead. | Phase 3+, generated from the live `unity command` inventory. |
| `simulate_input` / virtual-device input simulation | `input-automation` covers asset/config changes; driving virtual devices needs the live runtime channel, which lands later. | Phase 4, once the live channel + approval gate are wired. |
| UAX macros / plugin registry (`IUaxMacro`, plugin metadata) | UAX-specific extension model, not an MCP tool; OAC composes abilities, not in-editor macros. | Only if OAC adopts an in-editor macro host. |
| General runtime code execution | Arbitrary Player code is unsafe. Only `runtime-debugging --operation execute-code` is allowed, behind the explicit approval gate (ADR-0018). No blanket eval surface. | Never broaden without a new ADR. |
| Raw AssetDatabase write / bulk import operations | Every mutation must run checkpoint → mutate → validate → delta (ADR-0015); raw asset-DB writes bypass the gate and the honesty rules. | Never; wrap the specific mutation instead. |
| Deep memory snapshot capture (`capture_memory_snapshot`) | `performance-diagnostics` reads counters/timing first; deep snapshots are large and rarely actionable in an agent loop. | Phase 4, if a profiling workflow needs it. |
| UI Toolkit authoring (UXML/USS generation) | `uitk-interaction` covers the runtime tree/click surface; authoring is design-time and belongs with scene/prefab automation. | Phase 3, alongside the snippet/template registry. |
| Test authoring / dedup tools | These are TDD *workflows*, not Unity tools; they belong to subagents and skills, not the MCP surface. | Phase 4 (agents & coordination). |
| CI orchestration / multi-project build farm | Out of scope: OAC is a solo-dev, single-project workflow. `ci-status-baseline` only records the last known status. | Only if OAC grows a hosted CI integration. |
