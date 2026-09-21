---
id: test-deduplication
summary: Detect true duplicate tests (same condition and same assertion) and parameterizable groups, propose or apply removals, and record a removals/merges artifact.
family: verify
mode: offline
description: Scan *.cs test files (--tests) and/or structured descriptors (--tests-json) and compare canonicalised conditions and assertions. A true duplicate shares both; a parameterizable group shares the assertion with conditions differing only by literal arguments in the same equivalence partition. Both dry-run and --apply record .opencode/test-dedup/<feature>.json; only --apply edits source files, and only source-file removals are marked applied (JSON-sourced removals stay proposed). Never trades coverage for tidiness.
inputs: { projectRoot: "string", opencodeDir: "string", feature: "string", tests: "string?", testsJson: "string?", apply: "boolean?" }
outputs: { status: "string", safetyGate: "object", changeScope: "string[]?", checkpoint: "object", delta: "object", action: "string", feature: "string?", artifactPath: "string", written: "boolean", applied: "boolean", totalTests: "number", removals: "object[]", merges: "object[]", removedFromFiles: "string[]" }
sideEffects: ["writes .opencode/test-dedup/<feature>.json (proposals in dry-run, applied removals on --apply)", "removes true-duplicate test methods from *.cs on --apply"]
safetyGate: { mutates: true, requiresEditor: false, dryRunFirst: true, writesState: true }
uses: []
provides: [test-deduplication, test-dedup-artifact]
requires: [test-results]
testPlan: ["Run test-deduplication in dry-run and confirm no file is written", "Confirm two tests with identical condition and assertion yield one removal", "Confirm a pair sharing a condition but not an assertion is retained", "Confirm a parameterizable group is merged without if or switch in the body"]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# test-deduplication

Detects duplicate tests and parameterizable groups, then proposes (or applies)
removals. It never trades coverage for tidiness: when in doubt, both tests are
kept.

```bash
node .opencode/xdomains/scripts/unity/unity-verify.mjs \
  --project-root . --opencode-dir .opencode \
  --ability test-deduplication --feature player-jump \
  --tests Assets/Tests/EditMode --json

node .opencode/xdomains/scripts/unity/unity-verify.mjs \
  --project-root . --opencode-dir .opencode \
  --ability test-deduplication --feature player-jump \
  --tests Assets/Tests/EditMode --apply --json
```

## Duplicate definition

- **True duplicate** — identical condition **and** identical assertion
  (whitespace/case canonicalised). Remove the redundant test; keep the more
  accurately named one.
- **Same condition + different assertion** — not a duplicate.
- **Different condition** — not a duplicate.
- **Parameterizable group** — the same assertion, with conditions differing only
  by literal arguments in the same equivalence partition. Proposed as one
  parameterized merge; the proposed body never uses `if`/`switch` and never
  parameterizes the expected value. Same-condition tests are never merged into a
  single multi-assert test.

## Inputs

- `--tests <dir>` — scan `*.cs` test files for test-attributed methods.
- `--tests-json <file>` — structured descriptors `{ name, condition, assertion,
  file? }` (a bare array or `{ "tests": [...] }`), so the decision logic is
  testable without a full C# parser.

## Apply

- Default is a **dry-run**: it proposes removals/merges and never edits a test
  file. It still records the proposals artifact at
  `.opencode/test-dedup/<feature>.json` (a clean suite writes nothing).
- `--apply` removes true-duplicate methods from `--tests <dir>` source files and
  records the same artifact. Only a removal applied to a source file is marked
  `applied: true`; a `--tests-json` descriptor has no source to edit, so its
  removals stay **proposed** even under `--apply`.
- Parameterizable merges are recorded as proposals only — rewriting a source
  method into a parameterized one without a C# parser risks dropping coverage, so
  the merge is handed off with its proposed body rather than applied blindly.
- A clean suite reports **"no duplicates found"**.
