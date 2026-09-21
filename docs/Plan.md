# OAC Unity Domain — Implementation Plan

_Companion to `docs/Requirements.md`. This is the phased, step-by-step plan for Goals 4–9 (Goals 1–3
are done). Each phase lists goals, requirements, and tests; each step lists the context (files,
methods, formats to check) and completion criteria. Optional parts that can be swapped out are
marked **[swap]** and summarised in the table below._

_Last updated 2026-09-19. Decisions this plan encodes live in `docs/adr/` (0011–0018) and in
`C:\Users\siver\Dev\.scratch\unity-domain-roadmap\` (tickets 08–15)._

---

## How to read this plan

- **Source of truth:** `docs/Requirements.md` (what/why) + this plan (how/when).
- **Layout:** sources under `tools/<area>/`, shipped bundles under `xdomains/scripts/<area>/`
  (source is never shipped — ADR-0007). Sub-domains under `xdomains/game-dev/unity-{2d,3d,xr}`.
- **Verification:** `bun run build && bun run typecheck && bun test tests` + the Goal-1 shell suites
  (`bash tests/test-*.sh`). The opt-in Editor E2E is `OAC_UNITY_E2E=1 OAC_UNITY_PROJECT=<path>
  bun test tests/editor-e2e.test.ts`.
- **Fail-soft rule:** everything a stage-3 hook runs must be offline, read-only, and never fail a
  build (matching the Goal-2/3 convention).

## Optional / swap-out parts

| Part | Swap mechanism | Default |
|------|----------------|---------|
| Agent hierarchy | `Lean` vs `Full Studio` (`.opencode/unity-studio.json`) | Lean |
| TDD specialist + FTF workflow | TDD toggle in the pattern config | off |
| Native-plugin specialist | native sub-project detected by `sub-projects.ts` | auto |
| Unity CLI runtime (pipeline + stdio MCP) | Unity CLI availability | CLI direct; MCP optional (Phase 6) |
| Visual verification gate | always-on per ticket 12 | on |

---

## Phase 1 — Capability contract & registry foundation

**Goals:** establish the uniform contract every capability carries and the tool/ability/command
layering, and extend the registry so composition edges are machine-readable. This is the substrate
every later phase builds on.

**Requirements:** FR2 (registry), the unified capability contract (ADR-0012), the
tool/ability/command split (ticket 14).

**Tests:** contract schema validation (fixtures + invalid cases); registry build golden-file test;
typecheck.

### Step 1.1 — Define the capability contract schema

- **Context:** `tools/shared/registry/src/frontmatter.ts` (current frontmatter reader), the
  `primitive.yaml` schema from `C:\Users\siver\Dev\unity-skills\schema\primitive_schema.yaml`
  (fields: `id`, `summary`, `requires`/`provides`, `compatible_primitives`/`conflicts_with`,
  `setup_steps`, `test_plan`, `failure_modes`, `code_files`). Add the OAC-specific fields:
  `family` (`sense|act|verify|run|compose`), `mode` (`offline|live|both`), `inputs`, `outputs`,
  `sideEffects`, `safetyGate`, `versionCompatibility`, and composition edges (`uses`, `usedBy`,
  `provides`, `requires`). Follow the camelCase JSON-key + kebab-case file conventions in
  `docs/Requirements.md` §Naming conventions.
- **Completion:** a versioned JSON schema (e.g. `xdomains/context/capability-contract.schema.json`)
  committed and referenced; `bun run typecheck` green.

### Step 1.2 — Tool / ability / command layering

- **Context:** `docs/adr/0004-abilities-map-to-commands.md`, the `sb-domain.json` `paths` +
  `abilities` + `tools` blocks (`xdomains/game-dev/unity-3d/sb-domain.json`), and the unimplemented
  `unity-cli-wrapper` tool placeholder. Establish the rule: **tool** = thin typed adapter (no
  workflow logic), **ability** = named capability composing tools, **command** = user-invocable entry
  realising an ability. Encode this as a naming/layering rule in the registry doc generator.
- **Completion:** `xdomains/scripts/shared/build-registry.mjs` distinguishes tool/ability/command rows
  with the layering noted; a short `docs/` note or ADR update captures the rule.

### Step 1.3 — Registry edge recording

- **Context:** `tools/shared/registry/src/{build,render,index}.ts` (the FR2 generator), the existing
  `registry.md`/`registry.json` output shape (`xdomains/game-dev/unity-3d/registry.md`). Extend the
  generator so it also records `workflow↔ability`, `workflow↔agent`, and `agent↔ability` edges from
  the frontmatter allowlists and workflow declarations (tickets 10, 13).
- **Completion:** `bun run build` regenerates `registry.json` + `registry.md` with an "Edges" section;
  a golden-file test in `tests/` asserts the shape.

---

## Phase 2 — Capabilities (five families) & the Unity CLI runtime

**Goals:** realise the five ability families over the Unity CLI pipeline + stdio MCP runtime, and fold
the gather data-collection extensions into the stage-3 pipeline.

**Requirements:** FR1/FR3, ticket 14 (Unity CLI pipeline + stdio MCP; no new MCPs, no custom bridge),
ticket 09 (five families), ticket 11 (offline-first), ADR-0017.

**Tests:** per-producer unit tests (Bun); a `--gate` run against PuppetTree; offline-reader fixtures;
typecheck.

### Step 2.1 — Unity CLI runtime: pipeline + stdio MCP + on-disk exchange + offline readers

- **Context:** `tools/shared/toolchain.ts` (`run`), `tools/unity/gather-unity-context/src/producers.ts`
  (`runCli`, the `CliEnvelope`), `tools/unity/gather-unity-context/src/scratch.ts` (evidence dir),
  ADR-0017. Drive the live Editor through the Unity CLI: `unity command` / `unity eval` (the Pipeline
  package's local server, preferred) or the CLI's stdio MCP (`unity mcp`) when shell execution is not
  viable. **Do not build a custom localhost HTTP bridge.** Routing classes `live|batch|offline|local`.
  `unity mcp configure --list` reports the CLI's MCP client config; never invoke bare `unity mcp` (it
  starts a stdio server).
- **Completion:** a `tool-routing` module (or extension of `toolchain.ts`) that selects the route and
  records which route served a result (including the live transport `cli|mcp`); unit tests for the
  offline vs live fallback.

### Step 2.2 — Gather extensions (hook 3 data collection)

- **Context:** `tools/unity/gather-unity-context/src/{index,structure,producers,gate,types}.ts`.
  Add six offline, read-only producers and their `project-data/` outputs + `context-projections.json`
  entries (mirroring §3.4 of Requirements.md):
  1. **compile-state** — `Library/ScriptAssemblies/*.dll` mtimes + `Editor.log` authorship → detect
     stale/no-op recompile (Unity-Open-MCP dim 18).
  2. **log-digest** — parse `Editor.log`/`Editor-prev.log` for errors/warnings (offline).
  3. **project-settings** — scripting backend, IL2CPP, target platform, color space, graphics API,
     `persistentDataPath`, `activeInputHandler` from `ProjectSettings/ProjectSettings.asset`.
  4. **asmdef-map** — `.asmdef` graph, `.Tests.asmdef`, Edit/Play targets, `InternalsVisibleTo`.
  5. **test-inventory** — test assemblies + counts, last `TestResults.xml` summary, visual-verification
     results + screenshot paths.
  6. **deprecation-scan** — scan `.cs` against a `deprecated-patterns.json` map
     (`FindObjectOfType`→`FindFirstObjectByType`, …).
- **Completion:** each producer has a fixture test under `tests/`; a full `gather-unity-context.mjs
  --project-root .` run emits the new JSON + projected `.md`; run stays fail-soft when offline.

### Step 2.3 — Sense family

- **Context:** `tools/unity/gather-unity-context/src/structure.ts` (extend for content-level reads).
  Implement `project-status`, `asset-intelligence`, `offline-project-inspection`, `unity-api-lookup`,
  `platform-info`, `code-navigation` as `mode: offline` abilities backed by JSON tables
  (`xdomains/context/unity/*.json`) and the new offline readers.
- **Completion:** each ability declared in `sb-domain.json` and realised as a command (ADR-0004);
  offline-reader unit tests; `code-navigation` reads source/asmdefs with no Editor.

### Step 2.4 — Act family

- **Context:** scene-editing escalation (ADR-0018), AIBridge `prefab patch --dryRun`
  (`C:\Users\siver\Dev\AIBridge\Editor\Commands\PrefabCommand.cs`), unity-coding-skills scene-via-
  editor-script (`skills/edit-scene`). Implement `scene-editing`, `prefab-automation`,
  `script-scaffolding`, `shader-helper`, `pattern-library`, `input-automation`. Scaffolding/API/shader/
  platform tools are reimplemented from Unity-Developer-Tools' data shapes, **not copied** (CC
  BY-NC-ND — design reference only).
- **Completion:** inspector→`prefab patch --dryRun`→YAML escalation works; a dry-run unit test and a
  gate run for a mutating edit.

### Step 2.5 — Verify family

- **Context:** `tools/unity/gather-unity-context/src/gate.ts` (`runGate`, `parseNUnit`), ADR-0015.
  Implement `compile-and-verify-project`, `run-edit-mode-tests`, `run-play-mode-tests`, `gate-review`
  with the checkpoint→mutate→validate→delta model and honesty rules.
- **Completion:** gate produces a bounded delta (`newIssues`/`resolvedIssues`) with `null`-vs-clean
  and `compilePending` honesty; `gate-state.json`/`unity-verification-report.json` still valid.

### Step 2.6 — Run family

- **Context:** ADR-0015/0018, AIBridge `unity-change-implementation` recipe, UAX profiling commands
  (`Runtime/Profiling/*.cs`). Implement `unity-change-loop`, `runtime-debugging`,
  `runtime-ui-validation`, `performance-diagnostics`, `uitk-interaction`. These need the Unity CLI
  live channel from 2.1; until then they're gated.
- **Completion:** the change-loop ability runs compile → `get_logs --logType Error` → tests → observe
  and cites evidence; runtime abilities report `unavailable` without a Unity CLI/Editor (fail-soft).

### Step 2.7 — Compose family + ledgers

- **Context:** ADR-0011 (coordination board), `primitive.yaml` composition (depends-on,
  wire-through-events, compatibility graph). Implement `coordination-board`,
  `primitive-composition`, `contract-aware-design`, `ci-status-baseline`. Write
  `unity-open-mcp-missing-tools.md` recording every Unity-Open-MCP tool deliberately not implemented.
- **Completion:** the coordination board writes `.opencode/coordination/board.json` + `board.md`
  (claims, leases, fail-fast, one-holder Editor hold); the missing-tools ledger exists and is updated
  in the same change as any tool skip.

---

## Phase 3 — Knowledge & building blocks

**Goals:** ship the knowledge layer (engine/middleware), snippets/templates, the primitive registry
(selective import), and the pattern-toggle config.

**Requirements:** ticket 11, FR6 (pattern toggling), LR1–LR3 (attribution), ADR-0014.

**Tests:** count-parity + frontmatter-schema checks (Unity-Developer-Tools pattern); primitive import
gate test; attribution file completeness test.

### Step 3.1 — Engine/middleware knowledge

- **Context:** `xdomains/game-dev/unity-3d/context/unity-3d/{concepts,guides,lookup,examples,errors}`
  and `xdomains/context/unity/*.json`. Add `knowledge/engine/` and `knowledge/middleware/` prose
  references plus JSON tables (API quick-ref, deprecation map, platform defines, shader properties,
  lifecycle order), version-gated per Unity 6.0/6.3/6.5/LTS. Content is authored fresh (no CC-BY-NC-ND
  copying); "verify against primary sources" rule.
- **Completion:** a version dispatch (like `unity-modern-guidelines.md`) selects the right knowledge
  file for the detected Unity version; count-parity test passes.

### Step 3.2 — Snippets & templates

- **Context:** snippet = single file + header comment; template = directory + README + scripts.
  Sources: `C:\Users\siver\Dev\unity-skills\primitives\` (MIT, gated) and original content.
- **Completion:** snippet/template folders under `context/<sub-domain>/` are enumerated in the
  registry with a `standards-version`; schema check passes.

### Step 3.3 — Primitive registry (selective import)

- **Context:** `C:\Users\siver\Dev\unity-skills\schema\primitive_schema.yaml`, `PROVENANCE.md`
  (62 primitives → 30 upstream repos; GPL/LGPL clusters flagged). Import license-clear primitives
  into `xdomains/game-dev/<sub-domain>/primitives/`, each a directory with `primitive.yaml` + code.
  Gate out GPL/LGPL; record every skipped primitive in `primitive-not-imported.md` (reason + revisit).
- **Completion:** an import gate rejects GPL/LGPL ids; the ledger lists every skipped id; imported
  primitives pass a Roslyn-style compile check.

### Step 3.4 — Pattern toggles (config + resolver)

- **Context:** `xdomains/context/programming-patterns.json` (categories, selection modes,
  `conflictsWith`), `project-pref.json`. Add `.opencode/unity-studio.json` holding enabled patterns +
  packages + toggles (TDD/FTF) + `studioMode` + `reviewIntensity`. A resolver validates single-selection
  / mutually-exclusive / conflict rules and feeds code generation + the registry.
- **Completion:** the resolver surfaces conflicts (never silently chooses) — unit-tested against the
  pattern catalog's own `conflictsWith` edges.

### Step 3.5 — Attribution (LR1–LR3)

- **Context:** `docs/Attribution.md` (central file). Record the five MIT repos + `unity-coding-skills`
  (Unlicense) with holder + license text; note `Unity-Developer-Tools` (CC BY-NC-ND) is design-reference
  only. Add per-file headers on any substantial adapted source.
- **Completion:** `docs/Attribution.md` lists every imported component; a test asserts each
  imported/reused file carries the required notice.

---

## Phase 4 — Agents & coordination

**Goals:** deliver the two mutually-exclusive hierarchies, the selection mechanism, and the
coordination board wired to agents.

**Requirements:** ticket 10, FR7, ADR-0011/0013.

**Tests:** apply-engine install tests for each hierarchy; board claim/lease/hold tests; routing-table
snapshot test.

### Step 4.1 — Lean hierarchy (refine existing)

- **Context:** `xdomains/game-dev/unity-3d/agent/unity-3d-orchestrator.md` + `agent/subagents/unity/*.md`,
  `sb-domain.json` `subagents`. Add the optional `UnityTddSpecialist` (TDD toggle) and
  `UnityNativePlugin` (native sub-project) roles with frontmatter `abilities:` allowlists + a
  Delegation Map.
- **Completion:** the 7 existing specialists + gated extras declare allowlists; registry records
  agent↔ability edges.

### Step 4.2 — Full Studio hierarchy

- **Context:** `C:\Users\siver\Dev\claude-unity-game-studio\game-studios-template\.claude\agents\`
  (director→lead→specialist, Delegation Map). Reimplement a representative ~16–18-agent set (4
  directors, 4 leads, ~8–10 specialists) under `xdomains/game-dev/<sub-domain>/agent/full-studio/`.
- **Completion:** the full-studio set installs cleanly; each agent has a Delegation Map + allowlist;
  role-scoped permissions (directors never write code) encoded.

### Step 4.3 — Selection mechanism

- **Context:** `xdomains/merge-domains.js` (apply engine), stage-3 hook. `/build-context-system` asks
  "Studio mode: Lean | Full Studio"; writes `.opencode/unity-studio.json`; the apply engine installs
  exactly one set (mutually exclusive). Shared context/commands/abilities are unaffected.
- **Completion:** an apply test asserts installing `lean` yields no `full-studio/` agents and vice
  versa.

### Step 4.4 — Coordination board

- **Context:** ADR-0011, UAX `Editor/Coordinator/{UacBoard,UacClaimRegistry,UacSessionManager}.cs`.
  Implement the on-disk board (claims, leases, fail-fast naming the holder, one-holder Editor hold)
  and wire the orchestrator/sub-agents to claim before writes.
- **Completion:** a claim conflict fails fast naming the holder; leases auto-expire; the Editor hold
  serialises compile/test/capture.

### Step 4.5 — Allowlists, delegation maps, model tiering

- **Context:** agent frontmatter (`mode`, `temperature`, `permission`, `model`). Assign a model per
  role tier (Flash for routing/leads, Pro for specialists). Registry records agent↔ability edges
  from allowlists.
- **Completion:** a routing-table snapshot test asserts the orchestrator routes by the registry.

### Step 4.6 — Swap command (later, optional)

- **Context:** ADR-0013. `/unity-studio-mode <lean|full>` backs up the current agent set, installs the
  other, preserves project-data/context/commands/abilities, updates the mode config + registry.
- **Completion:** a round-trip lean→full→lean preserves project-data and registry integrity (test).

---

## Phase 5 — Testing & gates

**Goals:** implement the gate/verify flow, the TDD toggle, test plans/dedup, and visual verification.

**Requirements:** FR4, ticket 12, ADR-0015.

**Tests:** gate delta honesty tests; TDD workflow (red→green→refactor) test; dedup merge test; visual
verification extraction test.

### Step 5.1 — Gate/verify (checkpoint → mutate → validate → delta)

- **Context:** `tools/unity/gather-unity-context/src/gate.ts`, ADR-0015. Add mandatory change scope,
  a checkpoint, post-mutation validation, and a bounded delta with honesty rules.
- **Completion:** a mutation that introduces a compile error reports `newIssues` with the delta;
  a no-op reports `null` (not "clean").

### Step 5.2 — Named gates + strictest-wins + review intensity

- **Context:** `context/unity-3d/lookup/validation-rules.md` (existing gates). Extend to compile,
  EditMode/PlayMode, scene/asset, build, performance; add `externalVerdict` and `full|lean|solo`.
- **Completion:** a multi-gate run folds verdicts strictest-wins; `reviewIntensity` skips gates at
  `lean`/`solo`.

### Step 5.3 — TDD toggle + test-first workflows

- **Context:** unity-coding-skills `skills/plan-feature`, `skills/fix-bug`
  (`STATUS: OK/NG`, `TESTABILITY: PASS/WARN/FAIL`); design reference for the workflow rules is the
  workspace `MattSkills/skills/engineering` set (`to-spec`, `tdd`, `to-tickets`, `wayfinder`).
  Implement `failing-test-first` and `plan-feature` (test-designer → failing-test-writer) behind the
  TDD toggle. TDD off still requires tests (FR4).
- **Plan artifact:** `plan-feature` emits a plan file (not a Claude-Code plan-mode toggle — OAC has no
  plan mode). Sections, adapted from the reference plus `to-spec`/`tdd`: **Context**, **Implementation
  Design** (seams, class/method signatures, file placement), **Test Cases** (Editor/Unit/Integration/
  Visual/Manual, pasted verbatim from test-designer), **Testing Decisions** (the seams under test, what
  makes a good test, prior art), **Testability Assessment** (`PASS`/`WARN`/`FAIL`, one retry then
  abort), **Known Trade-offs**, **Development Workflow**.
- **TDD loop rules (from `tdd`):** red before green; one vertical slice (one seam, one test, one
  minimal implementation) at a time; tests at pre-agreed public seams only; refactoring belongs to
  review, not the loop; reject implementation-coupled, tautological, and horizontally-sliced tests.
- **Completion:** `plan-feature` emits the plan artifact; FTF returns `STATUS: OK/NG` and aborts on NG;
  the red step confirms the test fails for the expected reason.

### Step 5.4 — Test plans & dedup

- **Context:** `test_plan` field (Step 1.1), per-feature `test-plan.md`. Dedup runs over the suite
  (name/assertion comparison), merges/removes redundant tests, records an artifact. A duplicate is
  **same condition + same assertion**; never trade coverage for tidiness; never merge same-condition
  tests into one multi-assert test (from the `tdd` anti-patterns and unity-coding-skills
  `test-deduplicator`).
- **Completion:** a dedup run on a fixture suite with two redundant tests removes one and records the
  removal.

### Step 5.5 — Visual verification

- **Context:** unity-coding-skills `extract-visual-verification.py` (pull `[Category("VisualVerification")]`
  results + screenshot paths from `TestResults.xml`). Wire as a gate/observe step.
- **Completion:** a visual test produces a screenshot artifact; the gate asserts the screenshot exists.

---

## Phase 6 — Workflows & change loop

**Goals:** ship the lifecycle commands, the recipe/catalog, the change loop, prefab/scene automation,
the Unity CLI runtime, and the code index.

**Requirements:** tickets 13, 15, ADR-0016/0018.

**Tests:** recipe execution tests; change-loop E2E (opt-in Editor); prefab-patch dry-run test; runtime
handshake test.

### Step 6.1 — Lifecycle commands

- **Context:** `xdomains/game-dev/unity-3d/command/*.md`. Add `/unity-setup`, `/unity-brainstorm`,
  `/unity-plan`, `/unity-implement` (absorbs `unity-feature`), `/unity-debug`, `/unity-polish`,
  `/unity-review`; keep domain commands and add runtime loops (`/unity-runtime-target`,
  `/unity-prefab-sweep`, `/unity-performance`).
- **Completion:** each command routes to the orchestrator and loads the right context per
  `navigation.md`.

### Step 6.2 — Recipe schema + lifecycle catalog

- **Context:** AIBridge `Templates~/Workflows/*.aibridge-workflow.json` (phases/steps/gates/
  artifacts), claude-studio `workflow-catalog.yaml`. Define the recipe schema (Step 1.1 fields) and a
  `workflow-catalog` with the 7 phases (Concept → … → Release), each step = command + artifact check.
- **Completion:** a recipe validator rejects malformed phases/steps; the catalog's artifact checks are
  machine-evaluable.

### Step 6.3 — Change loop

- **Context:** ADR-0015/0018, `runGate`, the gather `compile-state` producer. Codify resolve → inspect
  → smallest change → compile → logs → tests → observe as an ability + recipe with named gates.
- **Completion:** the loop cites evidence (compile state, logs, test results, screenshot) and refuses
  "done" without green tests.

### Step 6.4 — Prefab/scene automation

- **Context:** ADR-0018 escalation. `inspector`/`SerializedProperty` edits → `prefab patch --dryRun`
  (JSON ops: ensure_child/ensure_component/set_property/…) → `unity-yaml-editing` fallback.
- **Completion:** a dry-run proposes ops without mutating; a non-dry-run applies and rolls back on
  new errors.

### Step 6.5 — Runtime via the Unity CLI

- **Context:** the Unity CLI Pipeline Runtime server (`unity command` runtime handlers / `unity mcp`),
  AIBridge runtime plane (`Runtime/*`), ADR-0018. Player discovery, logs, screenshots, performance
  sampling, UI snapshot/find/click/key, runtime handlers. Runtime code execution sits behind an
  explicit approval gate.
- **Completion:** a Unity CLI runtime handshake test against a built Player; runtime code execution
  requires approval.

### Step 6.6 — Code index

- **Context:** AIBridge `code_index`. Implement as a Sense ability — offline symbol/declaration lookup
  over source/asmdefs.
- **Completion:** a lookup returns symbol/declaration with file:line; works with the Editor closed.

---

## Phase 7 — Version conditionals & hardening

**Goals:** support Unity 6.0/6.3/6.5/LTS conditionals, ship the swap command, and keep attribution and
docs in lockstep.

**Requirements:** FR5, FR8, LR3, ADR-0013.

**Tests:** version-matrix tests per Unity version path; swap round-trip; doc-drift check.

### Step 7.1 — Version matrix (6.0/6.3/6.5/LTS)

- **Context:** `xdomains/game-dev/unity-3d/sb-domain.json` `compatibility.unity_versions`. Centralise
  version-gated seams (cf. Unity-Open-MCP `InstanceId.cs` pattern); declare `versionCompatibility` on
  capabilities; feature-flag per version.
- **Completion:** a capability declares its version range and fails gracefully on mismatch; a matrix
  test asserts each supported version's feature flags.

### Step 7.2 — Swap command

- **Context:** Step 4.3/4.6. Ship `/unity-studio-mode <lean|full>`.
- **Completion:** round-trip preserves project-data/context/commands/abilities and updates the mode
  config + registry (tested).

### Step 7.3 — Attribution upkeep & docs

- **Context:** `docs/Attribution.md`, `docs/Requirements.md`, generated docs under `.opencode/`
  (registry, blueprint, category system, pattern toggles, version matrix). Update attribution whenever
  upstream code is imported/modified (LR3).
- **Completion:** a drift check (declared counts == files on disk, like Unity-Developer-Tools'
  count-parity job) passes; the registry and docs regenerate cleanly.

---

## Test matrix (summary)

| Phase | Key tests |
|-------|-----------|
| 1 | contract schema validation; registry golden-file; typecheck |
| 2 | per-producer fixtures; `--gate` run; offline-reader fallback |
| 3 | count parity + frontmatter schema; import gate; attribution completeness |
| 4 | apply per-hierarchy; board claim/lease/hold; routing snapshot |
| 5 | gate delta honesty; TDD red→green→refactor; dedup; visual extraction |
| 6 | recipe validation; change-loop E2E (opt-in); prefab dry-run; runtime handshake |
| 7 | version matrix; swap round-trip; doc-drift |
