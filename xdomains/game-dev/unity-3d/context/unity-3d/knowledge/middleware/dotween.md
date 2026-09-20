<!-- Context: unity-3d/knowledge/middleware/dotween | Priority: medium | Version: 1.0 | Updated: 2026-09-20 | Unity: 6.0,6.3,6.5,LTS+ -->

# DoTween (DOTween)

Package: Demigiant **DOTween** (often vendored under `Assets/Plugins/Demigiant/DOTween`). A
tweening engine for animating values, transforms, materials, and UI over time.

## Model
- Create a tween with the `DOTween.To`/`DOTween.To(...)` helpers or the extension methods:
  `transform.DOMove(target, duration)`, `material.DOFade(0f, 0.3f)`, `image.DOColor(...)`.
- Configure with chainable methods: `.SetEase(...)`, `.SetDelay(...)`, `.SetLoops(...)`,
  `.SetUpdate(isIndependentUpdate)`.
- A `Sequence` composes tweens with `Append`, `Join`, `Insert`, `Prepend`.

## Rules
- Store the `Tween`/`Sequence` handle and `Kill()` it when the owner is destroyed; a tween that
  outlives its target throws or leaks.
- Set `.SetLink(gameObject)` so the tween dies with the GameObject automatically.
- Use `.SetUpdate(true)` only for UI that must animate while `Time.timeScale == 0`.
- Reuse sequences for repeated effects (UI popups, hit flashes) instead of allocating per play.
- Do not drive gameplay-critical logic from tweens; use them for presentation.

## TMP and UI
- `DOTween`/`DOTweenPro` extensions include `DOFade`, `DOScale`, `DOAnchorPos` for UGUI and
  `DOText`/`DOFade` for TMP text.

## Testing
- Tween timing is frame-dependent: in PlayMode tests, either use a fixed timestep and yield frames, or
  call `.Complete()`/`.Goto()` to jump to an end state deterministically.
- Assert final values after `Complete()`, not intermediate frames.

> Verify against primary sources: DoTween is a third-party asset with a separate Pro tier and version
> history. Confirm the installed version and module list (DOTween vs DOTween Pro).
