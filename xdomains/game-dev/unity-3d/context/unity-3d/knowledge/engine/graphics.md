<!-- Context: unity-3d/knowledge/engine/graphics | Priority: high | Version: 1.0 | Updated: 2026-09-20 | Unity: 6.0,6.3,6.5,LTS+ -->

# Graphics and Rendering (Unity 6.x)

Scope: render pipelines, shader authoring, and the rendering feature set. Property name tables live
in `xdomains/context/unity/shader-properties.json`.

## Render Pipelines
- **URP** (Universal Render Pipeline) is the default for new projects. **HDRP** targets high-end
  desktop/console and is in maintenance mode for 6.x. The **Built-in** pipeline is legacy and is
  deprecated in 6.5.
- Choose the pipeline once, at project start; migrating pipelines rewrites materials and shaders.
- URP customisation goes through **Renderer Features** (Scriptable Renderer Feature) and a
  `ScriptableRenderPass`, not `OnRenderImage`.

## Shader Authoring
- Author URP/HDRP shaders in **Shader Graph** for maintainability, or HLSL for full control.
- Use `HLSLPROGRAM` for URP/HDRP; `CGPROGRAM` is legacy. Include `Core.hlsl` and use
  `TransformObjectToHClip`, `GetMainLight`, and `SAMPLE_TEXTURE2D` helpers.
- Declare properties in the `Properties` block and mirror them with `CBUFFER`/`UnityPerMaterial` SRP
  batcher-compatible constant buffers.
- Prefer SRP Batcher-compatible shaders (one material CBUFFER, no per-object material properties) and
  GPU instancing for repeated meshes.

## Lighting and Colour
- **Linear** colour space is the default; keep textures marked sRGB correctly.
- Bake static lighting to lightmaps and reflection probes; use mixed lighting for dynamic objects.
- Use **Light Probes** and **Reflection Probes** for dynamic objects in baked scenes.

## Performance
- Batch draw calls: SRP Batcher, GPU instancing, static batching, and LOD groups.
- Keep overdraw low; sort transparent geometry and avoid large full-screen transparent quads.
- Profile with the **Rendering Profiler** and the **Frame Debugger** before optimising blindly.
- Use `Camera.main` caching, `Shader.PropertyToID` for property IDs, and `MaterialPropertyBlock` for
  per-instance variation without breaking batching.

## Version Deltas
- 6.0/6.3: URP is the default; Built-in still supported.
- 6.5: Built-in pipeline is deprecated; plan URP/HDRP for new work.

> Verify against primary sources: shader includes, pipeline feature availability and deprecation
> status differ by editor version. Check the URP/HDRP package docs for the version in use.
