---
name: feature-delivery
description: Implement a Unity 3D gameplay feature end-to-end - implement, test, validate
abilities: [gather-unity-context, unity-read-project, unity-run-tests]
agents: [implementer, qa, scene]
---

<!-- Context: unity-3d/workflows/feature-delivery | Priority: high | Version: 1.0 | Updated: 2026-09-07 -->

# Workflow: Unity Feature Delivery

**Purpose**: Implement a Unity 3D gameplay feature end-to-end: implement → test → validate.
**Trigger**: `/unity-feature {desc}` or orchestrator routing.
**Complexity**: Moderate.

## Context Dependencies
- `../navigation.md`
- `../lookup/csharp-conventions.md`
- `../lookup/validation-rules.md`
- `../examples/mono-behaviour-templates.md`
- `../domain/unity-common.md`

## Stages

### 1. Scope & Context
Load navigation + conventions. Restate feature, inputs, acceptance criteria. Confirm with user.

### 2. Implement
Route to `UnityImplementer`. Deliver focused C# with testable pure logic. Flag scene/prefab wiring for `UnityScene`.

### 3. Test
Route to `UnityQA`. Add/edit EditMode tests (logic) and PlayMode where needed. Run Unity Test Runner (batch mode).

### 4. Validate & Wire
Compile gate + test gate per validation-rules.md. If scene wiring was flagged, coordinate `UnityScene` for targeted edits.

### 5. Report
Summarize files, tests, validation outcome, and next steps.

## Success Criteria
- [ ] Compile clean
- [ ] New tests pass
- [ ] Scene loads without console errors (if touched)
- [ ] Within performance budget (when applicable)
