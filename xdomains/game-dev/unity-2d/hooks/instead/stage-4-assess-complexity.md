---
description: "Unity 2D complexity, rendering, and test methodology decisions"
requires: [selected_subdomain]
---

# Stage 4 — Unity 2D complexity and project decisions

Replaces the built-in complexity questions for the `unity-2d` sub-domain.

Ask:

1. Estimated number of specialist subagents (the shipped `unity-2d` set has 7).
2. Which 2D systems are in play: Rigidbody2D physics, Tilemaps, sprite animation, URP 2D renderer,
   pixel-perfect rendering, 2D lighting.
3. **Test methodology**: TDD, BDD, ATDD, or None. Default to TDD when unsure.
4. **Runtime UI**: UGUI, UI Toolkit, or Mixed.
5. **Editor UI**: UGUI, UI Toolkit, or Mixed.
6. Target platform(s): PC (default), mobile, console, web.

## Capture

- `estimated_agent_count`
- `systems_in_play[]`
- `test_methodology`
- `runtime_ui`, `editor_ui`
- `target_platforms[]`

These decisions are written into context during Stage 7.
