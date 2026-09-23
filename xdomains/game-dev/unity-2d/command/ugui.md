---
description: Alias for /ui with a UGUI stack hint - build UGUI screens (Canvas, RectTransform, MonoBehaviour controllers)
---

# Unity UGUI Command (hint alias)

Alias for `/ui`. Routes to the Unity 2D Orchestrator → UnityUI with the **UGUI** stack hint.

## Usage

```
/ugui {description}
```

Example: `/ugui build a settings menu with a Canvas and a MonoBehaviour controller`

## Workflow

Run the `/ui` workflow with the stack hint `ugui` (pass `--stack ugui` to `ui-interaction` for live
interaction). See `command/ui.md`.

## Success Criteria

- [ ] Canvas/prefab references resolve in the Editor
- [ ] Controller compiles
- [ ] Screen renders expected state
