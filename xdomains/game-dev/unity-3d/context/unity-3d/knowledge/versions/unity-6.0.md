<!-- Context: unity-3d/knowledge/versions/unity-6.0 | Priority: high | Version: 1.0 | Updated: 2026-09-20 | Unity: 6.0 -->

# Version Overlay: Unity 6.0 (6000.0 LTS)

Loaded in addition to the engine and middleware base files when the detected editor is Unity 6.0.
The base files already cover the 6.x common ground; this file lists only the 6.0-specific deltas.

## Feature Flags
- Define: `UNITY_6000_0_OR_NEWER` is true.
- Unity 6 rebrand of the 2023.x line; `FindFirstObjectByType`/`FindObjectsByType` are the current
  scene-lookup APIs and the `FindObjectOfType` family is obsolete.
- `Awaitable` is available as a built-in allocation-light async primitive.
- URP is the default render pipeline; Built-in is still fully supported.
- UI Toolkit runtime is stable; UGUI remains the fallback.

## Cautions
- Package versions bundled with 6000.0 differ from later 6.x releases (Addressables, Cinemachine,
  Input System). Resolve versions from the project's `Packages/manifest.json`, not from memory.
- Some 6.1+ APIs are absent here; guard with the version define rather than assuming forward support.

> Verify against primary sources: confirm every 6.0 feature flag against the Unity 6.0 manual and the
> installed package versions for the exact project.
