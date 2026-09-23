---
description: Alias for /ui with a UI Toolkit stack hint - build UI Toolkit screens (UXML/USS/C#)
---

# Unity UI Toolkit Command (hint alias)

Alias for `/ui`. Routes to the Unity 3D Orchestrator → UnityUI with the **UI Toolkit** stack hint.

## Usage

```
/uitk {description}
```

Example: `/uitk build a health + stamina HUD panel for the player`

## Workflow

Run the `/ui` workflow with the stack hint `uitk` (pass `--stack uitk` to `ui-interaction` for live
interaction). See `command/ui.md`.

## Success Criteria

- [ ] UXML/USS schema-clean
- [ ] Controller compiles
- [ ] Screen renders expected state
