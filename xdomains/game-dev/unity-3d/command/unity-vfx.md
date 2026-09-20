---
description: Create Unity 3D shaders / VFX Graph effects / materials and optimize them
---

# Unity VFX Command

Routes to the Unity 3D Orchestrator → UnityShaderVFX.

## Usage

```
/unity-vfx {description}
```

Example: `/unity-vfx create a muzzle flash VFX with particles and a point light`

## Workflow

1. Load context: `.opencode/context/unity-3d/navigation.md` + `lookup/performance-budgets.md`
2. Scope the effect (burst vs loop), target pipeline (URP default) and platform
3. Author shader/VFX assets + materials via `UnityShaderVFX`
4. Check against performance budgets (overdraw, particles, draw calls)
5. Validate import clean; document exposed properties + how to trigger from code

## Success Criteria

- [ ] Effect assets created (shadergraph/VFX/materials)
- [ ] No console errors
- [ ] Within performance budget
