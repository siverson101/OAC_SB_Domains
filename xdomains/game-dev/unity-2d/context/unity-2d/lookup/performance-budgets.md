<!-- Context: unity-2d/lookup/performance-budgets | Priority: medium | Version: 1.0 | Updated: 2026-09-17 -->

# Performance Budgets (Unity 2D)

Reference targets for PC-first Unity 2D solo projects. Adjust per project.

## Frame Budget
- **Target**: 60 FPS → 16.6 ms/frame total.
- **Script (Update)**: ~4 ms · **Physics 2D**: ~3 ms · **Render**: ~7 ms · **Remainder**: safety.
- Profile with the Unity Profiler; capture traces before/after changes.

## Rendering
- Draw calls: batch sprites (Sprite Atlas / SRP Batcher); keep well under ~500.
- Fill rate dominates in 2D — avoid full-screen overdraw and large transparent sprites.
- Textures: Sprite Atlas with tight packing; disable mipmaps and use Point filter for pixel art.
- Materials: share materials; avoid per-frame material property changes.

## Memory
- Zero allocations in hot paths (per frame).
- No `GetComponent` per frame, no `new` in `Update`, no LINQ in tight loops.
- Object pooling for frequently spawned sprites/effects (bullets, particles).

## Physics 2D
- Prefer primitive colliders (Box/Circle) over PolygonCollider2D.
- Use the layer collision matrix and Physics2D contact filters to avoid unnecessary pairs.
- Sleep idle Rigidbody2D bodies; use static colliders for level geometry.

## Reference Metrics to Collect
1. FPS / frame ms (Profiler)
2. Draw calls + sprite batches (Frame Debugger / Stats)
3. Allocated B/frame (Profiler Memory)
4. Active Rigidbody2D count
