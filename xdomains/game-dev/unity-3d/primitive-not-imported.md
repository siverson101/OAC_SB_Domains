# Primitive not-imported ledger

Source: the external `unity-skills` primitive registry (559 primitives at import time).
Import target: `xdomains/game-dev/unity-3d/primitives/`.
Gate: `tools/unity/primitives/src/license-gate.ts` — only `MIT`, `Apache-2.0`, `BSD-3-Clause` and
`Unlicense` are importable; `GPL-3.0`/`LGPL-3.0` (and the wider copyleft family) and any missing or
unrecognised license are skipped. A primitive is only imported when its `primitive.yaml` satisfies
`unity-skills/schema/primitive_schema.yaml` and every declared `code_files` path exists.

**Imported: 12. Skipped: 547** (of 559 source primitives).

## Imported

| id | license | source_repo |
|---|---|---|
| `arch.movement.2d` | Apache-2.0 | https://github.com/genaray/Arch |
| `csharp.collections.multidictionary` | MIT | https://github.com/Alex-Rachel/TEngine |
| `csharp.gameplay.match3` | MIT | https://github.com/LibraStack/Match3-SDK |
| `csharp.io.aseprite_parser` | MIT | https://github.com/WeAthFoLD/MetaSprite |
| `csharp.math.dywa_pitch_tracker` | MIT | https://github.com/UltraStar-Deluxe/Play |
| `csharp.threading.disruptor` | Apache-2.0 | https://github.com/dave-hillier/disruptor-unity3d |
| `csharp.utils.crc32` | MIT | https://github.com/YarnSpinnerTool/YarnSpinner |
| `unity.data.csv_parser` | MIT | https://github.com/CragonGame/CasinosClient |
| `unity.data.fastlz` | MIT | https://github.com/ikpil/DotFastLZ |
| `unity.entitas.coreloop` | MIT | https://github.com/sschmid/Entitas |
| `unity.system.main_thread_dispatcher` | Apache-2.0 | https://github.com/PimDeWitte/UnityMainThreadDispatcher |
| `unity.system.object_pool` | Apache-2.0 | https://github.com/yimengfan/BDFramework.Core |

## Skipped — copyleft (gated out)

Rejected by the gate; never copied. Revisit only if the upstream license changes or a clean-room
reimplementation is authored.

| id | license | source_repo |
|---|---|---|
| `unity.input.mouserotate` | GPL-3.0 | https://github.com/imengyu/Ballance |
| `unity.rendering.npr.starrail` | GPL-3.0 | https://github.com/stalomeow/StarRailNPRShader |
| `unity.rendering.toon.primotoon` | GPL-3.0 | https://github.com/festivities/PrimoToon |
| `unity.simulation.aerodynamics_solver` | GPL-3.0 | https://github.com/ertanturan/Unity-Helicopter-Physics |
| `unity.system.kengine_logger` | LGPL-3.0 | https://github.com/mr-kelly/KEngine |

> Note: the ticket and implementation notes cite "6 GPL-3.0 + 2 LGPL-3.0". The attributed table in
> `PROVENANCE.md` actually records 4 GPL-3.0 + 1 LGPL-3.0; the per-primitive `license:` fields record
> 3 GPL-3.0 + 1 LGPL-3.0 (`unity.rendering.npr.starrail` carries GPL-3.0 only in PROVENANCE). The gate
> rejects the union, listed above.

## Skipped — attributed but license unclear

Origin identified, but the upstream repo has no SPDX license, a custom/asset license, or no public
repo. Revisit only if the upstream project adopts an SPDX license.

- `unity.et.aoi` — egametang/ET — custom "ET License" (learning-only; paid commercial)
- `unity.et.numeric` — egametang/ET — custom "ET License"
- `csharp.concurrent.et_task_async` — egametang/ET — custom "ET License"
- `unity.timeline.lightcontrol` — UnityTechnologies/ATerribleKingdom — repo has no license
- `unity.timeline.navmeshagentcontrol` — UnityTechnologies/ATerribleKingdom — repo has no license
- `unity.timeline.screenfader` — UnityTechnologies/ATerribleKingdom — repo has no license
- `unity.timeline.timedilation` — UnityTechnologies/ATerribleKingdom — repo has no license
- `unity.timeline.timemachine` — UnityTechnologies/ATerribleKingdom — repo has no license
- `unity.timeline.tmptextswitcher` — UnityTechnologies/ATerribleKingdom — repo has no license
- `unity.timeline.transformtween` — UnityTechnologies/ATerribleKingdom — repo has no license
- `unity.match3.basic` — dgkanatsios/MatchThreeGame — repo has no license
- `unity.networking.nakama_connection` — heroiclabs/fishgame-unity — NOASSERTION ("Other")
- `unity.ui.infinite_scroll` — nhn/gpm.unity — NOASSERTION (custom NHN/MPL terms)
- `unity.shader.dissolve.gpm` — nhn/gpm.unity — NOASSERTION
- `unity.shader.spriteanimation.gpm` — nhn/gpm.unity — NOASSERTION
- `unity.system.update_timer` — kidagine/Darklings-FightingGame — repo has no license
- `unity.dots.vehicle.movement` — Unity Megacity-Metro — Unity Companion License (not SPDX)
- `csharp.algorithms.math_aabb_burst` — MagicaCloth2 — closed-source paid Unity asset
- `csharp.algorithms.math_utility_burst` — MagicaCloth2 — closed-source paid Unity asset
- `unity.rendering.postprocessing.simplelut` — DigitalRuby SimpleLUT — asset-store code, no canonical repo

## Skipped — attributed and license-clear, not in this sample

Importable but outside the representative sample imported for Step 3.3. Revisit per category as the
domain needs it (no license obstacle).

- `csharp.algorithms.dijkstra_rail_graph` — Apache-2.0
- `csharp.algorithms.wu_color_quantizer` — MIT
- `csharp.architecture.integration.arch_eventbus` — Apache-2.0
- `csharp.architecture.integration.ui.declarative_component` — Apache-2.0
- `csharp.architecture.reflection_command_shell` — MIT
- `csharp.architecture.simple_localization` — MIT
- `csharp.collections.unsafe_collections` — Apache-2.0
- `csharp.concurrent.coroutine_lock` — Apache-2.0
- `csharp.concurrent.disruptor_ring_buffer` — Apache-2.0
- `csharp.concurrent.lite_multithread_download` — Apache-2.0
- `csharp.concurrent.simpleweb_buffer_pool` — MIT
- `csharp.core.bytebuf` — MIT
- `csharp.io.stream_buffer_writer` — Apache-2.0
- `csharp.match3.grid_core` — MIT
- `csharp.math.bezier` — MIT
- `csharp.math.camd_pitch_tracker` — MIT
- `csharp.math.isometric` — MIT
- `csharp.networking.noahgameframe_messages` — Apache-2.0
- `csharp.serialization.bytebuf` — MIT
- `csharp.spatial.wu_raycast_grid` — Apache-2.0
- `csharp.system.fantasy.thread_local_pool` — MIT
- `csharp.utils.generic_dictionary` — MIT
- `csharp.utils.obj_export` — MIT
- `csharp.utils.ranged_fields` — MIT
- `luban.serialization.bytebuf` — MIT
- `unity.ai.behaviac.fsm_agent` — BSD-3-Clause (not imported: its `code_files` holds an absolute author path `c:/Users/prave/.../BehaviacFSMAgent.cs` instead of the relative `BehaviacFSMAgent.cs`; revisit after upstream path normalisation)
- `unity.camera.dynamic_splitscreen` — MIT
- `unity.coroutines.utils` — MIT
- `unity.events.scriptable_object_channels` — MIT
- `unity.mechanics.magnetic_pickup` — MIT
- `unity.networking.lmtdownload` — Apache-2.0
- `unity.networking.mirage.tank` — MIT
- `unity.particle.auto_destroy` — MIT
- `unity.rendering.texturepanner` — MIT
- `unity.steamworks.facepunch.manager` — MIT
- `unity.system.bundle_master_runtime` — Apache-2.0
- `unity.system.et_coroutine_lock` — Apache-2.0
- `unity.system.ettask_timer_await` — Apache-2.0
- `unity.system.f8framework_singleton` — MIT
- `unity.system.generic_object_pool` — MIT
- `unity.system.scriptable_inventory` — MIT
- `unity.system.tengine_timer` — MIT
- `unity.ui.speedrun_timer` — MIT
- `unity.utils.mainthread_dispatcher` — Apache-2.0
- `yarnspinner.dialogue.core` — MIT

## Skipped — unattributed, likely-origin guesses (unverified)

A single source could not be confirmed, so no attribution could be recorded. Revisit by diffing
against the original archives / candidate upstream repos.

- `unity.hotfix.ilruntime_coroutine_adapter`
- `unity.hotfix.ilruntime_monobehaviour_adapter`
- `unity.physics.arcade_helicopter`
- `unity.transforms.heli_rotor_controller`
- `csharp.algorithms.blelloch_scan`
- `csharp.networking.endian_binary_io`
- `csharp.networking.endian_bit_converter`
- `unity.audio.pitch_shifter_utils`
- `unity.audio.volume_unit_utils`
- `unity.audio.fader`
- `csharp.algorithms.concave_hull`
- `csharp.snapshot_interpolation`
- `unity.math.orthographic_fitter`
- `unity.camera.follower`
- `unity.rendering.ui_blur`
- `unity.utils.easing_functions`
- `hlsl.texture.bicubic_sampling`
- `unity.ecs.* (family)`
- `unity.dots.camera.follow.orbit`

## Skipped — unattributed, no usable signal (aggregated)

~145 extracted primitives had their namespaces rewritten to `UnityEncyclopedia.*` /
`Core.*` / `Primitives.*` / `IntegrationFramework.*` / `Agents.*` / `Architecture.*` during
extraction and retain no headers or distinctive names that map to a single ingested archive.
Attributing them would require a file-by-file diff against the original archives. Clusters:

- `csharp.algorithms.*`, `csharp.collections.*`, `csharp.utils.*` — generic data structures/utilities (highest ambiguity)
- `unity.camera.*` — a dozen small controllers, most rewritten
- `unity.editor.*` — 10 editor tools, all rewritten to `UnityEncyclopedia.Primitives.EditorTools`
- `unity.ui.*` — most rewritten (only `infinite_scroll` / `speedrun_timer` had signals)
- `csharp.architecture.integration.*` — "IntegrationFramework" namespaces, origin framework unknown

Revisit only with the source archives available for a diff.

## Skipped — extracted with no recorded license (aggregated)

~224 extracted primitives carry no `license:` field and no PROVENANCE row, so the
gate skips them as `no license recorded` rather than assuming permissive. This is the superset of the
attributed-but-unclear list, the unverified guesses, and the no-signal cluster above:

- 20 attributed-but-license-unclear (listed above)
- 17 unverified guesses (listed above)
- ~145 PROVENANCE no-signal cluster
- ~42 further extracted primitives with no PROVENANCE entry

Revisit by re-establishing provenance per cluster (diff against the original archives).

## Skipped — authored primitives (aggregated)

~274 primitives are `status: authored` — written for the source registry rather than lifted
from a project, so they carry no upstream attribution obligation. They are out of scope for the
extraction-license gate; revisit only if a specific one is requested and its authorship can be confirmed.

