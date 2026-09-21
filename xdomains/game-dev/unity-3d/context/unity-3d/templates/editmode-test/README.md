<!-- Context: unity-3d/templates/editmode-test | Standards-Version: 1.0 | Priority: high | Updated: 2026-09-20 | Unity: 6.0,6.3,6.5,LTS+ -->

# Template: EditMode Test Assembly

Self-contained scaffold for an Editor-only test assembly. Copy the directory into a project, rename
the assembly, and add references to the code under test. EditMode tests run in the Editor without
entering Play mode, so they are the fastest place to pin pure logic.

## Files

| File | Purpose |
|------|---------|
| `SampleEditModeTests.asmdef` | Editor-only test assembly referencing the Test Framework runners. |
| `SampleEditModeTests.cs` | Arrange-Act-Assert sample test using NUnit. |

## Usage

1. Copy the directory into `Assets/Tests/EditMode` (or the project's test root).
2. Rename the `.asmdef` `name` and update `rootNamespace`.
3. Add the assembly under test to the asmdef `references` array.
4. Run via **Window > General > Test Runner > EditMode**, or through the Unity CLI in batch mode.

## Standards

- `Standards-Version: 1.0`.
- `includePlatforms: ["Editor"]` and `defineConstraints: ["UNITY_INCLUDE_TESTS"]`.
- One behaviour per test, named `Method_Scenario_ExpectedResult`.
- Reset static state in `[TearDown]`; never depend on test execution order.
