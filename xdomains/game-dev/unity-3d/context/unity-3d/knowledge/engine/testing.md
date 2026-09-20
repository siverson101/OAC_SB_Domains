<!-- Context: unity-3d/knowledge/engine/testing | Priority: high | Version: 1.0 | Updated: 2026-09-20 | Unity: 6.0,6.3,6.5,LTS+ -->

# Testing (Unity 6.x)

Scope: the Unity Test Framework (`com.unity.test-framework`), EditMode vs PlayMode, and how tests are
run offline or through the Unity CLI.

## Test Kinds
- **EditMode** tests run in the Editor without entering Play mode: fast, ideal for pure logic, editor
  tooling, and asset inspection. Attribute: `[Test]` in an editor-test assembly.
- **PlayMode** tests enter Play mode and can use coroutines/`UnityTest` and `[UnitySetUp]`/`[UnityTearDown]`.
  Use for runtime behaviour, physics, and frames-over-time assertions.
- Both use NUnit attributes (`[Test]`, `[TestCase]`, `[SetUp]`, `[TearDown]`).

## Assemblies
- Tests live in a `*.Tests.asmdef` with `testAssemblies: true`, referencing the code under test and
  `UnityEngine.TestRunner` + `UnityEditor.TestRunner`.
- Editor-only tests set the asmdef platform to Editor; PlayMode tests include the runtime platforms.
- Add `[assembly: InternalsVisibleTo("Game.Tests")]` to test internal types instead of widening API.

## Authoring Rules
- One behaviour per test; name tests `Method_Scenario_ExpectedResult`.
- Use the **Arrange-Act-Assert** shape; assert one concept per test.
- Never depend on test execution order; reset static state in `[TearDown]`.
- For time-dependent code, inject a clock or use `Time.timeScale`/`yield return null` deliberately.
- Prefer deterministic seeds; avoid real network and real wall-clock waits.

## Running
- Editor: **Window > General > Test Runner** (EditMode / PlayMode tabs).
- CLI/batch: run the Unity Test Framework through the Unity CLI pipeline so results land in
  `TestResults.xml`; the OAC `run-edit-mode-tests` and `run-play-mode-tests` abilities wrap this.
- Parse `TestResults.xml` for pass/fail and `[Category("VisualVerification")]` results plus screenshot
  paths for the visual gate.

## Honesty
- A no-op run is not a pass. Distinguish `null` (not run) from clean (ran, no failures).
- Report compile errors before test failures; a project that does not compile has no test result.

> Verify against primary sources: Test Framework attributes and CLI flags change between package
> versions. Confirm against the Test Framework package docs for the version in use.
