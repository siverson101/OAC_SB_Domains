<!-- Context: unity-2d/lookup/validation-rules | Priority: high | Version: 1.0 | Updated: 2026-09-07 -->

# Validation Rules (Unity 2D)

## Compile Gate
- C# compiles without errors (dotnet/csc or Unity compile via CLI).
- No unresolved references, no missing asmdef dependencies.

## Test Gate
- EditMode tests cover pure logic (movement math, state machines, input handling).
- PlayMode tests cover scene-level behavior when feasible.
- All targeted tests pass via Unity Test Runner (batch mode `-runTests`).

## Scene/Asset Gate
- Scene re-opens in Unity without console errors.
- No broken prefab references; `.meta` GUIDs consistent.
- Import-only CLI run completes (exit 0) after asset changes.

## Build Gate
- Batch-mode build for target platform exits 0.
- Output path reported; log tail clean of blocking errors.

## Performance Gate
- Changes stay within `performance-budgets.md` targets.
- No per-frame allocations introduced in hot paths.

## QA Checklist
- [ ] Compile clean
- [ ] Tests pass (relevant set)
- [ ] Scene loads, no console errors
- [ ] Build succeeds (when requested)
- [ ] Within performance budget
