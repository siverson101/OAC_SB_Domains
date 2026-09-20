# OAC Unity Domain — Requirements

_Last updated 2026-09-19. This is the current source of truth for the OAC Unity domain. The
conversation history lives in `ReqDocConvo.md` and `Requirements2.md`._

## Naming conventions

Applies to all new code, data files, and documentation (see `CONTRIBUTING.md`):

- **Files and folders:** kebab-case (`scan-project.mjs`, `package-choices.json`).
- **JSON keys:** camelCase (`packageNames`, `prettyName`, `unityVer`).
- **TypeScript:** PascalCase types/interfaces, camelCase variables/functions, SCREAMING_SNAKE_CASE
  constants (`EXCLUDE_FOLDERS`, `MAX_DEPTH`).

### Domain asset naming (OAC)

| Asset | Identifier | Display / invocation |
|-------|-----------|----------------------|
| Agent | kebab-case id (`unity-3d-orchestrator`) | PascalCase frontmatter `name` (`Unity3DOrchestrator`) |
| SubAgent | kebab-case file/id (`implementer`) | PascalCase `name` (`UnityImplementer`), used as `subagent_type` |
| Command | kebab-case file (`unity-feature.md`) | slash name = filename (`/unity-feature`) |
| Ability | kebab-case (`unity-build`, `gather-unity-context`) | realised as `command/<ability>.md` (ADR-0004) |
| Tool | kebab-case id (`unity-cli-wrapper`) | PascalCase TS const (`UnityCliWrapperTool`) |

Existing declared abilities (`unity-read-project`, `unity-build`, `unity-run-tests`) already follow
this. All ability, command, and tool references below are kebab-case.

## Status at a glance

| Goal | Summary | Status |
|------|---------|--------|
| 1 | Unity sub-domain installs into `.opencode/` via `/build-context-system` | **DONE** |
| 2 | Stage-3 project scan and user preferences | **DONE** |
| 3 | `gather-unity-context` — port DevTools automation + project-structure scanners | **DONE** |
| 4 | Capability system — five families, unified contract, Unity CLI runtime | Planned |
| 5 | Asset intelligence & offline reads — gather extensions + content-level readers | Planned |
| 6 | Knowledge & building blocks — knowledge, snippets, primitives, pattern toggles | Planned |
| 7 | Agents & coordination — Lean + Full Studio, selection, coordination board | Planned |
| 8 | Testing & gates — gate/verify, TDD toggle, test plans, dedup, visual | Planned |
| 9 | Workflows & change loop — recipes, change loop, prefab/scene, runtime bridge | Planned |

---

## Goal 1 — Domain installation (DONE)

Selecting `unity-2d | unity-3d | unity-xr` in `/build-context-system` installs the sub-domain into
`.opencode/`.

Shipped and verified:

- Installer: `install.sh` copies `xdomains/` into `<opencode-dir>/xdomains/`.
- Apply engine: `xdomains/merge-domains.js` (reads `sb-domain.json`, copies declared assets,
  registers agents, realises abilities as commands — ADR-0004).
- Sub-domains: `xdomains/game-dev/unity-3d`, `unity-2d` (full), `unity-xr` (placeholder).
- Per sub-domain: orchestrator, 7 specialist subagents, 9 commands, a function-based context
  library, `registry.md`, and `context-projections.json`.
- Tests: `tests/test-domain-hooks.sh`, `tests/test-discover-xdomains.sh`,
  `tests/test-merge-domains.sh`, `tests/merge-domains.test.js`.

## Goal 2 — Stage-3 scan and preferences (DONE)

### What shipped

**Context data** (`xdomains/context/`, shipped with the domain):

| File | Purpose |
|------|---------|
| `filetypes.json` | Extension → language/asset display name. |
| `programming-patterns.json` | Pattern catalog + categories (single/multiple selection, conflicts). |
| `programming-style-types.json` | Individual style flags (`flagId`, `llmRule`, `whenToUse`). |
| `programming-styles-presets.json` | Language presets (`flagIds`) such as UnityC#, C++, Python, JS/TS, UXML, USS, Shader. |
| `unity/package-choices.json` | Decision points; rows list trigger `packageNames` and a `prompt`. |
| `unity/understood-package-categories.json` | Package id → `category` + `prettyName`, incl. synthetic `com.unity.builtin.*`. |

**Scanner** (`tools/project-scan/src/` → bundled `xdomains/scripts/scan-project.mjs`):
SOLID modules — `cli`, `io`, `types`, `prompt-client`, `project-name`, `asset-folder`,
`project-files`, `unity-packages`, `package-choices`, `patterns-interview`, `toolchain`,
`sub-projects`, `project-meta`, `gather-unity-context`, `index`.

**Prompt UI** (`tools/prompts/src/prompt.mjs` → `xdomains/scripts/prompt.mjs`): clack-based generic
question runner; the scanner spawns it and consumes JSON answers.

**Outputs** (per scanned project):

- `.opencode/project-data/` (finished projection inputs): `unity-project.json`,
  `unity-package-list.json` (DevTools-parity schema v2), `native-project-state.json`
  (DevTools-parity schema v1), `project-pref.json`, `project-files.json`, `scan-result.json`.
- `.opencode/xdomains/context/project/` (intermediates / combined): `unity-packages.json` (raw
  name→version map), `project.json` (`{ schemaVersion, generatedAt, project: { name, path, …,
  native, subProjects } }`).

**Wiring:** stage-3 hooks (`unity-3d` and `unity-2d`) run the scanner fail-soft before the use-case
questions; `context-projections.json` (both) gained `preferences.md` and `files.md` and refreshed
`unity-project.json`/`unity-package-list.json` fields; `sb-domain.json` declares
`build-project-context.js`.

**Behaviour:**

- Project name defaults to the install folder; user may rename.
- `excludeFolders` = `Packages, Plugins, Library, Text Mesh Pro, ThirdParty`.
- Assets root discovery: `Assets/` → single `*/Assets` → single `*/*/Assets` → all `Assets`
  (ask if >1) → else `foundProject = false`.
- Package detection prefers the `unity` CLI (`unity projects info --json`, `unity env --json`,
  `unity --version`) with filesystem fallback (`ProjectVersion.txt`, `manifest.json`,
  `packages-lock.json`, `ProjectSettings.asset`).
- Synthetic builtins: `com.unity.builtin.input_manager` when legacy input is used in code or
  `activeInputHandler` ∈ {0,2}; `com.unity.builtin.camera` always.
- `ui`, `editor_ui`, and `test-methodology` are deferred to Stage 4 (`deferToStage4: true`); the
  scanner records candidates only.
- Fail-soft: non-interactive (`--non-interactive` / `--answers <file>`) and cancel never fail a
  build.

**Tests:** `tests/project-scan.test.ts` (14 tests) + the Goal 1 suites + `bun run typecheck`.

**Domain docs:** `CONTEXT.md` project-scan vocabulary; ADR-0007 (scanner ships with domains repo),
ADR-0008 (project-data split), ADR-0009 (synthetic builtin ids).

---

## Goal 3 — `gather-unity-context` (DONE)

**Shipped:** area-split `tools/` + `xdomains/scripts/`; the `gather-unity-context` tool (structure
scanner + base-folder detection, CLI-first toolchain/commands/pipeline/MCP producers, fingerprint,
scratch, and the gate); stage-3/stage-7 hook wiring; `commands.md`/`pipeline.md`/`mcp.md`/`gate.md`/
`structure.md` projections; ability + command declared; and the registry doc generator
(`.opencode/registry.json` + `.opencode/context/<sub-domain>/registry.md`). Editor lifecycle handled:
if no Editor is running, `--gate` starts one with `-automated` and stops it afterwards. Verified
against PuppetTree (start-on-demand, 142 commands, pipeline instance, 100/100 EditMode tests, Editor
stopped). Declared abilities `unity-read-project` and `unity-run-tests` now have command files; the
static `navigation.md` points at the generated `project/` context and `registry.md`; and an opt-in
Editor E2E test (`OAC_UNITY_E2E=1`) starts and stops an Editor automatically.

### 3.1 What it is

Port `DevTools/bin/gather-automation-data.cmd` + `DevTools/scripts/gather-automation-data.ps1` (and
its producer `unity-automation-gate.ps1`) into the domains repo, and extend it with project-structure
scanners. The result is the **Unity context**: everything an agent needs to understand the project,
its toolchain, and its current quality state, projected into per-concern context files.

The `gather-unity-context` ability (function `gatherUnityContext()`) is the umbrella. It runs after
the Stage-3 scan (Goal 2) and is invoked from the Stage-7 hook today, with the goal of running
earlier so Stage 4–6 can use it.

### 3.2 Naming

`unity-automation-gate` is misleading (it is not just a gate). Chosen:

- Ability id: **`gather-unity-context`** (kebab-case per OAC; realised as
  `command/gather-unity-context.md`).
- Script/bundle: **`gather-unity-context.mjs`**.
- Function: **`gatherUnityContext()`** (camelCase TypeScript).
- Sub-producers: `scan-project-structure`, `scan-toolchain`, `run-gate`, `run-verification`,
  `inventory-commands`, `inspect-pipeline`, `inspect-mcp`.

### 3.3 Folder structure

Sources are TypeScript under repo-root `tools/`, bundled into the distributed `xdomains/scripts/`
tree (source is never shipped — ADR-0007). Organise by **what the script affects**, not the
language it is written in:

```
tools/
  unity/            # unity-affecting sources
  cpp/              # native build sources
  python/           # python tooling sources
  shared/           # prompt client, io, hashing
xdomains/
  scripts/
    unity/          # bundled: gather-unity-context.mjs, scan-project.mjs, build-project-context.js
    cpp/            # bundled native helpers
    python/         # bundled python helpers
```

Contributors add a source under `tools/<area>/` and a build entry; the bundle ships under
`xdomains/scripts/<area>/`.

### 3.4 Data outputs

Reuse the DevTools field names and status vocabulary (`observed_locally`, `documented_by_unity`,
`available_but_unverified`, `unavailable`, `unknown`) under our own versioned schema (ADR-0010) —
parity where it matters without inheriting DevTools' `rawText` escaping bug or rigid bundle shape.

Finished files → `.opencode/project-data/`:

| File | Content |
|------|---------|
| `unity-project.json` | Identity + versions (already shipped). |
| `unity-package-list.json` | Packages + lock entries (already shipped). |
| `native-project-state.json` | Native build state (already shipped). |
| `unity-command-list.json` | Editor/CLI commands available (`unity list`, `unity command`). |
| `unity-command-schema.json` | Command help/arg schema. |
| `unity-mcp-status.json` | Unity CLI MCP server/client configuration (via `unity mcp configure --list`). |
| `unity-pipeline-status.json` | Pipeline package + CLI status. |
| `unity-verification-report.json` | Compile + EditMode/PlayMode results and gate verdict. |
| `gate-state.json` | Fingerprint, gate result, review-required, hard failures. |
| `project-structure.json` | Scripts vs editor scripts, asmdefs, UXML, USS, scenes, prefabs, models, images, sprites, audio, action maps, third-party, libraries. |
| `project-pref.json` | Preferences (already shipped). |
| `scan-result.json` | Scan summary (already shipped). |

Intermediates → `.opencode/xdomains/context/project/`: raw `unity-packages.json`, combined
`project.json`, and per-run scratch.

### 3.5 Project-structure scanners

The Goal-3 scanners extend `project-files.ts` to classify the Assets root into:

- **C# scripts vs editor scripts** (distinct; editor scripts live under an `Editor` folder).
- Assembly definitions (`.asmdef`).
- UXML / USS.
- Scenes (`.unity`) and prefabs (`.prefab`).
- Models, images, sprites, audio.
- Action maps (`.inputactions`).
- Third-party assets and libraries.

**Base-folder detection:** some projects put code directly under `Assets/`, others under
`Assets/_Project` or similar. If the base folder cannot be determined confidently, ask the user.
The chosen base folder is stored in `project.json` and used to scope later scans.

### 3.6 Context projection and ContextScout

Extend `context-projections.json` with per-concern outputs and consumers:

| Output | Sources |
|--------|---------|
| `commands.md` | `unity-command-list.json`, `unity-command-schema.json` |
| `pipeline.md` | `unity-pipeline-status.json` |
| `mcp.md` | `unity-mcp-status.json` (Unity CLI MCP) |
| `gate.md` | `gate-state.json`, `unity-verification-report.json` |
| `structure.md` | `project-structure.json` |

**Project context location.** Keep the projected set under
`.opencode/context/<sub-domain>/project/`. The two alternatives collide:

- `.opencode/context/project/` is already OAC's own project context (`navigation.md`,
  `project-context.md`); the domain must not overwrite it.
- `.opencode/context/<sub-domain>/` would overwrite the sub-domain's static `navigation.md` (the
  projector writes one) and mix generated files with shipped context.

`<sub-domain>/project/` is itself an OAC-style context category (its own `navigation.md`) nested
under the sub-domain, so it is scoped and collision-free.

ContextScout must be able to discover the projected set under
`.opencode/context/<sub-domain>/project/`. The projection navigation file already lists concerns and
consumers; the registry doc (FR2) is where ContextScout learns the mapping.

### 3.7 Scratch space

Runs use `.opencode/.scratch/<sub-domain>/` for logs, temp JSON, and evidence. The folder is
gitignored and cleared per run; logs (`logs/`, `*.log`, `*.xml`) are kept as evidence, mirroring
the DevTools `logs/` behaviour.

### 3.8 Ability / command mapping

| Ability | Backed by | Notes |
|---------|-----------|-------|
| `unity-read-project` | `scan-project.mjs` | Shipped in Goal 2. |
| `gather-unity-context` | `gather-unity-context.mjs` | This goal. |
| `unity-run-tests` | `unity test` / DevTools `test.ps1` port | Later. |
| `unity-build` | `unity build` / DevTools `build-native.ps1` port | Later. |
| `unity-gate-review` | `unity-verification-report.json` + `gate-state.json` producers | Later. |

### 3.9 Resolved decisions

1. **Name** — ability `gather-unity-context`, script `gather-unity-context.mjs`, function
   `gatherUnityContext()`.
2. **Folder split** — `tools/<area>` source → `xdomains/scripts/<area>` bundle (ADR-0007).
3. **Scratch** — `.opencode/.scratch/<sub-domain>/`.
4. **Schema ownership** — our own versioned schema with DevTools field names (ADR-0010).
5. **Command inventory** — CLI-first (`unity list` / `unity command --json`), DevTools-style
   enumeration as fallback.
6. **Gate scope** — start with compile + EditMode/PlayMode + fingerprint + a simple verdict;
   review-required and command classifications come later.
7. **Invocation** — Stage 3 after the scan (fail-soft), re-run in Stage 7, cached by project
   fingerprint.
8. **Project context location** — `.opencode/context/<sub-domain>/project/` (OAC owns
   `.opencode/context/project/`; `.opencode/context/<sub-domain>/` would overwrite the sub-domain's
   static `navigation.md`).
9. **Gate execution** — if no Editor is running, start one with
   `unity open <project> --args -automated`, run tests through `unity command run_tests` (mode
   `editor`/`playmode`), then stop the Editor if we started it. A `--gate` run ensures the Editor
   *before* the producers, so command/pipeline/MCP data is live too. Batch `unity test` remains a
   last resort if the Editor cannot be started. MCP status uses the Unity CLI's `unity mcp configure
   --list`; never invoke bare `unity mcp` (it starts a stdio server).

### 3.10 Gather extensions (planned — Goal 5)

Six additional offline, read-only producers fold into the stage-3 gather pipeline (see `Plan.md`
Phase 2 Step 2.2). Each adds a `.opencode/project-data/` output and a `context-projections.json`
entry, all fail-soft and Editor-free (matching §3.9 decision 7):

| Producer | Output | Collects |
|----------|--------|----------|
| `compile-state` | `compile-state.json` | `Library/ScriptAssemblies/*.dll` mtimes + `Editor.log` authorship (stale/no-op recompile detection). |
| `log-digest` | `log-digest.json` | `Editor.log`/`Editor-prev.log` errors and warnings, offline. |
| `project-settings` | `project-settings.json` | Scripting backend, IL2CPP, target platform, color space, graphics API, `persistentDataPath`, `activeInputHandler`. |
| `asmdef-map` | `asmdef-map.json` | asmdef graph, `.Tests.asmdef`, Edit/Play targets, `InternalsVisibleTo`. |
| `test-inventory` | `test-inventory.json` | Test assemblies + counts, last `TestResults.xml` summary, visual-verification results + screenshots. |
| `deprecation-scan` | `deprecation-scan.json` | `.cs` hits against a `deprecated-patterns.json` map. |

Asset health + dependency graph (Goal 5) is heavier and lands as a Sense ability rather than a
stage-3 step.

---

## Goal 4 — Capability system (five families)

Express every Unity/MCP/devtools capability as an OAC capability under one uniform contract
(ADR-0012). Five families — **Sense, Act, Verify, Run, Compose** — over three layers: **tool** (thin
typed adapter, no workflow logic) → **ability** (named capability composing tools) → **command**
(user-invocable entry realising an ability; ADR-0004). No new MCP servers (ADR-0017); the runtime uses
the Unity CLI's built-in stdio MCP and Pipeline package. Every capability declares `family`, `mode`
(`offline|live|both`), inputs/outputs, side effects, safety gate, version compatibility, and
composition edges (`uses`/`usedBy`/`provides`/`requires`).

## Goal 5 — Asset intelligence & offline reads

Deduce project asset usage from packages + preferences + project structure, and add content-level
offline readers: compile-state, log digest, project-settings digest, asmdef/test map, test inventory,
deprecation scan (§3.10), plus asset health + dependency graph and the code index (Sense abilities).
Offline-first: work continues with the Editor closed.

## Goal 6 — Knowledge & building blocks

Engine/middleware knowledge (version-gated prose + JSON tables), snippets and templates, the
primitive registry (selective import with contracts + a `primitive-not-imported.md` ledger; GPL/LGPL
gated out — ADR-0014), and pattern toggles (a validated `.opencode/unity-studio.json` config + a
resolver over `programming-patterns.json`).

## Goal 7 — Agents & coordination

Two mutually-exclusive hierarchies — Lean (orchestrator + 7 specialists) and Full Studio (~16–18
agents: directors/leads/specialists) — selected at install (`.opencode/unity-studio.json`; ADR-0013).
Advisory coordination board (claims, leases, fail-fast, one-holder Editor hold; ADR-0011), frontmatter
ability allowlists + delegation maps, and per-tier model assignment. A later `/unity-studio-mode`
command swaps the deployed set.

## Goal 8 — Testing & gates

Gate/verify as checkpoint → mutate → validate → delta with named gates (compile, EditMode/PlayMode,
scene/asset, build, performance), honesty rules, strictest-wins, and a `full|lean|solo` review
intensity (ADR-0015). TDD/FTF optional; test design/writing/dedup/visual always-on; test plans as
data; bounded failures; visual verification as a gate.

## Goal 9 — Workflows & change loop

Lifecycle commands (`/unity-setup` … `/unity-review`) + domain + runtime loops; workflows as data
recipes + a 7-phase lifecycle catalog with artifact checks (ADR-0016); the canonical change loop;
prefab/scene automation via inspector → `prefab patch --dryRun` → YAML escalation; a Unity CLI runtime
(approval-gated code execution) and code index (ADR-0018). Unity 6.0/6.3/6.5/LTS version conditionals
(FR5) and attribution upkeep (LR1–LR3) span all goals.

---

## Functional requirements

- **FR1: Domain installation via build-context-system.** Selecting a Unity sub-domain installs the
  domain files, registers agents/commands, scans the project, and generates/updates domain docs.
- **FR2: Registry doc.** Generate a machine- and human-readable doc listing commands, abilities,
  agents, sub-agents, knowledge, workflows, gates, API lookups, rules, snippets, templates,
  examples, coordination mechanisms, primitives, contracts, and tests — each with source, consumers,
  and dependencies. Example: `test-driven-development` uses `project-status`,
  `run-edit-mode-tests`/`run-play-mode-tests`, `failing-test-first`, `test-deduplication`.
  Implemented by `xdomains/scripts/shared/build-registry.mjs`, which writes `.opencode/registry.json`
  and `.opencode/context/<sub-domain>/registry.md`.
- **FR3: Existing project detection.** Read `ProjectSettings`, `Packages/manifest.json`, editor
  version, pipeline package, FlowFramework/SOAP presence, and native DLLs; build a context model
  (Unity version, installed packages, patterns in use, test presence) accessible to sub-agents.
- **FR4: Testing requirement.** Every phase defines tests for new abilities/commands, runs them via
  Unity CLI/devtools, and respects the TDD toggle (if enabled: failing-test-first; if disabled:
  tests still required).
- **FR5: Version and conditional support.** Support Unity 6.0/6.3/6.5+ and future LTS via feature
  flags per version and explicit compatibility declarations. No deprecated in-editor Unity MCP; use
  the Unity CLI.
- **FR6: Pattern toggling.** Per project or build-context configuration to enable/disable patterns
  and packages and influence code generation (e.g. prefer FlowFramework events over DI, avoid
  Service Locator).
- **FR7: Multi-agent coordination.** Mechanisms so sub-agents can share read phases, reserve files
  or regions, exchange planned changes, and avoid or resolve conflicting writes.
- **FR8: Documentation and onboarding.** Maintain generated docs under `.opencode/`: build context,
  ability/command registry, agent-system blueprint, category system, pattern toggles, version
  matrix, and attribution.

## Licensing and attribution (MIT)

- **LR1: Attribution tracking.** For each imported MIT-licensed repo, record the copyright holder
  and license text in the central attribution file and in any redistributed source files.
- **LR2: Distribution compliance.** The installed domain includes the attribution file; copied
  source files carry the original copyright + MIT text.
- **LR3: Plan integration.** Track upstream components used and update attribution docs whenever
  upstream code is imported or modified. Central file: `docs/Attribution.md`.

## Non-functional requirements

- **NFR1:** Solo-developer ergonomics; minimal manual steps.
- **NFR2:** Modularity; abilities/commands diff-friendly and refactorable (SOLID).
- **NFR3:** Safety; gate-and-verify for mutating operations.
- **NFR4:** Extensibility; easy to add patterns, packages, abilities.
- **NFR5:** Performance; avoid heavy coordination overhead for small changes.

## Compatibility map (MCP → OAC abilities, commands, tools)

No new MCP servers: all Unity/MCP/devtools functionality is expressed as commands, abilities, and
agents, folding into the five families (Goal 4): **Sense, Act, Verify, Run, Compose**. The runtime is
the Unity CLI — the Pipeline package's local server driven by `unity command` / `unity eval`, with the
CLI's stdio MCP (`unity mcp`) as the protocol option for MCP clients — plus on-disk exchange and
offline readers (ADR-0017). No custom localhost HTTP bridge; the deprecated in-editor Unity MCP is not
used. The MCP status reporter reads the CLI's MCP client config (`unity mcp configure --list`).

| Source | Original surface | OAC mapping |
|--------|------------------|-------------|
| Unity CLI + pipeline | CLI verbs, UAX tools | Commands: `unity-build`, `unity-test`, `unity-run`, `unity-command`, `unity-status`, `unity-list`. Abilities: `gather-unity-context`, `unity-run-tests`, `performance-diagnostics`, `uitk-interaction`, `input-automation`. |
| DevTools `.cmd`/`.ps1` | compile, test, gate, native build | Commands: `devtools-*` invocations. Abilities: `compile-and-verify-project`, `run-edit-mode-tests`, `run-play-mode-tests`, `gate-review`, `build-native-sub-project`, `project-status`. |
| Unity-Open-MCP | asset intelligence, offline reads | Abilities: `asset-intelligence`, `offline-project-inspection`, `gate-and-verify-changes`. |
| AIBridge | runtime bridge, workflows | Abilities: `unity-change-loop`, `prefab-automation`, `runtime-debugging`, `runtime-ui-validation` (run through the Unity CLI runtime). |
| unity-coding-skills | skills + TDD | Abilities: `test-design`, `test-writing`, `failing-test-first`, `test-deduplication`. SubAgents: `UnityTestEngineer`, `UnityTddSpecialist`. |
| Unity-Developer-Tools | tools, rules, snippets | Abilities: `script-scaffolding`, `unity-api-lookup`, `shader-helper`, `platform-targeting`, `pattern-library`. |

## Unity CLI & Pipeline setup (prerequisites)

The runtime is the Unity CLI plus the Pipeline package. These are one-time prerequisites, needed only
if the machine lacks them — confirm before running any of them:

- **Install the Unity CLI** (skip if `unity --version` works):
  `curl -fsSL https://public-cdn.cloud.unity3d.com/hub/prod/cli/install.sh | UNITY_CLI_CHANNEL=beta bash`
  (macOS/Linux) or `brew install --cask unity-cli`.
- **Install the Pipeline package** in the project: `unity pipeline install`.

Do **not** run `unity mcp configure <client>` or `unity skill install <agent>` as part of the domain:
opencode integrates deeply through the Unity CLI directly (`unity command` / `unity eval`), so no MCP
client configuration is required. `unity mcp configure --list` is used only to *report* CLI MCP client
state. Never invoke bare `unity mcp` in a shell (it starts a stdio server).

## Phased plan

Superseded by **`docs/Plan.md`** (Goals 4–9, seven phases, each with goals/requirements/tests and
per-step context + completion criteria). Summary: Phase 1 capability contract + registry; Phase 2
five families + Unity CLI runtime + gather extensions; Phase 3 knowledge/primitives/toggles/attribution;
Phase 4 agents + coordination; Phase 5 testing + gates; Phase 6 workflows + change loop + runtime;
Phase 7 version conditionals + swap command + hardening.

## Multi-agent concurrency (resolved — ADR-0011)

Resolved 2026-09-19: **advisory on-disk coordination board + semantic ownership + file-level
serialized writes**, with a one-holder Editor hold. Claims are advisory with leases (fail-fast naming
the holder, `waitSeconds` queues); state lives at `.opencode/coordination/` (`board.json` +
`board.md`). Rejected: enforced hard locks, region/line-range locking, patch merging, lock-per-filetype,
temp git repos. See ADR-0011 and `Plan.md` Phase 4 Step 4.4.

## Resolved decisions

All Goal 3 scope decisions are settled (§3.9). Goals 4–9 decisions were settled 2026-09-19 in the
`wayfinder` effort at `C:\Users\siver\Dev\.scratch\unity-domain-roadmap\` (tickets 08–15) and recorded
as ADRs 0011–0018: coordination board (0011), unified capability contract (0012), two agent
hierarchies (0013), framework-agnostic primitives (0014), safety-gated mutations (0015), workflows
as data recipes (0016), Unity CLI pipeline + stdio MCP (0017), scene escalation + runtime approval (0018).
