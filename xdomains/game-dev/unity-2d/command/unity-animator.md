---
description: Build or fix Unity 2D animation - animator controllers, clips, retargeting, blend trees
---

# Unity Animator Command

Routes to the Unity 2D Orchestrator → UnityAnimator.

## Usage

```
/unity-animator {description}
```

Example: `/unity-animator retarget the humanoid walk cycle onto the NPC and build an idle→walk→run controller`

## Workflow

1. Load context: `.opencode/context/unity-2d/navigation.md`
2. Scope characters, required states, and source clips
3. Verify rig/avatar import (coordinate with `UnityArtAsset` if needed)
4. Build/extend the Animator Controller (states, transitions, parameters, blend trees) via `UnityAnimator`
5. Document the parameter list for implementers; validate clips loop and transitions behave

## Success Criteria

- [ ] Controller/clips created or updated
- [ ] Parameters documented (exact names)
- [ ] Clips loop cleanly, transitions correct
