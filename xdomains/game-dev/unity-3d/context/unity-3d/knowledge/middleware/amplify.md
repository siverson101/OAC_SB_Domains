<!-- Context: unity-3d/knowledge/middleware/amplify | Priority: medium | Version: 1.0 | Updated: 2026-09-20 | Unity: 6.0,6.3,6.5,LTS+ -->

# Amplify Shader Editor (ASE)

Package: Amplify **Shader Editor**, a node-based shader authoring tool that generates ShaderLab/HLSL
and can also emit Shader Graph-compatible output. It is a paid third-party asset, usually vendored
under `Assets/Plugins` or `Assets/AmplifyShaderEditor`.

## Model
- Author shaders as **ASE graphs** (`.shader` assets opened in the ASE canvas) made of nodes:
  `Texture Sample`, `Panner`, `Fresnel`, `Lerp`, `Step`, `Custom Expression`, and output nodes.
- ASE generates the final `.shader`; the graph is the source of truth. Do not hand-edit the generated
  shader body.
- Use **Custom Expression** nodes for HLSL that has no built-in node, and **Functions** to reuse
  sub-graphs across shaders.

## Working with It
- Match the graph's pipeline target (URP/HDRP/Built-in) to the project; an ASE shader authored for
  Built-in will not render correctly under URP without the URP templates.
- Expose parameters as properties with clear names and `Header`/`Tooltip` attributes for artists.
- Prefer Shader Graph for new first-party work unless the project already standardises on ASE; mixing
  both is a maintenance cost.

## Conventions
- One graph per effect; keep node count manageable and comment dense sub-graphs.
- Name generated shaders consistently (`ASE/...` or project prefix) and store under an `Art/Shaders`
  or `_Project/Shaders` folder.
- Keep a matching material preset for each shader.

## Testing
- Shader output is hard to unit test. Validate by rendering a known scene and capturing a screenshot
  in a PlayMode visual-verification test, then compare against a baseline image.

> Verify against primary sources: ASE versions track Unity releases and pipeline packages. Confirm
> against the installed ASE version and its URP/HDRP templates.
