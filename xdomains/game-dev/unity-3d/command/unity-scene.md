---
description: Create or restructure a Unity 3D scene or prefab safely
---

# Unity Scene Command

Routes to the Unity 3D Orchestrator → UnityScene to run the **scene-assembly** workflow.

## Usage

```
/unity-scene {description}
```

Example: `/unity-scene set up Main scene with a spawn point, directional light, and player spawn`

## Workflow

1. Load context: `.opencode/context/unity-3d/guides/scene-prefab-safety.md` + `concepts/project-layout.md`
2. Inspect the current scene/prefab; list planned targeted edits; confirm with user
3. Apply edits via `UnityScene` (GUID-preserving, targeted)
4. Route art/lighting/material needs to `UnityArtAsset` / `UnityShaderVFX` as needed
5. Validate scene re-opens in Unity with no console errors
6. Report edits + validation result

## Success Criteria

- [ ] Targeted edits only — no wholesale scene rewrite
- [ ] No broken references
- [ ] Scene loads clean in Unity
