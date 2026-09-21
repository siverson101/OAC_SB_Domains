# Review lessons — PR #3 (Phase 2b: the five ability families)

A record of what six rounds of code review on PR #3 taught us, so the same classes of issue don't
recur. Each lesson names the concrete case that exposed it and the convention that now prevents it.

## Recurring themes

### 1. One source of truth per fact — duplicates drift
The same fact was declared in several places and silently diverged:
- `safetyGate` keys lived in the JSON schema, `SAFETY_GATE_KEYS`, five per-family test files, and the
  command frontmatter.
- `ACT_SAFETY_GATES` (runtime) duplicated the per-ability frontmatter declaration.
- Ability name lists were declared twice per module (union + array).

**Convention:** declare each fact once and derive/reference it. `SAFETY_GATE_KEYS` lives in
`tools/shared/safety-gate.ts`; `ACT_SAFETY_GATES` is cross-checked against the parsed frontmatter in
`tests/unity-act.test.ts`. When a fact must be duplicated (JSON schema vs TS), add a test that asserts
the two agree.

### 2. A contract governs runtime output, not just declarations
Tightening the `safetyGate` schema to `additionalProperties: false` was pointless while the runtime
envelopes still emitted `requireConfirm`/`approved` (non-schema keys). The tests only validated
frontmatter, so CI stayed green.

**Convention:** test the **runtime** shape against the schema. `tests/safety-gate.test.ts` runs an
ability from every family and asserts `Object.keys(result.safetyGate) ⊆ SAFETY_GATE_KEYS`.

### 3. Guard before you build
`runRuntimeAbility` constructed a `command` array before the "requires `--code`" refusal, and
`scene-editing` computed an `escalation.rung` before rejecting an unknown change kind. A caller reading
the side-value got a real-looking result for an invalid input.

**Convention:** compute side-effectful/actionable values **lazily on the success path**; on
`refused`/`unavailable`/`unknown`, omit them (or make them `null`). Emit `command` only when
`status === 'observed_locally'`.

### 4. Honesty over convenience
`stale: false` was reported when there was no script evidence (a false green); `noOpRecompile: null`
with no `staleReason` gave no explanation. This is the same class the Verify family's delta rules exist
to prevent.

**Convention:** `null` means "not computed", never "clean". Every indeterminate state carries a
`staleReason`/`validateScanFailed`/`compilePending` style explanation. Don't assert a negative you
can't evidence.

### 5. Fail-soft must be uniform across sync and async
`cli-bootstrap` guarded a throwing **async** handler but let a throwing **sync** handler escape. The
`never` exhaustiveness throws made that reachable.

**Convention:** guard both paths; a throwing handler is reported with a message + `process.exitCode = 1`.
Unknown CLI inputs surface as errors, never silent defaults (e.g. `rejectPositionals`).

### 6. Canonical inputs for hashing and comparison
The prefab dry-run receipt hashed `JSON.stringify({prefab, ops})`, so key order changed the hash and a
valid apply was refused.

**Convention:** hash a canonical projection (recursively sorted keys), keep the full payload bound, and
distinguish "no receipt" from "input changed" in the diagnostic.

### 7. No synchronous spin locks
`Atomics.wait` with a hard CPU-spin fallback pegged the CPU for the whole wait.

**Convention:** async `setTimeout` polling with an explicit cap (`MAX_WAIT_SECONDS = 60`), and a pure
`clampWaitSeconds` that is unit-tested without wall-clock.

### 8. Generated artifacts need a marker and a drift check
Bundles under `xdomains/scripts/**` are committed build output.

**Convention:** `.gitattributes` marks them `linguist-generated -diff text eol=lf`, and
`bun run build:check` regenerates and `git diff --exit-code`s them. Any new generated path must be
registered in `.gitattributes` (noted in `package.json`).

### 9. Single enforcement points for conventions
The schema says "absent `safetyGate` flag = false", but nothing consumed it.

**Convention:** put the convention behind one helper — `safetyGateFlag(gate, key)` in
`tools/shared/safety-gate.ts` — rather than five ad-hoc `gate.x === true` checks.

### 10. Layer shared helpers in shared modules
`parseOptionalPositiveInt` lived in `unity-compose/src/shared.ts` while a comment elsewhere pointed at
it — a layering smell. `canonicalize` was trapped inside `unity-act/src/prefab.ts`.

**Convention:** cross-family helpers live in `tools/shared/` (`cli-args.ts`, `json-helpers.ts`,
`result-envelope.ts`, `cli-bootstrap.ts`, `safety-gate.ts`, `tool-routing.ts`); family modules supply
only their ability list + renderer.

### 11. Document the semantics you rely on
`stoppedAtFile` didn't say what it was relative to; `safetyGate` absence didn't say "treat as false";
the `-diff` bundles surprise anyone running `git diff`.

**Convention:** state units/relativity/absence semantics in the type or schema description, and note
tooling tradeoffs where a developer will hit them.

### 12. Normalize paths consistently
`findLiveInstance` lowercased one side of a Windows path comparison but not the other, and didn't
normalize separators.

**Convention:** compare paths through the same helper (`toPosix(...).toLowerCase()`) on both sides.

## Process notes

- **Root-cause fixes beat surface patches.** The `safetyGate` boolean drift traced back to
  `frontmatter.ts` `quoteBareWords` over-quoting `true`/`false`/`null`; fixing the parser fixed every
  family at once.
- **`bun test` does not typecheck.** A cast that typechecked nowhere still passed `bun test`; always run
  `bun run typecheck` (and `build:check`) before committing.
- **The first two rounds carried the substantive bugs** (contract violation, safety-gate bypass,
  spin-lock, false-green); later rounds were polish (shared helpers, doc clarity, single enforcement
  points). Front-load the correctness review.
- **Test the invariant, not the implementation.** The tests that mattered asserted a *property*
  (runtime keys ⊆ schema keys; table mirrors frontmatter; clamp bounds) rather than restating the code.

## Behaviour changes on record (Phase 3)

- **`frontmatterStringArray` — mixed array now filters instead of rejecting.** It changed from
  "return the array only if every entry is a string, otherwise `undefined`" to "non-array → `undefined`;
  array → keep the string entries and drop the rest". So `[unity-read-project, 3]` now yields
  `['unity-read-project']` instead of `undefined`. Reason: edge hygiene — one stray non-string entry
  (e.g. a numeric id) used to discard every valid id in the same frontmatter field, and the failure was
  silent. Dropping only the invalid entries keeps the contract usable while still ignoring a wholly
  wrong type. Pinned by `tests/capability-contract.test.ts`.
