# Primitive not-imported ledger

Source: the external `unity-skills` primitive registry (559 primitives in the local snapshot).
Import target: `xdomains/game-dev/unity-3d/primitives/`.
Gate: `tools/unity/primitives/src/license-gate.ts` — only `MIT`, `Apache-2.0`, `BSD-3-Clause` and
`Unlicense` are importable; `GPL-3.0`/`LGPL-3.0` (and the wider copyleft family) and any missing or
unrecognised license are skipped. A primitive is only imported when its `primitive.yaml` satisfies
`unity-skills/schema/primitive_schema.yaml` and every declared `code_files` path exists.

**Imported: 12. Skipped: 547** (of 559 source primitives).

Every skipped id is enumerated below under its reason (Phase 3 Step 3.3 requires a reason + revisit
note per primitive). The lists are disjoint and cover the full skipped set.

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
> 3 GPL-3.0 + 1 LGPL-3.0 (`unity.rendering.npr.starrail` carries GPL-3.0 only in PROVENANCE and is not
> in the local snapshot). The gate rejects the union, listed above.

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

## Skipped — attributed and license-clear, not imported

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
- `unity.ai.behaviac.fsm_agent` — BSD-3-Clause
- `unity.camera.dynamic_splitscreen` — MIT
- `unity.character.goldplayer` — MIT
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

## Skipped — unattributed, no usable signal

187 extracted primitives had their namespaces rewritten to
`UnityEncyclopedia.*` / `Core.*` / `Primitives.*` / `IntegrationFramework.*` / `Agents.*` /
`Architecture.*` during extraction and retain no headers or distinctive names that map to a single
ingested archive. Attributing them would require a file-by-file diff against the original archives.
Revisit only with the source archives available for a diff.

- `csharp.algorithms.closest_point_on_triangle`
- `csharp.algorithms.cubic_bezier`
- `csharp.algorithms.hashing`
- `csharp.algorithms.lazy_theta_star`
- `csharp.algorithms.math3d`
- `csharp.algorithms.perspective_pathfinding`
- `csharp.algorithms.pid_controller`
- `csharp.algorithms.procedural_generation_jobs`
- `csharp.algorithms.quad_strip_builder`
- `csharp.algorithms.shelf_atlas_packer`
- `csharp.algorithms.shuffle`
- `csharp.algorithms.velocity_tracker`
- `csharp.algorithms.zero_alloc_dfs`
- `csharp.architecture.ai.astar_zero_alloc`
- `csharp.architecture.atom`
- `csharp.architecture.command_service`
- `csharp.architecture.datastruct.priority_queue`
- `csharp.architecture.fsm`
- `csharp.architecture.integration.assets.headless_refcounter`
- `csharp.architecture.integration.assets.headless_registry`
- `csharp.architecture.integration.events.unmanaged_ecs`
- `csharp.architecture.integration.events.unmanaged_ringbuffer`
- `csharp.architecture.integration.input.bitmask_state`
- `csharp.architecture.integration.input.native_touch`
- `csharp.architecture.integration.input.struct_polling`
- `csharp.architecture.integration.input.unmanaged_poller`
- `csharp.architecture.integration.rendering.instanced_indirect`
- `csharp.architecture.integration.ui.fluent_builder`
- `csharp.architecture.lifetime`
- `csharp.architecture.saliency`
- `csharp.architecture.signalsystem`
- `csharp.collections.expiry_cache`
- `csharp.collections.functional_monads`
- `csharp.collections.messagelist`
- `csharp.collections.native_spatial_grid`
- `csharp.collections.o1_struct_pool`
- `csharp.collections.pooled_linked_list`
- `csharp.collections.priority_queue`
- `csharp.collections.ring_buffer`
- `csharp.collections.zero_alloc_multidictionary`
- `csharp.collections.zero_allocation_linq`
- `csharp.concurrent.thread_dispatcher`
- `csharp.cryptography.chacha20`
- `csharp.cryptography.tea`
- `csharp.cryptography.xor_stream`
- `csharp.data.chunked_circular_stream`
- `csharp.geometry.mesh_extensions`
- `csharp.geometry.polygon_convex_checker`
- `csharp.geometry.triangulation`
- `csharp.io.ini_parser`
- `csharp.logic.rate_limit_bucket`
- `csharp.math.bezier_path`
- `csharp.math.deterministicrandom`
- `csharp.math.sequencer`
- `csharp.math.smoothing`
- `csharp.networking.bitpacking`
- `csharp.networking.snapshot_interpolation`
- `csharp.serialization.binary_parser`
- `csharp.spatial.error_diffusion_smoother`
- `csharp.spatial.hash_grid`
- `csharp.spatial.marching_squares`
- `csharp.system.numeric_attributes`
- `csharp.system.stable_hash`
- `csharp.timers.tickabletimer`
- `csharp.utils.command_line_builder`
- `csharp.utils.downloadspeed`
- `csharp.utils.iniparser`
- `csharp.utils.text_normalizer`
- `hlsl.color.color_space_conversions`
- `unity.algorithms.texture_packer`
- `unity.architecture.scriptableobject_anchor`
- `unity.architecture.scriptableobject_pool`
- `unity.audio.wav_loader`
- `unity.camera.2d.pixelperfect`
- `unity.camera.2d_shake_move`
- `unity.camera.aspect_ratio_resizing`
- `unity.camera.drag_pan_2d`
- `unity.camera.flat_follow`
- `unity.camera.follow.basic`
- `unity.camera.freecam`
- `unity.camera.mouselook`
- `unity.camera.parallax_scrolling_2d`
- `unity.camera.pinch_to_zoom`
- `unity.camera.rig`
- `unity.camera.smooth_look_at`
- `unity.camera.strategicrts`
- `unity.camera.strategy_orthographic`
- `unity.camera.ui_orbit_control`
- `unity.character.attributes`
- `unity.character.bone_modifier`
- `unity.character.bones_control`
- `unity.data.cyclic_buffer`
- `unity.data.fast_priority_queue`
- `unity.data.obj_importer`
- `unity.debug.context_visualizer`
- `unity.debug.in_game_console`
- `unity.debug.legacy_fps_counter`
- `unity.ecs.lifecycle_transform_animation`
- `unity.ecs.lifetime_fade`
- `unity.ecs.linear_movement`
- `unity.ecs.timetolive`
- `unity.editor.add_namespace`
- `unity.editor.asset_batch_processor`
- `unity.editor.average_normals_to_tangents`
- `unity.editor.batch_asset_selector`
- `unity.editor.batch_rename`
- `unity.editor.hierarchy_icon_drawer`
- `unity.editor.min_max_slider`
- `unity.editor.page_painter`
- `unity.editor.readonly_attribute`
- `unity.editor.spritesheet_transfer`
- `unity.environment.daynight_cycler`
- `unity.events.periodic_event_trigger`
- `unity.events.scriptableobject.void`
- `unity.gameplay.rts_unit_controller`
- `unity.input.key_listener`
- `unity.io.bit_reader`
- `unity.match3.grid`
- `unity.math.bezier`
- `unity.math.collision3d`
- `unity.math.direction`
- `unity.math.fixed_point`
- `unity.math.geometry.intersections`
- `unity.math.hsbcolor`
- `unity.math.iq_gradient`
- `unity.math.weighted_random`
- `unity.mechanics.arcade_vehicle_physics_2d`
- `unity.mechanics.drag_to_shoot_2d`
- `unity.mechanics.homing_missile_2d`
- `unity.movement.2d.move_in_direction`
- `unity.movement.runner.sideways`
- `unity.networking.verification_decryption`
- `unity.patterns.entity_link`
- `unity.physics.fracturable_voxel`
- `unity.physics.kinematic_auto_scroller_2d`
- `unity.physics.proximity_trigger_tracker`
- `unity.physics.spherical_gravity`
- `unity.physics.velocity_damage_2d`
- `unity.physics.vertical_impulse_controller_2d`
- `unity.physics.zero_g_flight`
- `unity.rendering.clustered_srp`
- `unity.rendering.culling_expansion`
- `unity.rendering.instanced_property_setter`
- `unity.rendering.makeup_blitter`
- `unity.rendering.material_highlighter`
- `unity.rendering.material_utils`
- `unity.rendering.runtime_preview_generator`
- `unity.resource.sprite_manager`
- `unity.serialization.newtonsoft_converters`
- `unity.shader.fx_levelup`
- `unity.simulation.demographic_controller`
- `unity.system.deterministic_update`
- `unity.system.headless_frame_limiter`
- `unity.system.pool_manager`
- `unity.system.reference_pool`
- `unity.system.sequence_manager`
- `unity.system.servicelocator`
- `unity.system.sparse_event_bus`
- `unity.system.sprite_animator`
- `unity.system.update_manager`
- `unity.system.yieldcacher`
- `unity.transforms.random_position_offset`
- `unity.tween.oscillator`
- `unity.ui.clicks_counter`
- `unity.ui.data_table_layout_group`
- `unity.ui.exponential_slider`
- `unity.ui.fpscounter`
- `unity.ui.imgui_utils`
- `unity.ui.joystick`
- `unity.ui.mesh_gradient`
- `unity.ui.non_drawing_graphic`
- `unity.ui.optimized_healthbar`
- `unity.ui.rect_transform_size`
- `unity.ui.screen_navigation`
- `unity.ui.shader_driven_button`
- `unity.ui.software_cursor`
- `unity.ui.ui_animation_set`
- `unity.ui.visualnovel`
- `unity.ui.world_to_screen_follower`
- `unity.utils.extension_methods`
- `unity.utils.followobject`
- `unity.utils.object_state_backup`
- `unity.utils.timed_object_destruction`
- `unity.utils.transform_recorder`
- `unity.utils.trigger_destroyer_2d`
- `unity.vfx.parallax_scroller`
- `unity.vfx.surface_dust_effect`

## Skipped — authored primitives

274 primitives are `status: authored` — written for the source registry rather
than lifted from a project, so they carry no upstream attribution obligation. They are out of scope for
the extraction-license gate; revisit only if a specific one is requested and its authorship can be
confirmed.

- `csharp.ik.ccd_chain`
- `csharp.ik.fabrik_chain`
- `csharp.ik.two_bone_solver`
- `csharp.netcode.client_prediction`
- `csharp.netcode.clock_sync`
- `csharp.netcode.delta_quantizer`
- `csharp.netcode.entity_interpolation`
- `csharp.netcode.interest_grid`
- `csharp.netcode.lag_compensation`
- `csharp.netcode.lan_discovery`
- `csharp.netcode.message_registry`
- `csharp.netcode.reliability_layer`
- `csharp.netcode.rpc_router`
- `csharp.netcode.udp_transport`
- `unity.ai.behavior_tree`
- `unity.ai.blackboard`
- `unity.ai.boids_flocking`
- `unity.ai.cover_system`
- `unity.ai.director_pacing`
- `unity.ai.formation_slots`
- `unity.ai.goap_planner`
- `unity.ai.hearing_noise_emitters`
- `unity.ai.influence_map`
- `unity.ai.navmesh_brain`
- `unity.ai.patrol_routes`
- `unity.ai.perception`
- `unity.ai.squad_coordinator`
- `unity.ai.steering`
- `unity.ai.utility_scorer`
- `unity.animation.animator_event_relay`
- `unity.animation.blendtree_locomotion`
- `unity.animation.procedural_bob_sway`
- `unity.animation.ragdoll_switch`
- `unity.animation.root_motion_redirector`
- `unity.animation.simple_lookat_ik`
- `unity.animation.sprite_flipbook_lite`
- `unity.audio.ambient_zone`
- `unity.audio.audio_manager`
- `unity.audio.footstep_surfaces`
- `unity.audio.music_playlist`
- `unity.audio.rhythm_conductor`
- `unity.audio.sound_bank`
- `unity.audio.ui_sound_binder`
- `unity.camera.camera_zones`
- `unity.camera.look_ahead_2d`
- `unity.camera.third_person_orbit`
- `unity.camera.trauma_shake`
- `unity.cards.card_definition`
- `unity.cards.deck_piles`
- `unity.cards.encounter_loop`
- `unity.cards.energy_system`
- `unity.cards.hand_fan_ui`
- `unity.cards.targeting_arrow`
- `unity.character.blendshape_kit`
- `unity.character.character_creator_ui`
- `unity.character.color_palette`
- `unity.character.outfit_sets`
- `unity.character.part_swapper`
- `unity.combat.damage_numbers`
- `unity.combat.destructible`
- `unity.combat.health`
- `unity.combat.hitscan_weapon`
- `unity.combat.knockback_receiver`
- `unity.combat.lock_on_targeting`
- `unity.combat.melee_hitbox`
- `unity.combat.projectile`
- `unity.combat.status_effects`
- `unity.combat.team_affiliation`
- `unity.devtools.cheat_console`
- `unity.devtools.cheat_menu`
- `unity.devtools.debug_draw`
- `unity.devtools.editor_utilities`
- `unity.devtools.error_reporter`
- `unity.devtools.scene_bootstrap`
- `unity.dialogue.bark_system`
- `unity.dialogue.branching`
- `unity.dialogue.dialogue_ui`
- `unity.dialogue.speech_bubbles`
- `unity.environment.weather_states`
- `unity.feel.hitstop`
- `unity.feel.squash_stretch`
- `unity.gameplay.checkpoint_respawn`
- `unity.gameplay.cooldown_abilities`
- `unity.gameplay.crafting_recipes`
- `unity.gameplay.currency_wallet`
- `unity.gameplay.game_state`
- `unity.gameplay.objective_timer`
- `unity.gameplay.quest_system`
- `unity.gameplay.shop_vendor`
- `unity.gameplay.wave_spawner`
- `unity.gameplay.xp_leveling`
- `unity.grid.grid_pathfinding`
- `unity.grid.hex_grid`
- `unity.grid.placement_system`
- `unity.grid.rts_selection`
- `unity.grid.tile_highlighter`
- `unity.grid.turn_manager`
- `unity.ik.aim_spine`
- `unity.ik.arm_reach`
- `unity.ik.foot_grounding`
- `unity.ik.look_at_chain`
- `unity.ik.procedural_stepper`
- `unity.input.cursor_manager`
- `unity.input.input_buffer`
- `unity.input.konami_sequence`
- `unity.input.rebindable_actions`
- `unity.input.touch_gestures`
- `unity.input.virtual_button`
- `unity.interaction.door`
- `unity.interaction.elevator_platform`
- `unity.interaction.highlight_prompt`
- `unity.interaction.interactor`
- `unity.interaction.lever_switch`
- `unity.interaction.lock_key`
- `unity.interaction.pressure_plate`
- `unity.interaction.pushable_block`
- `unity.inventory.basic`
- `unity.inventory.consumables`
- `unity.inventory.container_transfer`
- `unity.inventory.equipment_slots`
- `unity.inventory.hotbar`
- `unity.inventory.item_affixes`
- `unity.inventory.item_database`
- `unity.inventory.world_item`
- `unity.meta.achievements`
- `unity.meta.daily_rewards`
- `unity.meta.photo_mode`
- `unity.meta.statistics`
- `unity.meta.tutorial_steps`
- `unity.minigames.fishing`
- `unity.minigames.lockpicking`
- `unity.minigames.qte_system`
- `unity.movement.dash_ability`
- `unity.movement.first_person`
- `unity.movement.grappling_hook`
- `unity.movement.grid_step_mover`
- `unity.movement.ladder_climb`
- `unity.movement.moving_platform`
- `unity.movement.patrol_waypoints`
- `unity.movement.platformer_2d`
- `unity.movement.third_person`
- `unity.movement.topdown_2d`
- `unity.narrative.camera_shots`
- `unity.narrative.cutscene_sequencer`
- `unity.narrative.story_flags`
- `unity.narrative.subtitles`
- `unity.netcode.network_runner`
- `unity.netcode.transform_sync`
- `unity.perf.distance_lod`
- `unity.perf.frame_budget`
- `unity.perf.gpu_instancing_renderer`
- `unity.perf.prefab_pool`
- `unity.perf.profiler_hud`
- `unity.perf.tick_scheduler`
- `unity.persistence.autosave`
- `unity.persistence.binary_save`
- `unity.persistence.json_save`
- `unity.persistence.persistent_id`
- `unity.persistence.save_migrations`
- `unity.persistence.save_slots_meta`
- `unity.persistence.typed_prefs`
- `unity.physics.buoyancy`
- `unity.physicstoys.attractor_field`
- `unity.physicstoys.breakable_joint_chain`
- `unity.physicstoys.conveyor_belt`
- `unity.physicstoys.jiggle_bones`
- `unity.physicstoys.verlet_cloth`
- `unity.physicstoys.verlet_rope`
- `unity.platformer.collectibles`
- `unity.platformer.crumbling_hazards`
- `unity.platformer.ledge_grab`
- `unity.platformer.moving_platforms`
- `unity.platformer.one_way_platforms`
- `unity.platformer.springs_boosters`
- `unity.platformer.wall_mechanics`
- `unity.postfx.bloom_lite`
- `unity.postfx.chromatic_aberration`
- `unity.postfx.color_grade`
- `unity.postfx.depth_outline`
- `unity.postfx.effect_stack`
- `unity.postfx.retro_pixelate`
- `unity.postfx.shockwave_distortion`
- `unity.postfx.vignette`
- `unity.procgen.cellular_caves`
- `unity.procgen.dungeon_rooms`
- `unity.procgen.maze_generator`
- `unity.procgen.noise_terrain`
- `unity.procgen.poisson_scatter`
- `unity.procgen.weighted_loot_table`
- `unity.scenes.additive_streaming`
- `unity.scenes.loading_screen`
- `unity.scenes.scene_flow`
- `unity.shader.billboard_sprite`
- `unity.shader.dissolve_basic`
- `unity.shader.scan_pulse`
- `unity.shader.screen_transition`
- `unity.shader.sprite_outline`
- `unity.shader.stylized_water`
- `unity.shader.vertex_wind_sway`
- `unity.sim.build_snapping`
- `unity.sim.crop_growth`
- `unity.sim.game_clock`
- `unity.sim.needs_stats`
- `unity.sim.npc_schedule`
- `unity.sim.resource_node`
- `unity.stealth.alarm_network`
- `unity.stealth.distraction_lure`
- `unity.stealth.hiding_spots`
- `unity.stealth.visibility_meter`
- `unity.td.creep`
- `unity.td.creep_path`
- `unity.td.td_game_loop`
- `unity.td.tower_attacks`
- `unity.td.tower_base`
- `unity.td.tower_upgrades`
- `unity.terrain.biome_map`
- `unity.terrain.splatmap_painter`
- `unity.terrain.spline_path`
- `unity.terrain.terrain_stamps`
- `unity.terrain.tile_streaming`
- `unity.terrain.vegetation_instancer`
- `unity.tween.mini_tween`
- `unity.tween.transform_shaker`
- `unity.ui.compass_bar`
- `unity.ui.confirm_dialog`
- `unity.ui.crosshair_kit`
- `unity.ui.damage_direction`
- `unity.ui.dialogue_typewriter`
- `unity.ui.drag_drop_slots`
- `unity.ui.hud_bars`
- `unity.ui.inventory_grid`
- `unity.ui.menu_stack`
- `unity.ui.minimap`
- `unity.ui.quest_tracker_hud`
- `unity.ui.radial_menu`
- `unity.ui.settings_menu`
- `unity.ui.skill_tree`
- `unity.ui.toast_notifications`
- `unity.ui.tooltip_system`
- `unity.ui.world_markers`
- `unity.vehicle.aircraft_controller`
- `unity.vehicle.arcade_car`
- `unity.vehicle.boat_controller`
- `unity.vehicle.hover_vehicle`
- `unity.vehicle.tank_tracks`
- `unity.vehicle.vehicle_damage`
- `unity.vehicle.wheelcollider_car`
- `unity.vfx.afterimage_trail`
- `unity.vfx.decal_projector_lite`
- `unity.vfx.impact_effects`
- `unity.vfx.laser_beam`
- `unity.vfx.lightning_bolt`
- `unity.vfx.material_flash`
- `unity.vfx.ribbon_trails`
- `unity.vfx.spawn_despawn_fx`
- `unity.vfx.weather_particles`
- `unity.voxel.chunk_streaming`
- `unity.voxel.chunk_terrain`
- `unity.voxel.greedy_mesher`
- `unity.voxel.marching_cubes`
- `unity.voxel.terrain_editing`
- `unity.water.gerstner_waves`
- `unity.water.ocean_surface`
- `unity.water.river_flow`
- `unity.water.splash_ripples`
- `unity.water.swim_controller`
- `unity.water.underwater_fx`
- `unity.water.water_volume`
- `unity.xr.grab_interactable`
- `unity.xr.hand_pose_driver`
- `unity.xr.player_rig`
- `unity.xr.snap_socket`
- `unity.xr.teleport_locomotion`
- `unity.xr.world_space_ui`

