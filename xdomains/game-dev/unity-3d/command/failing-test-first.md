---
id: failing-test-first
summary: Enforce the red step — confirm the named test fails for the expected reason before implementation; TDD-gated, read-only.
family: verify
mode: both
description: Read the observed failure from a --test-results TestResults.xml path (a --failure-message may fill in a missing message), then return STATUS OK only when the named test failed and the failure message contains --expected-reason; a bare --failure-message is self-reported and yields STATUS UNKNOWN, never a green red-step. An observed pass or an unrelated failure is STATUS NG and aborts. Gated by toggles.tdd in .opencode/unity-studio.json (fail-soft absent means off); TDD off refuses clearly. It never mutates project assets.
inputs: { projectRoot: "string", opencodeDir: "string", test: "string", expectedReason: "string", failureMessage: "string?", testResults: "string?", tdd: "on|off?" }
outputs: { status: "string", safetyGate: "object", changeScope: "string[]?", checkpoint: "object", delta: "object", redStep: "OK|NG|UNKNOWN|null", test: "string?", expectedReason: "string?", observedResult: "string?", observedMessage: "string?", reason: "string?", tddEnabled: "boolean" }
sideEffects: []
safetyGate: { mutates: false, requiresEditor: false }
uses: [run-edit-mode-tests, run-play-mode-tests]
provides: [failing-test-first]
requires: [unity-studio-config, test-results]
testPlan: ["Confirm STATUS OK when the named test fails for the expected reason", "Confirm STATUS NG when the test passes unexpectedly", "Confirm TDD off refuses clearly"]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# failing-test-first

Enforces the **red step** of the `tdd` loop: before implementation, the named test must fail, and it
must fail for the expected reason. A test that already passes proves nothing about the new behaviour;
a test that fails for an unrelated reason (a compile error, a different assertion) does not exercise
the intended seam. Both are `STATUS: NG` and abort.

```bash
node .opencode/xdomains/scripts/unity/unity-verify.mjs \
  --project-root . --opencode-dir .opencode \
  --ability failing-test-first \
  --test "PlayerTests.JumpTest" \
  --expected-reason "NullReferenceException" \
  --test-results .opencode/scratch/editmode-results.xml --json
```

- **TDD gate:** read from `.opencode/unity-studio.json` `toggles.tdd`. With TDD off the ability
  returns `refused` — TDD off still requires tests, just not written first. An explicit `--tdd on|off`
  overrides the config (a test/override affordance); an unknown value refuses.
- **Observed failure:** pass `--test-results <TestResults.xml>`; a `--failure-message "<text>"` may
  fill in a missing failure message. A results file is authoritative: the named test must be present,
  and its pass/fail outcome decides the verdict. A bare `--failure-message` is self-reported, not
  observed, so it can never produce `STATUS: OK`.
- **Verdict:** `STATUS: OK` only when an observed result shows the named test failed and the failure
  message contains `--expected-reason` (case-insensitive substring). A bare self-reported message that
  matches is `STATUS: UNKNOWN` (advisory). Otherwise `STATUS: NG` with the reason recorded —
  `unexpected-pass`, `unrelated-failure`, `test-not-run`, or `test-not-found` — and the caller aborts
  with a non-zero exit code.
- **Inputs:** `--test` and `--expected-reason` are required; with neither observation flag the ability
  refuses. A missing results file refuses loudly.

Read-only and offline: it reads a failure message or a results file and never mutates project assets
or writes project state.
