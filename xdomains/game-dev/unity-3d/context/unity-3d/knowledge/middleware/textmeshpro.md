<!-- Context: unity-3d/knowledge/middleware/textmeshpro | Priority: high | Version: 1.0 | Updated: 2026-09-20 | Unity: 6.0,6.3,6.5,LTS+ -->

# TextMeshPro (TMP)

Package: `com.unity.textmeshpro` (UGUI integration) with `TMPro` namespace. TMP is the standard text
renderer for both UGUI and UI Toolkit.

## Components
- `TextMeshProUGUI` for Canvas/UGUI; `TextMeshPro` for world-space (MeshRenderer) text.
- Set `.text`, `.fontSize`, `.color`, `.alignment`; prefer rich-text tags for inline styling.
- `TMP_InputField` for editable text.

## Font Assets
- A **font asset** bakes a source font into a glyph atlas plus an SDF material for crisp scaling.
- Create via **Window > TextMeshPro > Font Asset Creator**; choose a character set that covers your
  languages. Dynamic font assets add glyphs at runtime and grow the atlas.
- Keep atlas resolution modest (1024-2048) unless you need many glyphs; large atlases cost memory.
- Use **fallback font assets** for CJK/emoji rather than one giant atlas.

## Performance
- Changing text triggers a mesh rebuild for that component; do not update text every frame.
- Use `SetText(format, value)` overloads and `TMP_Text.textInfo` for measured layout.
- Reuse components via pooling for lists of labels (damage numbers, score popups).

## Quality
- SDF rendering stays crisp at any scale; enable **Extra Padding** for outlines/shadows.
- Match `Font Size` and `Auto Size` settings to the canvas scale mode; avoid non-uniform scaling.

## Testing
- Assert text content and `preferredWidth`/`preferredHeight` in EditMode tests with a test font asset.
- Do not assert rendered pixels; assert layout metrics instead.

> Verify against primary sources: TMP is being folded into the uGUI/UI Toolkit packages in newer
> editor versions. Confirm the package id and component names for the version in use.
