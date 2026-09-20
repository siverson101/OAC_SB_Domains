<!-- Context: unity-3d/workflows/quality-gate | Priority: high | Version: 1.0 | Updated: 2026-09-07 -->

# Workflow: Unity Quality Gate

**Purpose**: Full QA validation of Unity 3D changes — compile, tests, build smoke.
**Trigger**: `/unity-test` (test run), `/unity-build {platform}` (build), or as final gate in feature delivery.
**Complexity**: Moderate.

## Context Dependencies
- `../navigation.md`
- `../lookup/validation-rules.md`
- `../guides/build-cli.md`
- `../lookup/performance-budgets.md`
- `../domain/unity-common.md`

## Stages

### 1. Scope
Determine which gates apply: compile, EditMode/PlayMode tests, build (target platform). Identify changed scope.

### 2. Test
Route to `UnityQA`. Run Unity Test Runner via batch mode for EditMode and PlayMode as applicable. Compile checks first.

### 3. Build Smoke (optional)
When requested (`/unity-build {platform}`), run batch-mode build. Record exit code, output path, log location, first errors.

### 4. Performance Check (optional)
When changes are performance-sensitive, validate against budgets (profiler traces, draw calls, allocations).

### 5. Report
Summarize pass/fail per gate per validation-rules.md. On failure: report → propose → request approval to fix.

## Success Criteria
- [ ] Compile clean
- [ ] Tests pass (targeted set)
- [ ] Build exits 0 (when run)
- [ ] Within performance budget (when applicable)
- [ ] Findings reported with evidence
