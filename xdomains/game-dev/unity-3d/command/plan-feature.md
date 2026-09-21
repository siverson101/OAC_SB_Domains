---
id: plan-feature
summary: Assemble and write a plan artifact (.opencode/plans/<slug>.md) from the test-designer output and return the Testability verdict; TDD-gated, and a Testability FAIL loops back once then aborts.
family: compose
mode: offline
description: OAC has no plan mode, so this ability does the job the plan-feature skill's plan file does. It assembles Context, Implementation Design, Test Cases (verbatim from test-designer), Testing Decisions, the Testability Assessment, Known Trade-offs and the Development Workflow into .opencode/plans/<slug>.md. Gated by toggles.tdd; a PASS/WARN writes the artifact, a FAIL returns a loopback instruction (one retry, then abort) instead of writing a final plan.
inputs: { projectRoot: "string", opencodeDir: "string", feature: "string", context: "string?", design: "string?", testCases: "string", testingDecisions: "string?", testability: "PASS|WARN|FAIL", tradeOffs: "string?" }
outputs: { status: "string", action: "string", feature: "string?", planPath: "string", testability: "string?", attempt: "number", written: "boolean", instruction: "string?" }
sideEffects: ["writes .opencode/plans/<slug>.md", "writes .opencode/plans/<slug>.loopback.json on a Testability FAIL"]
safetyGate: { mutates: false, requiresEditor: false, writesState: true }
uses: []
provides: [plan-feature, plan-artifact]
requires: [unity-studio-config, test-cases]
testPlan: ["Confirm a PASS writes the plan artifact with every section in order", "Confirm TDD off refuses and writes nothing", "Confirm a Testability FAIL loops back once then aborts"]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# plan-feature

Emits a **plan artifact** for a feature. OAC has no plan mode, so the ability assembles the plan
file itself from the test-designer output and returns the Testability verdict, rather than toggling a
mode.

```bash
node .opencode/xdomains/scripts/unity/unity-compose.mjs \
  --project-root . --opencode-dir .opencode \
  --ability plan-feature --feature player-jump \
  --context "Add a jump ability to the player." \
  --design "<Implementation Design from the Plan agent>" \
  --test-cases "<Test Cases, verbatim from test-designer>" \
  --testing-decisions "<seams, what makes a good test, prior art>" \
  --testability PASS --json
```

## Artifact

`.opencode/plans/<slug>.md` carries, in order: **Context**, **Implementation Design** (seams,
signatures, file placement), **Test Cases** (pasted verbatim from test-designer — never rewritten),
**Testing Decisions** (seams under test, what makes a good test, prior art), **Testability
Assessment** (`PASS`/`WARN`/`FAIL`), **Known Trade-offs**, and **Development Workflow** (the `tdd`
rules: red before green, one vertical slice at a time, tests at pre-agreed public seams, refactoring
belongs to review; reject implementation-coupled, tautological and horizontally-sliced tests).

## Testability handling

- `PASS` — write the artifact.
- `WARN` — write the artifact and record the testability warning under Known Trade-offs.
- `FAIL` — do **not** write the plan; return a loopback instruction to revise the design and re-run.
  A second consecutive `FAIL` (tracked in `.opencode/plans/<slug>.loopback.json`) aborts.

## Gating

`plan-feature` is gated by `toggles.tdd` in `.opencode/unity-studio.json`. With TDD off it refuses
clearly — TDD off still requires tests, just not first. Offline and fail-soft: it writes only under
`.opencode/plans/` and never touches project assets.
