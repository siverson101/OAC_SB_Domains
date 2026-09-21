<!-- Context: unity-3d/knowledge/versions/unity-6.5 | Priority: high | Version: 1.0 | Updated: 2026-09-20 | Unity: 6.5 -->

# Version Overlay: Unity 6.5 (6000.5)

Loaded in addition to the engine and middleware base files when the detected editor is Unity 6.5.

## Feature Flags
- Define: `UNITY_6000_5_OR_NEWER` is true.
- The **Built-in Render Pipeline is deprecated** in 6.5. New work must target URP (or HDRP); existing
  Built-in content should plan a migration.
- HDRP is in maintenance mode: prefer URP unless the project genuinely needs HDRP features.
- URP and UI Toolkit APIs from 6.3 remain current.

## Guidance
- Do not author new `CGPROGRAM`/Built-in shaders; use `HLSLPROGRAM` and URP/HDRP includes.
- Audit projects for Built-in materials, `OnRenderImage` post-processing, and `_MainTex`/`_Color`
  shader property assumptions when upgrading to 6.5.
- Re-run the deprecation scan after upgrading; the Built-in deprecation adds new findings.

> Verify against primary sources: confirm the Built-in deprecation scope and any 6.5-only APIs against
> the Unity 6.5 manual and upgrade guide.
