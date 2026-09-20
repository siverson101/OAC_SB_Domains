<!-- Context: unity-2d/guides/feature-pipeline | Priority: high | Version: 1.0 | Updated: 2026-09-07 -->

# Feature Implementation Pipeline

The default path for adding a Unity 2D gameplay feature (moderate complexity).

## Stages

### 1. Understand & Scope
- Load `unity-2d/navigation.md`, `domain/unity-common.md`.
- Read the relevant scene/prefab/script before changing anything.
- Restate the feature, inputs, and acceptance criteria. Confirm with the user.

### 2. Design
- Identify components: new MonoBehaviours, asset requirements, scene wiring.
- Follow `lookup/csharp-conventions.md`.
- Route architectural/ambiguous asks to the orchestrator.

### 3. Implement
- Write small, focused C# diffs. Prefer targeted edits over rewrites.
- Create/update prefab references and scene wiring via safe scene edits (see `scene-prefab-safety.md`).

### 4. Validate (Compile + Unit)
- Run compile checks (`dotnet build`/`csc` if available, else Unity CLI compile).
- Add/edit EditMode tests for pure logic; PlayMode tests for behavior. See `unity-qa`.

### 5. In-Editor Check
- Re-open scene in Unity, verify no console errors, confirm feature behaves.
- List performance metrics to check (see `lookup/performance-budgets.md`).

## Output
Summary of files touched, tests run, and validation results. Hand off to `../workflows/quality-gate.md` for full QA when requested.
