---
description: Author Amplify Shader Editor node graphs for Unity 2D shaders
---

# Unity Amplify Shader Editor Command

Routes to the Unity 2D Orchestrator → UnityShaderVFX to author an **Amplify Shader Editor (ASE)** node graph.

## Usage

```
/unity-ase {description}
```

Example: `/unity-ase make a dissolve shader with an edge glow using a noise texture`

## Workflow

1. Load context: `.opencode/context/unity-2d/navigation.md` + `lookup/performance-budgets.md`
2. Confirm the render pipeline (URP default) matches ASE target
3. Author the ASE node graph + material instance via `UnityShaderVFX`
4. Document exposed properties and how to drive them from code
5. Validate assets import with no shader errors and within budget

## Success Criteria

- [ ] ASE asset created (opens in ASE editor)
- [ ] No shader compile errors
- [ ] Exposed properties documented
