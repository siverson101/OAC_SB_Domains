---
description: Build Unity UI screens for the project's UI stack (UI Toolkit / UGUI / Mixed) - runtime UI, HUD, menus, editor UI
---

# Unity UI Command

Routes to the Unity 3D Orchestrator → UnityUI, targeting the project's configured UI stack.

## Usage

```
/ui {description}
/ugui {description}   # hint: force the UGUI stack for this request
/uitk {description}   # hint: force the UI Toolkit stack for this request
```

Example: `/ui build a health + stamina HUD panel for the player`

## Workflow

1. Load context: `.opencode/context/unity-3d/navigation.md`
2. Resolve the UI stack: the project's `uiStack` from `.opencode/unity-studio.json`; `/ugui` and
   `/uitk` pass a stack hint. If the stack is `mixed` and the request does not specify, ask the user.
3. Scope the UI: runtime (HUD/menus) or editor UI; gather layout + interactions
4. Author the layout + styling for the resolved stack via `UnityUI`
5. Write the C# UI controller (bind elements, events)
6. Validate; tell the user what to check in the Editor

## Success Criteria

- [ ] Layout/style schema-clean for the chosen stack
- [ ] Controller compiles
- [ ] Screen renders expected state
