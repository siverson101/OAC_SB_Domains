<!-- Context: unity-3d/knowledge/engine/ui | Priority: high | Version: 1.0 | Updated: 2026-09-20 | Unity: 6.0,6.3,6.5,LTS+ -->

# UI Systems (Unity 6.x)

Scope: runtime and editor UI. Unity ships two runtime UI stacks: **UI Toolkit** and **UGUI**
(Canvas-based). Pick per project and stay consistent; see `xdomains/context/unity/package-choices.json`.

## UI Toolkit (recommended for new runtime UI)
- Structure: UXML for hierarchy, USS for styling, and a C# controller that queries the visual tree.
- Mount with `UIDocument` on a GameObject; query elements with `rootVisualElement.Q<Button>("id")`.
- Layout uses **Flexbox**; styling uses USS selectors with class names (`.btn-primary`).
- Use `VisualElement.schedule` for timed updates; unregister callbacks on detach.
- Runtime UI Toolkit is the modern default; IMGUI remains for editor tooling only.

## UGUI (Canvas)
- `Canvas` + `CanvasScaler` + `GraphicRaycaster`; layout via `HorizontalLayoutGroup`,
  `VerticalLayoutGroup`, and `ContentSizeFitter`.
- Rebuild cost: changing a canvas element marks the whole canvas dirty. Split static and dynamic
  content across separate canvases to limit rebuilds.
- `Button.onClick` is a `UnityEvent`; prefer code-bound listeners for testability.

## Text
- **TextMeshPro (TMP)** is the standard text renderer for both stacks (see
  `../middleware/textmeshpro.md`). Legacy `UnityEngine.UI.Text` is not suitable for new work.
- Use TMP **font assets** and an atlas sized to the glyph set; enable SDF for crisp scaling.

## Accessibility and Localisation
- Keep touch targets at least 44x44 dp; support safe areas on mobile via `Screen.safeArea`.
- Externalise strings into localisation tables; avoid concatenating translated fragments.

## Testing UI
- UI Toolkit: drive the visual tree and assert element state in EditMode tests.
- UGUI: test the controller logic directly; use PlayMode tests for interaction.

> Verify against primary sources: UI Toolkit APIs and UGUI components evolve per editor version.
> Confirm against the UI Toolkit and uGUI package docs for the version in use.
