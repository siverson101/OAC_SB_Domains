<!-- Context: unity-3d/knowledge/versions/unity-6.3 | Priority: high | Version: 1.0 | Updated: 2026-09-20 | Unity: 6.3 -->

# Version Overlay: Unity 6.3 (6000.3 LTS)

Loaded in addition to the engine and middleware base files when the detected editor is Unity 6.3.
This is the primary target for OAC Unity 3D guidance.

## Feature Flags
- Define: `UNITY_6000_3_OR_NEWER` is true.
- URP remains the default; HDRP is in maintenance mode. Built-in is still supported but on a
  deprecation path (see the 6.5 overlay).
- `Awaitable` is the preferred async primitive for new single-await code; UniTask remains valid when
  the project already ships it.
- ECS/DOTS Entities is a core package (Entities 1.x), not experimental.
- UI Toolkit is the default for new runtime UI; UGUI is supported for existing canvases.

## Guidance
- Prefer the APIs and package versions that ship with 6.3 unless the project pins otherwise.
- When a base knowledge file mentions an API added after 6.0, gate it with the 6.3 define.

> Verify against primary sources: confirm 6.3 feature flags and bundled package versions against the
> Unity 6.3 manual and the project's `Packages/manifest.json`.
