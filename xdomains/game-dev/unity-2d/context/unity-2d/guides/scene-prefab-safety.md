<!-- Context: unity-2d/guides/scene-prefab-safety | Priority: critical | Version: 1.0 | Updated: 2026-09-07 -->

# Scene & Prefab Editing Safety

`.unity` and `.prefab` files are **YAML with serialized object references**. Unsafe edits corrupt scenes silently.

## Rules
1. **Prefer targeted edits** — change component fields, not wholesale rewrites.
2. **Never reorder/drop `m_FileID`/`guid` references** you don't understand.
3. **Back up** the `.unity`/`.prefab` before structural edits.
4. **Re-open in Unity after edits** — the user (or Unity CLI `-quit`) must confirm the scene loads with no errors.
5. When creating new objects: add a GameObject with a unique, valid name and reference existing prefabs by their GUID rather than re-embedding content.

## Common Actions
- **Add component to existing object**: append a component block, keep other fields.
- **Reference a prefab**: reference by the prefab's GUID (from its `.meta`) — never by copied contents.
- **Scene wiring**: attach scripts to objects; scripts are referenced via their `.cs.meta` GUID.

## Validation Checklist
- [ ] `.unity`/`.prefab` parses (re-opened in Unity, no console errors)
- [ ] No duplicate/removed GUID references
- [ ] Original backup available if structural change
- [ ] Prefab instance overrides preserved
