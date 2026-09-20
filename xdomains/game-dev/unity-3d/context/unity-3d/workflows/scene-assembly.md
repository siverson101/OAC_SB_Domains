---
name: scene-assembly
description: Create or restructure a Unity 3D scene/prefab safely
abilities: [unity-read-project]
agents: [scene, artasset, shadervfx]
---

<!-- Context: unity-3d/workflows/scene-assembly | Priority: high | Version: 1.0 | Updated: 2026-09-07 -->

# Workflow: Unity Scene Assembly

**Purpose**: Create or restructure a Unity 3D scene/prefab safely.
**Trigger**: `/unity-scene {desc}` or orchestrator routing.
**Complexity**: Moderate.

## Context Dependencies
- `../navigation.md`
- `../guides/scene-prefab-safety.md`
- `../concepts/project-layout.md`
- `../domain/unity-common.md`

## Stages

### 1. Assess
Inspect target scene/prefab and current structure. Read scene-prefab-safety.md. List planned edits (additions, wiring, lighting) and confirm with the user.

### 2. Edit (Targeted)
Route to `UnityScene`. Apply minimal targeted edits; add GameObjects with unique valid names; reference prefabs by GUID.

### 3. Art/Environment (optional)
When models/textures/lighting needed, route to `UnityArtAsset` (import settings) or `UnityShaderVFX` (materials/lighting look).

### 4. Validate
Confirm scene re-opens in Unity with no console errors (user check or CLI import pass).

### 5. Report
Summarize edits, new references, validation result.

## Success Criteria
- [ ] Targeted edits only (no wholesale rewrite)
- [ ] No broken GUID references
- [ ] Scene loads clean in Unity
- [ ] Backup exists for structural changes
