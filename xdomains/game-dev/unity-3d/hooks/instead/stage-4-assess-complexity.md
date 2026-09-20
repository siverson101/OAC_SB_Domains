---
description: "Unity complexity, test methodology, and UI framework decisions"
requires: [selected_subdomain]
---

# Stage 4 — Unity complexity and project decisions

Replaces the built-in complexity questions.

Ask:

1. Estimated number of specialist subagents. (The shipped `unity-3d` set has 7: implementer,
   scene, uitk, animator, shadervfx, artasset, qa.)
2. Knowledge types needed: gameplay C#, scenes/prefabs, UI, animation, shaders/VFX, art import, QA.
3. **Test methodology**: TDD, BDD, ATDD, or None. If the user is unsure, default to TDD.
4. **Runtime UI**: UGUI, UI Toolkit, or Mixed.
5. **Editor UI**: UGUI, UI Toolkit, or Mixed.

## Capture

- `estimated_agent_count`
- `knowledge_types[]`
- `test_methodology` (TDD | BDD | ATDD | None)
- `runtime_ui` (UGUI | UI Toolkit | Mixed)
- `editor_ui` (UGUI | UI Toolkit | Mixed)

These decisions are written into context during Stage 7; they do not change which agents ship.
