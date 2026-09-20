<!-- Context: unity-3d/lookup/performance-budgets | Priority: medium | Version: 1.0 | Updated: 2026-09-07 -->

# Performance Budgets (Unity 3D)

Reference targets for PC-first Unity 3D solo projects. Adjust per project.

## Frame Budget
- **Target**: 60 FPS → 16.6 ms/frame total.
- **Script (Update)**: ~4 ms · **Physics**: ~4 ms · **Render**: ~7 ms · **Remainder**: safety.
- Profile with Unity Profiler; capture traces before/after changes.

## Rendering
- Draw calls: keep under ~500 (URP SRP batcher on).
- Triangles: manage LODs — enable at 30–50% screen height, fallback LOD under 15%.
- Textures: respect import size limits; use Texture Compression + mipmaps.
- Materials: share materials; avoid per-frame material property changes.

## Memory
- Allocations in hot paths (per frame) = zero.
- No `GetComponent` per frame, no `new` in `Update`, no LINQ in tight loops.
- Object pooling for frequent spawns.

## Physics
- Prefer few, large colliders over many small ones.
- Use continuous collision only where needed.
- Limit active Rigidbodies; sleep static ones.

## Reference Metrics to Collect
1. FPS / frame ms (Profiler)
2. Draw calls + triangles (Frame Debugger / Stats)
3. Allocated B/frame (Profiler Memory)
4. Physics active bodies count
