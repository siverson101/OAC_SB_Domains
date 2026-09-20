---
description: Implement a Unity 3D gameplay feature end-to-end (implement → test → validate)
---

# Unity Feature Command

Routes to the Unity 3D Orchestrator to run the **feature-delivery** workflow.

## Usage

```
/unity-feature {description of feature}
```

Example: `/unity-feature add a player controller with Rigidbody movement and camera-relative input`

## Workflow

1. Load context: `.opencode/context/unity-3d/navigation.md` + `domain/unity-common.md`
2. Scope the feature and confirm acceptance criteria with the user
3. Implement via `UnityImplementer` (focused C#, testable pure logic)
4. Add tests via `UnityQA` (EditMode first)
5. Coordinate `UnityScene` for any scene/prefab wiring
6. Validate: compile clean, tests pass, scene loads
7. Report files touched + results

## Success Criteria

- [ ] C# compiles clean
- [ ] Tests pass for the feature logic
- [ ] Scene loads without console errors (if touched)
