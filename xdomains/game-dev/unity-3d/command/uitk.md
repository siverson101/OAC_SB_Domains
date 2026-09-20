---
description: Build Unity UI Toolkit screens (UXML/USS/C#) - runtime UI, HUD, menus, editor UI
---

# Unity UI Toolkit Command

Routes to the Unity 3D Orchestrator → UnityUITK.

## Usage

```
/uitk {description}
```

Example: `/uitk build a health + stamina HUD panel for the player`

## Workflow

1. Load context: `.opencode/context/unity-3d/navigation.md`
2. Scope the UI: runtime (HUD/menus) or editor UI; gather layout + interactions
3. Author UXML structure + USS styling (tokens, responsive) via `UnityUITK`
4. Write C# UI controller (bind elements, events)
5. Validate UXML/USS parse + controller compiles; tell user how to preview in UI Builder

## Success Criteria

- [ ] UXML/USS schema-clean
- [ ] Controller compiles
- [ ] Screen renders expected state
