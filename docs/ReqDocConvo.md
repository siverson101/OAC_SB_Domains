### Capability map from the analyzed repositories

| Source repo / system | Main contribution type | Key themes for OAC integration |
|----------------------|------------------------|--------------------------------|
| `unity-coding-skills`   [github.com](https://github.com/nowsprinting/unity-coding-skills) | Skills + subagents + TDD workflow | Test-first feature planning, failing-test writer, test deduplication, scene editing via MCP |
| `claude-unity-game-studio`   [github.com](https://github.com/IdoCohen560/claude-unity-game-studio) | Large agent hierarchy + studio skills | Director/lead/specialist hierarchy, gates, Unity knowledge/middleware skills, workflow commands |
| `Unity-Developer-Tools`   [github.com](https://github.com/TMHSDigital/Unity-Developer-Tools) | Cursor plugin + MCP server | Script scaffolding, API lookup, shader helper, platform info, rules/snippets/templates |
| `UnityCLI.AgenticExtensions`   [github.com](https://github.com/TomMoore515/UnityCLI.AgenticExtensions) | Unity pipeline extensions + UAC-MCP | Profiling, UI Toolkit tree/click, input simulation, macros, multi-agent coordination |
| `unity-skills` (primitive registry)   [github.com](https://github.com/PraveshKoirala/unity-skills) | ~560 Unity primitives + contracts | Contract-based building blocks with metadata, conflicts, test plans |
| `Unity-Open-MCP`   [github.com](https://github.com/AlexeyPerov/Unity-Open-MCP) | Full Unity MCP toolset | 250+ tools, asset intelligence, gate/verify, offline reads, CI baselines |
| `AIBridge`   [github.com](https://github.com/liyingsong99/AIBridge) | Project-local harness + CLI | Unity change loop, prefab/scene automation, runtime bridge, workflows, visual validation |

From your automation bundle, we also have devtools workflows and Unity CLI/pipeline context:

> “Run devtools compile (devtools.compile.run). Run devtools.test.editmode and devtools.test.playmode… Run application via Unity CLI editor_play + capture_game_view… Build native plugin if appropriate (devtools.build.native).”   

---

## 1. Skills, abilities, tools, agents, patterns, knowledge to harvest

#### From unity-coding-skills (test-first workflows)   [github.com](https://github.com/nowsprinting/unity-coding-skills)

- **Skill: code-writing-guide:**  
  Conventions for Unity C# coding; maps naturally to an OAC “Coding Standards” Ability.

- **Skill: test-designing-guide / test-writing-guide:**  
  Maintainable test design and writing; ideal for a TDD/TFT Ability for Unity 2D/3D/XR.

- **Skill: run-tests (Unity Test Framework via MCP):**  
  Tool surface for running EditMode/PlayMode tests; can be wrapped as OAC “RunUnityTests” tool.

- **Skill: edit-scene / unity-yaml-editing-guide:**  
  Scene/prefab editing via MCP and YAML; becomes “SceneEditing” Ability with safe-edit patterns.

- **Skill: fix-bug / plan-feature / refine-tests / resolve-diagnostics:**  
  High-level workflows for bug fixing, feature planning, diagnostics resolution; good templates for OAC “BugFixAgent”, “FeaturePlannerAgent”, “DiagnosticsAgent”.

- **Subagents:**  
  - **failing-test-writer:** writes tests that fail first.  
  - **test-designer:** designs test cases from guides.  
  - **test-deduplicator:** removes redundant tests.  
  These map directly to specialized sub-agents under a “TDD System” in OAC.

#### From claude-unity-game-studio (studio hierarchy + Unity knowledge)   [github.com](https://github.com/IdoCohen560/claude-unity-game-studio)

- **Agent hierarchy:**  
  - Directors: creative, technical, producer, art.  
  - Leads: game-designer, lead-programmer, qa-lead, etc.  
  - Specialists: gameplay-programmer, ui-programmer, performance-analyst, unity-specialist, etc.  
  This is a strong pattern for your “agent-system-blueprint” and “category-system” in OAC.

- **Studio skills (72):**  
  - **/start, /setup-engine, /adopt, /onboard** → onboarding/engine setup Abilities.  
  - **/brainstorm, /map-systems, /create-architecture, /architecture-decision** → architecture/design Abilities.  
  - **/create-epics, /create-stories, /dev-story, /story-done** → story/epic management Abilities.  
  - **/team-* (combat, ui, narrative, audio, polish, qa, level, release)** → multi-agent orchestration patterns.  
  - **/qa-plan, /test-setup, /regression-suite** → QA/TDD pipeline Abilities.  
  - **/gate-check, /release-checklist, /launch-checklist** → gate review and release Abilities.

- **Unity knowledge skills (35) + middleware skills (21):**  
  - Deep Unity 6.3 API knowledge: graphics, physics, UI, animation, audio, input, ECS/DOTS, performance, testing.  
  - Middleware: VContainer, UniTask, Addressables, object pooling, Wwise, etc.  
  These can be imported as “Knowledge Abilities” or “Reference Skills” in OAC, especially for Unity 6.5+.

- **Workflow commands (/uw-cmd-*):**  
  High-level commands for setup, brainstorm, plan, implement-feature, test, debug, polish, review—good blueprint for your “Abilities System PLAN”.

#### From Unity-Developer-Tools (Cursor + MCP server)   [github.com](https://github.com/TMHSDigital/Unity-Developer-Tools)

- **MCP tools:**  
  - **scaffold_script:** script generation for MonoBehaviour, ScriptableObject, Editor, ECS.  
  - **lookup_api:** Unity API search.  
  - **shader_helper:** shader patterns.  
  - **platform_info:** platform-specific guidance.  
  These are excellent candidates to refactor into OAC tools/Abilities, especially for “Unity Scripting Ability”, “Shader Ability”, “Platform Targeting Ability”.

- **Skills (18) and rules (8):**  
  - Project setup, MonoBehaviour patterns, ScriptableObjects, physics, UI Toolkit, shaders, animation, audio, input, networking, editor scripting, performance, ECS/DOTS, Visual Scripting, testing, Addressables, platform targeting.  
  - Rules enforce modern Unity conventions, performance, naming, serialization, shader practices.  
  These can become OAC “Guideline Abilities” and “Lint/Rule tools” that your agents consult before editing.

- **Snippets/templates:**  
  Ready-made patterns for MonoBehaviours, pooling, event systems, state machines, shaders, etc.—ideal for a “Pattern Library Ability” in OAC.

#### From UnityCLI.AgenticExtensions (UAX)   [github.com](https://github.com/TomMoore515/UnityCLI.AgenticExtensions)

- **Agent skill for Unity CLI grammar:**  
  Teaches agents CLI argument rules, JSON flags, PowerShell quirks—perfect as an OAC “UnityCLIUsage” Ability.

- **UAC-MCP coordination tools:**  
  - Tools: `whos_here`, `post_status`, `read_board`, `hold`, `release`.  
  - Pattern: advisory claims, shared board, coordination digest.  
  This is a strong pattern for multi-agent coordination in OAC, especially when multiple sub-agents share Unity CLI/pipeline.

- **Profiling commands:**  
  `list_profiler_counters`, `sample_profiler_counters`, `get_frame_timing`, `get_top_profiler_markers`, `get_profiler_call_tree`, `capture_memory_snapshot`.  
  These can be wrapped as “Performance Diagnostics Ability” and “Profiling tools” in OAC.

- **UI Toolkit commands:**  
  `get_ui_tree`, `click_ui` for runtime UITK; good for a “UITK Interaction Ability”.

- **Input simulation:**  
  `simulate_input` for virtual devices; maps to “InputAutomation Ability” for Play Mode.

- **Scene camera + macros + plugin registry:**  
  Patterns for macros (IUaxMacro) and plugin metadata; useful for your native CPP/Python integration and OAC extension model.

#### From unity-skills (primitive registry)   [github.com](https://github.com/PraveshKoirala/unity-skills)

- **Primitives (~560):**  
  Each primitive has code + `primitive.yaml` contract: summary, when to use, requirements, setup steps, test plan, failure modes, conflicts.  
  This is a direct match for your SOAP SO Architecture and FlowFramework style—primitives can be mapped to OAC “Ability building blocks” with explicit contracts.

- **Agent guide:**  
  Explains composition workflows and quick recipes; can inform your “Abilities System PLAN” and how sub-agents compose primitives into features.

#### From Unity-Open-MCP (full MCP toolset)   [github.com](https://github.com/AlexeyPerov/Unity-Open-MCP)

- **Tool groups:**  
  Asset intelligence, typed editor workflows, diagnostics, gate/validation, CI baselines, offline reads.  
  These are patterns for how your OAC Abilities should be grouped and activated.

- **Safety-gated mutations:**  
  Checkpoint → mutate → validate → delta, with regression checks and targeted fixes.  
  This is exactly the pattern you want for refactoring MCP functionality into OAC Abilities: every write goes through gate-and-verify.

- **Offline/bridge modes:**  
  Ability to work when Unity Editor is closed (reading assets, logs, compile errors).  
  This aligns with your preference for “doing a lot without Unity Hub/Editor running”.

#### From AIBridge (project-local harness)   [github.com](https://github.com/liyingsong99/AIBridge)

- **Unity change loop:**  
  Project rules, code lookup, compile, logs, screenshots, tests—closed-loop validation.

- **Prefab/scene automation:**  
  Inspector edits, prefab patch dry-runs, batch scripts, domain-reload-resilient workflows.

- **Runtime bridge:**  
  Player discovery, logs, screenshots, performance, UI snapshot/click, runtime handlers, optional runtime code execution.

- **Code index:**  
  Symbol/declaration lookup; useful for OAC “Code Navigation Ability”.

- **Workflow recipes:**  
  Bug-hunter loops, runtime-target sweeps, performance investigations, prefab sweeps, unity-change-implementation, sharded review.  
  These are excellent templates for OAC multi-step Abilities and sub-agent orchestration.

---

## 2. Requirements document (for OAC + Unity 6.5+ agentic system)

### 2.1 Goals

- **Goal:** Build an OpenAgentsControl (OAC) architecture that:
  - Integrates Unity CLI, pipeline, MCP servers, and your devtools `.cmd`/`.ps1` automation.  
  - Exposes all functionality as Abilities/tools, not ad-hoc MCP-only features.  
  - Supports specialized sub-agents for Unity 6.5+ 2D, 3D, XR automated game design.  
  - Encourages TDD/test-first workflows where desired.  
  - Respects your SOLID, SOAP SO Architecture, FlowFramework, event-driven decoupling, and native CPP/Python integration.

### 2.2 Functional requirements

- **FR1: Ability system integration**
  - Every Unity/MCP/devtools capability must be represented as an OAC Ability or tool, with:
    - Clear contract (inputs, outputs, side effects, safety gates).  
    - Mapping to one or more agents/sub-agents.

- **FR2: Agent system blueprint alignment**
  - OAC’s agent-system-blueprint must:
    - Support director/lead/specialist hierarchy for architecture, design, implementation, QA, release.  
    - Provide category-based routing (e.g., “Unity-2D-Design”, “Unity-3D-Gameplay”, “Unity-XR-Interaction”, “Native-Plugin-Engineering”).

- **FR3: Devtools automation integration**
  - Existing `.cmd` and `.ps1` workflows (e.g., `devtools.compile.run`, `devtools.test.editmode`, `devtools.automation.gate`) must be:
    - Wrapped as OAC tools with JSON outputs.  
    - Composed into higher-level Abilities (e.g., “CompileAndVerifyProject”, “RunGateReview”).

- **FR4: Unity CLI/pipeline integration**
  - Unity CLI and pipeline commands (including UAX extensions) must be:
    - Accessible via OAC tools.  
    - Coordinated via multi-agent patterns (UAC-style claims) to avoid collisions.

- **FR5: TDD/test-first support**
  - Provide Abilities and sub-agents for:
    - Test design, test writing, failing-test-first, test deduplication.  
    - Running tests via Unity CLI/MCP/devtools.  
    - Gate conditions: “green tests” as Definition of Done.

- **FR6: Multi-mode operation (Editor vs offline)**
  - System must support:
    - Live Editor mode (Unity running, CLI/pipeline tools active).  
    - Offline mode (Unity closed) using asset/log readers, devtools, Open MCP/AIBridge-style offline tools.

- **FR7: Specialized sub-agents**
  - Define sub-agents for:
    - **Unity 2D design:** platformers, tilemaps, 2D physics, UI.  
    - **Unity 3D design:** character controllers, cameras, combat, level design.  
    - **Unity XR design:** interaction systems, input, spatial UI.  
    - **Native plugin tasks:** graphics capture, performance-critical code.  
    - **Automation/TDD:** compile/test/verify loops, gate review, performance profiling.

### 2.3 Non-functional requirements

- **NFR1: Solo developer ergonomics**
  - Minimal manual setup; clear docs; ability to run from laptop with Unity 6.5, CLI, pipeline, devtools.

- **NFR2: Modularity and refactorability**
  - Abilities/tools must be:
    - Diff-friendly, versioned, and composable.  
    - Easy to move between MCP servers and OAC without duplication.

- **NFR3: Safety and gate review**
  - All mutating operations must:
    - Run through gate-and-verify patterns (Open MCP/AIBridge style).  
    - Provide deltas and regression checks before committing changes.

- **NFR4: Extensibility**
  - Support adding new:
    - Unity knowledge skills (like Unity Knowledge Skills plugin).  
    - Middleware skills (FlowFramework, your event systems).  
    - Native/Python tools.

### 2.4 Constraints

- **C1:** Unity 6.5+ with pipeline package and Unity CLI installed.  
- **C2:** Existing devtools architecture (bundle, gate-state, native-project-state) must remain the source of truth for project status.   
- **C3:** MCP servers may differ (Open MCP, AIBridge, UnityCLI.AgenticExtensions, custom Node MCP); OAC must abstract over them.

---

## 3. Multi-step plan

### Phase 1: Discovery and mapping

- **Step 1:**  
  Formalize OAC’s core documents:
  - `agent-system-blueprint.md` → add director/lead/specialist hierarchy inspired by claude-unity-game-studio.   [github.com](https://github.com/IdoCohen560/claude-unity-game-studio)  
  - `category-system.md` → define categories for Unity 2D/3D/XR, TDD, native, automation.

- **Step 2:**  
  Inventory existing devtools `.cmd`/`.ps1` workflows and Unity automation bundle:
  - Map each workflow (compile, test, verify, gate, native build) to candidate OAC tools/Abilities.   

- **Step 3:**  
  Catalog external capabilities:
  - From each repo, list concrete commands/tools/skills you want to reuse (profiling, input simulation, asset intelligence, workflow recipes, primitives).

### Phase 2: Ability and tool design

- **Step 4:**  
  Design the OAC Abilities System:
  - Start from `abilities-system/PLAN.md` and define:
    - Core Abilities: “ProjectStatus”, “CompileAndTest”, “GateReview”, “PerformanceDiagnostics”, “SceneEditing”, “PrefabAutomation”, “RuntimeDebugging”.  
    - Knowledge Abilities: “UnityAPIReference”, “UnityPatterns”, “PrimitiveRegistryAccess”.  
    - TDD Abilities: “TestDesign”, “TestWriting”, “RunTestsAndGate”.

- **Step 5:**  
  Define tool contracts:
  - For each underlying command (Unity CLI, devtools, MCP tool), specify:
    - Input schema, output schema, error handling, safety flags.  
    - Whether it can run offline (no Editor) or requires live Editor.

- **Step 6:**  
  Implement initial OAC tools:
  - Wrap devtools commands (`devtools.cmd`) as tools.  
  - Wrap Unity CLI/pipeline commands (including UAX) as tools.  
  - Optionally wrap Open MCP/AIBridge CLI commands as tools for offline/bridge operations.

### Phase 3: Agent and sub-agent specialization

- **Step 7:**  
  Define specialized sub-agents:
  - **Unity2DDesignerAgent:** uses 2D-specific Abilities, primitives, patterns.  
  - **Unity3DGameplayAgent:** uses combat, camera, physics, performance Abilities.  
  - **UnityXRAgent:** uses XR input, spatial UI, interaction primitives.  
  - **TDDAgent:** orchestrates test design/writing/running.  
  - **NativePluginAgent:** coordinates CPP builds, GraphicsCapture, performance profiling.

- **Step 8:**  
  Integrate coordination patterns:
  - Implement UAC-style coordination (claims, board) inside OAC so multiple sub-agents can share Unity CLI/pipeline safely.   [github.com](https://github.com/TomMoore515/UnityCLI.AgenticExtensions)  

- **Step 9:**  
  Connect Abilities to agents:
  - For each agent, define:
    - Which Abilities it can call.  
    - Which tools it prefers (Unity CLI vs devtools vs MCP).  
    - Gate rules (e.g., must pass tests before “done”).

### Phase 4: TDD and gate workflows

- **Step 10:**  
  Implement TDD workflows:
  - Port unity-coding-skills’ dev workflow (plan-feature → failing-test-writer → implementation → test-deduplicator) into OAC as a multi-step Ability.   [github.com](https://github.com/nowsprinting/unity-coding-skills)  

- **Step 11:**  
  Implement gate review:
  - Use Open MCP’s gate-and-verify patterns and claude-unity-game-studio’s director gates to define:
    - Concept, pre-prod, prod, release gates.   [github.com](https://github.com/IdoCohen560/claude-unity-game-studio)   [github.com](https://github.com/AlexeyPerov/Unity-Open-MCP) 

- **Step 12:**  
  Integrate workflows from AIBridge:
  - Port key recipes (unity-change-implementation, runtime-ui-validation, performance-hotspot-investigation) into OAC as reusable multi-step Abilities.   [github.com](https://github.com/liyingsong99/AIBridge)  

### Phase 5: Offline and multi-engine support

- **Step 13:**  
  Implement offline capabilities:
  - Use Open MCP/AIBridge patterns to:
    - Read assets, logs, compile errors from disk when Unity is closed.   [github.com](https://github.com/AlexeyPerov/Unity-Open-MCP)   [github.com](https://github.com/liyingsong99/AIBridge) 

- **Step 14:**  
  Abstract MCP servers:
  - Define an OAC “MCP adapter” layer so:
    - Unity-Open-MCP, AIBridge, UnityCLI.AgenticExtensions, custom Node MCP can be swapped without changing Abilities.

- **Step 15:**  
  Iterate and dedupe:
  - As you add more tools/Abilities, dedupe overlapping functionality (e.g., multiple “RunTests” tools) and keep the best implementation.

---

## 4. What else needs to be considered?

- **Model and cost strategy:**  
  Decide which models (local vs cloud) and which tiers you want for different agents (directors vs specialists), similar to claude-unity-game-studio’s tiered usage.   [github.com](https://github.com/IdoCohen560/claude-unity-game-studio)  

- **Evidence and citation discipline:**  
  Adopt AIBridge/Open MCP’s habit of:
  - Storing logs, screenshots, test results, perf snapshots as artifacts.  
  - Requiring agents to cite evidence when claiming success.   [github.com](https://github.com/AlexeyPerov/Unity-Open-MCP)   [github.com](https://github.com/liyingsong99/AIBridge) 

- **Versioning and compatibility:**  
  - Track Unity version (6.5+), pipeline package version, CLI version, MCP server versions.  
  - Ensure Abilities/tools declare compatibility and fail gracefully when mismatched.

- **Native and Python integration:**  
  - Define clear Abilities for CPP native plugins (GraphicsCapture) and Python scripts.  
  - Keep them behind safety gates and explicit contracts.

- **Human-in-the-loop boundaries:**  
  - Decide which gates or operations always require your explicit approval (e.g., deleting assets, changing architecture).  
  - Encode that into OAC’s guardrails so agents never silently cross those lines.

- **Documentation and onboarding:**  
  - Keep OAC’s README, blueprint, category system, and abilities PLAN as living documents.  
  - Make it easy for future you to remember why a sub-agent exists and how it’s supposed to behave.

=========================

Decisions: 
- I said "I want any functionality added to a MCP or using Unity MCP to be refactored into OAC as Abilities or tools", which means do not add multiple MCPs. I should have included `Commands` as another target.
- TDD/FTF should be optional and be able to be turned on or off.
- We will need a general purpose method for patterns to be enabled or disabled, like Singleton, Command, State Machine, Object Pool, Factory, Service-Locator, Event Channels/Bus, Observer Patterns, and different packages UniTask, DoTween, TextMesh Pro, Amplify Shadder Graph, ZenJect, FlowFramework, SOAP, Cinemachine, etc.

1. Revise the compatibility map to convert MCP to built-in Abilities, commands, etc.
2. We will need to do proper attribution. Review MIT license requirements and add needed requirements to req doc and Plan to track and update any needed attribution in all needed places, central file plus all source files.
3. We will be modifying OAC as a plugin that will install all the required files into the .opencode/ of the project when the user selects the unity-2d|unity-3d|unity-xr subdomain as part of build-context-system.md.
4. For Phase 1 Step 1, we need to get the build-context-system to correctly install the plugin context, Abilities, Agents, and Subagents, etc and scan the project. And create/update Docs under the plugin. 
- Step 3 needs to generate a doc for Commands, Abilities, Agents, Sub-Agents, Knowledge, Workflows, Gates, API lookups, Rules, Snippets, Templates, Examples, Coordination, Primitives, Contracts, Tests, etc that will include context for the source, and what uses each and what each uses, for example the ability ProjectStatus can be used by a list of Agents and SubAgents, the TDD Test Runner can use the abilities ProjectStatus, RunTest EditorMode|PlayMode, etc. 
- Add Step 4 to add the ability detect an existing project and gather context from that project that will be available for sub-agents. Step 5: testing 
5. The other Phases will use the docs generated in Phase 1, Step 3 and refer to the sources for context.
6. We will need to test as we go. We need to be able to handle Unity 6.0, 6.3, 6.5, future LTS versions so add a req to support conditionals in the plugin. Do not support deprecated Unity MCP.
7. Add "4. What else needs to be considered?" into the req doc and the plan, but "Documentation and onboarding" refers to the Plugin's docs.
8. What are all the issues that keeps us from being able to let more than one sub-agent work at the same time? How do we find ways to let some sub-agents with all the Abilities and commands that they might call be able to work together, (maybe even on the same file at the same time)? Maybe we have a read phase, a choose files you will need phase, a way to report to another Ability that Ability 1 report to 2, here are the line numbers of changes 1 wants to make and if they are in the parts that were read by 2 for it's changes and/or lines intersect with ones 2 is changing, then 1 does its change and 2 rereads then does its change. Although it might be hard to coordinate this. Maybe we have any sub-agent locking files that it might affect in a code change as well as the ones that it is changing. What other options? What options, pros and cons? 

9. Generate any docs that changed.


-----------------------



### Revised compatibility map (MCP → OAC Abilities, commands, tools)

| Source system / repo | Original surface (MCP/tools) | OAC mapping (no extra MCPs) |
|----------------------|------------------------------|-----------------------------|
| Unity CLI + pipeline + UAX | CLI commands, UAX MCP tools | **Commands:** Unity CLI verbs (build, run_tests, capture_game_view, profiling, UITK, input). **Abilities:** “RunUnityTests”, “PerformanceDiagnostics”, “UITKInteraction”, “InputAutomation”, “SceneCameraControl”. |
| Devtools `.cmd` / `.ps1` + automation bundle | `devtools.compile.run`, `devtools.test.*`, `devtools.automation.gate`, `devtools.build.native` | **Commands:** `devtools-*` invocations. **Abilities:** “CompileAndVerifyProject”, “RunEditModeTests”, “RunPlayModeTests”, “GateReview”, “BuildNativePlugin”, “ProjectStatus”. |
| Unity-Open-MCP | Asset intelligence, gate/verify, offline reads | **Abilities:** “AssetIntelligence”, “OfflineProjectInspection”, “GateAndVerifyChanges”, “CIStatusBaseline”. Implemented via CLI/devtools/your scripts, not via separate MCP. |
| AIBridge | Project-local harness, runtime bridge, workflows | **Abilities:** “UnityChangeLoop”, “PrefabAutomation”, “RuntimeDebugging”, “RuntimeUIValidation”, “PerformanceInvestigation”. **Commands:** bridge scripts/CLI wrappers. |
| unity-coding-skills | Skills + subagents + TDD workflows | **Abilities:** “TestDesign”, “TestWriting”, “FailingTestFirst”, “TestDeduplication”, “SceneEditing”, “BugFixWorkflow”, “FeaturePlanning”. **Sub-agents:** TDD/Test agents under OAC. |
| claude-unity-game-studio | Studio hierarchy + skills | **Agents/Sub-agents:** Directors, leads, specialists mapped into OAC’s agent-system-blueprint. **Abilities:** “ArchitectureDecision”, “SystemMapping”, “QAPlan”, “ReleaseGate”. |
| Unity-Developer-Tools | MCP tools, rules, snippets | **Abilities:** “ScriptScaffolding”, “UnityAPILookup”, “ShaderHelper”, “PlatformTargeting”, “PatternLibrary”. **Commands:** local scripts/CLI. **Rules/Snippets/Templates:** knowledge surfaces. |
| UnityCLI.AgenticExtensions | UAX tools, coordination, profiling | **Abilities:** “CoordinationBoard”, “ProfilerSampling”, “MemorySnapshot”, “UITKTreeAndClick”, “InputSimulation”. **Commands:** UAX CLI extensions. |
| unity-skills (primitive registry) | Primitives + contracts | **Primitives/Contracts:** imported as OAC “Primitive Library” with contracts. **Abilities:** “PrimitiveComposition”, “ContractAwareDesign”. |
| Other skill repos (Unity-Skills, Unity-MCP, AIBridge variants) | Skills, helpers | **Knowledge:** patterns, examples, rules. **Abilities:** where they imply behavior; **Commands:** where they imply scripts/CLIs. |

From your automation bundle:

> “Run devtools compile (devtools.compile.run). Run devtools.test.editmode and devtools.test.playmode. Run application via Unity CLI editor_play + capture_game_view. Build native plugin if appropriate (devtools.build.native). Report changed files and verification results; do not claim 'done' without passing tests.”  

Those become core Abilities/commands in OAC.

---

## Updated requirements document (including attribution, versioning, patterns, docs)

### 1. Goals

- **Goal 1:** OAC Unity plugin installs into `.opencode/` when `unity-2d|unity-3d|unity-xr` subdomain is selected in `build-context-system.md`, bringing:
  - Abilities, commands, agents, sub-agents, knowledge, workflows, gates, rules, primitives, contracts, tests.
- **Goal 2:** All Unity/MCP/devtools functionality is expressed as:
  - **Commands** (Unity CLI, devtools, bridge scripts).  
  - **Abilities** (higher-level behaviors).  
  - **Agents/Sub-agents** (role-based orchestrators).
- **Goal 3:** TDD/FTF is **optional**, toggleable per project or per build-context.
- **Goal 4:** Patterns (Singleton, Command, State Machine, Object Pool, Factory, Service Locator, Event Bus, Observer, UniTask, DoTween, TMP, Amplify, Zenject, FlowFramework, SOAP, Cinemachine, etc.) are:
  - Represented as **pattern Abilities/rules**.  
  - Enable/disable-able via configuration.

### 2. Functional requirements

- **FR1: Plugin installation via build-context-system**
  - When user selects `unity-2d|unity-3d|unity-xr`:
    - Install OAC plugin files into `.opencode/`.  
    - Register Abilities, commands, agents, sub-agents.  
    - Scan the project (Unity version, packages, patterns, tests, scenes, native plugins).  
    - Generate/update plugin docs (see Phase 1 plan).

- **FR2: Ability/command registry doc (Phase 1, Step 3)**
  - Generate a machine- and human-readable doc listing:
    - **Commands, Abilities, Agents, Sub-Agents, Knowledge, Workflows, Gates, API lookups, Rules, Snippets, Templates, Examples, Coordination mechanisms, Primitives, Contracts, Tests.**
    - For each item:
      - Source repo/project.  
      - What uses it (agents/abilities).  
      - What it uses (dependencies).  
    - Example:  
      - `Ability: ProjectStatus` → used by `CompileAndVerifyProject`, `TDDAgent`, `Unity3DGameplayAgent`; uses `devtools.status.read`, Unity CLI `editor_status`.  
      - `Ability: TDDTestRunner` → uses `ProjectStatus`, `RunTests(EditMode|PlayMode)`, `FailingTestFirst`, `TestDeduplication`.

- **FR3: Existing project detection (Phase 1, Step 4)**
  - Detect existing Unity project:
    - Read `ProjectSettings`, `Packages`, `manifest.json`, `Editor` version, pipeline package, FlowFramework/SOAP presence, native DLLs.  
    - Build a **context model** accessible to sub-agents (Unity version, installed packages, patterns in use, test presence).

- **FR4: Testing requirement (Phase 1, Step 5 and ongoing)**
  - Every phase must:
    - Define tests for new Abilities/commands.  
    - Run tests via Unity CLI/devtools.  
    - Respect TDD toggle:
      - If TDD enabled: failing-test-first workflow.  
      - If disabled: tests still required, but not necessarily written first.

- **FR5: Version and conditional support**
  - Support Unity 6.0, 6.3, 6.5, and future LTS via:
    - Conditional behavior in plugin (feature flags per version).  
    - Abilities/commands declare compatibility (e.g., build profiles only on 6.x).  
    - No support for deprecated Unity MCP; rely on CLI/pipeline/devtools.

- **FR6: Pattern toggling**
  - Provide configuration (per project or per build-context) to:
    - Enable/disable patterns and packages.  
    - Influence code generation and refactoring (e.g., prefer FlowFramework events over DI, avoid Service Locator, etc.).

- **FR7: Multi-agent coordination**
  - Define coordination mechanisms so multiple sub-agents can:
    - Share read phases.  
    - Reserve/lock files or regions.  
    - Exchange planned changes (line ranges, semantic regions).  
    - Avoid conflicting writes or resolve them via re-read/merge.

- **FR8: Documentation and onboarding (plugin-focused)**
  - Plugin must:
    - Generate and maintain docs under `.opencode/`:
      - Build context docs.  
      - Ability/command registry.  
      - Agent-system-blueprint, category-system, pattern toggles, version matrix.  
      - Attribution file(s).

### 3. Licensing and attribution requirements (MIT)

- **LR1: Attribution tracking**
  - For each imported MIT-licensed repo (Unity skills, coding skills, AIBridge, etc.):
    - Record copyright holder and license text.
    - Include MIT license notice in:
      - Central attribution file (e.g., `THIRD_PARTY_NOTICES.md` or `LICENSES-THIRD-PARTY.md`).  
      - Any redistributed source files that include substantial portions of upstream code.   [safeguard.sh](https://safeguard.sh/resources/blog/mit-license-summary)  [sbomify.com](https://sbomify.com/2026/01/22/mit-license-guide/)
- **LR2: Distribution compliance**
  - When OAC plugin is distributed or installed:
    - Ensure the central attribution file is included.  
    - Ensure any copied source files carry original copyright + MIT license text.   [safeguard.sh](https://safeguard.sh/resources/blog/what-is-the-mit-license)  [mitzone.org](https://mitzone.org/what-is-mit/)
- **LR3: Plan integration**
  - Phase plans must:
    - Track which upstream components are used.  
    - Require updating attribution docs whenever new upstream code is imported or modified.

### 4. Non-functional requirements

- **NFR1:** Solo developer ergonomics; minimal manual steps.  
- **NFR2:** Modularity; Abilities/commands diff-friendly and refactorable.  
- **NFR3:** Safety; gate-and-verify for mutating operations.  
- **NFR4:** Extensibility; easy to add new patterns, packages, Abilities.  
- **NFR5:** Performance; avoid heavy coordination overhead for small changes.

### 5. “What else needs to be considered?” (embedded)

- **Model/cost strategy:** which models for which agents.  
- **Evidence discipline:** logs, screenshots, test results as artifacts.  
- **Versioning/compatibility:** explicit version matrix.  
- **Native/Python integration:** clear contracts and safety gates.  
- **Human-in-the-loop:** explicit approval points.  
- **Plugin documentation/onboarding:** generated docs as primary UX.

---

## Updated multi-step plan (phases, with your new steps)

### Phase 1: Discovery, installation, and mapping

- **Step 1: Build-context-system integration**
  - Extend `build-context-system.md` so that selecting `unity-2d|unity-3d|unity-xr`:
    - Installs OAC plugin into `.opencode/`.  
    - Registers plugin context (Unity version, patterns, packages).  
    - Installs Abilities, commands, agents, sub-agents, knowledge docs.  
    - Triggers initial project scan.

- **Step 2: Project scan and context model**
  - Scan:
    - Unity version (6.0/6.3/6.5+).  
    - Packages (pipeline, FlowFramework, SOAP, UniTask, DoTween, TMP, Amplify, Zenject, Cinemachine, etc.).  
    - Tests (EditMode/PlayMode).  
    - Native DLLs and Python scripts.  
  - Build a context model accessible to Abilities and sub-agents.

- **Step 3: Registry doc generation**
  - Generate a doc (and JSON/YAML) under `.opencode/` describing:
    - Commands, Abilities, Agents, Sub-Agents, Knowledge, Workflows, Gates, API lookups, Rules, Snippets, Templates, Examples, Coordination mechanisms, Primitives, Contracts, Tests.  
    - For each: source, dependencies, consumers.  
    - This doc becomes the reference for later phases.

- **Step 4: Existing project detection and context enrichment**
  - Detect:
    - Existing scenes, prefabs, ScriptableObjects, FlowFramework graphs, SOAP services, event channels.  
  - Enrich context model with:
    - Pattern usage (e.g., where Singleton/Command/State Machine already exist).  
    - Test coverage, gate history, native plugin usage.

- **Step 5: Testing baseline**
  - Define and run:
    - Plugin-level tests (installation, scanning, doc generation).  
    - Project-level tests (compile, EditMode/PlayMode via devtools/CLI).  
  - Respect TDD toggle:
    - If enabled: write failing tests first for new plugin features.  
    - If disabled: still ensure tests exist.

### Phase 2: Ability and command design

- **Step 6:** Design Abilities and commands based on registry doc.  
- **Step 7:** Implement wrappers for Unity CLI, devtools, bridge scripts.  
- **Step 8:** Integrate pattern toggles (config-driven).  
- **Step 9:** Update registry doc and attribution files when new capabilities are added.

### Phase 3: Agent and sub-agent specialization

- **Step 10:** Define Unity-2D/3D/XR agents and sub-agents, plus TDD and native plugin agents.  
- **Step 11:** Wire Abilities/commands to agents using the registry doc.  
- **Step 12:** Implement coordination mechanisms (see next section) and document them.

### Phase 4: TDD, gates, and workflows

- **Step 13:** Implement optional TDD workflows (unity-coding-skills patterns).  
- **Step 14:** Implement gate workflows (Open MCP/AIBridge + studio gates).  
- **Step 15:** Ensure all workflows reference registry doc and attribution sources.

### Phase 5: Versioning, conditionals, and evolution

- **Step 16:** Implement version conditionals for Unity 6.0/6.3/6.5/LTS.  
- **Step 17:** Add tests for each version path.  
- **Step 18:** Maintain docs and attribution as new versions and patterns are added.

---

## Multi-agent concurrency: issues, options, pros/cons

### Key issues

- **I1: Conflicting writes**
  - Two sub-agents editing same file/region concurrently.  
- **I2: Stale reads**
  - Agent B reads file before Agent A’s change; B’s plan becomes outdated.  
- **I3: Semantic conflicts**
  - Changes compile but break behavior or tests.  
- **I4: Coordination overhead**
  - Too much locking/serialization slows everything down.

### Options for coordination

#### Option A: File-level locking

- **Idea:** When a sub-agent plans to change a file, it locks that file for write; others can still read but cannot write until lock is released.
- **Pros:**  
  - **Simple:** easy to reason about.  
  - **Safe:** prevents simultaneous writes.
- **Cons:**  
  - **Coarse:** blocks unrelated changes in same file.  
  - **Queueing:** agents may wait unnecessarily.

#### Option B: Region/line-range locking

- **Idea:** Agents declare line ranges or semantic regions they plan to change; locks apply only to those ranges.
- **Pros:**  
  - **More parallelism:** different regions can be edited concurrently.  
  - **Better fit:** matches your idea of reporting line numbers and intersections.
- **Cons:**  
  - **Complex:** requires robust diff/region tracking.  
  - **Fragile:** refactors can shift lines and invalidate ranges.

#### Option C: Read–plan–apply phases with re-read

- **Idea:**  
  1. **Read phase:** agents read files and declare intended changes (patches).  
  2. **Plan phase:** central coordinator checks for conflicts (overlapping patches).  
  3. **Apply phase:** apply patches in order; if conflict detected, later agent re-reads and re-plans.
- **Pros:**  
  - **Deterministic:** central place to resolve conflicts.  
  - **Evidence-based:** patches can be inspected and tested.
- **Cons:**  
  - **Latency:** agents may need to re-plan.  
  - **Coordinator complexity:** needs good conflict detection.

#### Option D: Semantic ownership (domain partitioning)

- **Idea:** Assign ownership per domain: e.g., one agent owns “UI Toolkit”, another “Gameplay logic”, another “Tests”. They rarely touch the same files.
- **Pros:**  
  - **Low conflict:** natural separation.  
  - **Aligns with your specialized sub-agents.**
- **Cons:**  
  - **Rigid:** some features cross domains.  
  - **Requires discipline:** ownership rules must be clear.

#### Option E: Patch-based merging with tests

- **Idea:** Agents produce patches; coordinator merges them (like git), then runs tests/gates. If tests fail, roll back or ask agents to revise.
- **Pros:**  
  - **Git-like:** familiar model.  
  - **Test-backed:** conflicts caught by tests/gates.
- **Cons:**  
  - **Merge complexity:** automatic merges can be wrong.  
  - **Requires strong test coverage.**

#### Option F: Advisory coordination board (UAX-style)

- **Idea:** Agents post “claims” to a coordination board: “I plan to change file X lines 100–150”; others see claims and avoid conflicts or negotiate.
- **Pros:**  
  - **Flexible:** supports human-like negotiation.  
  - **Transparent:** you can inspect board state.
- **Cons:**  
  - **Soft guarantees:** relies on agents honoring claims.  
  - **More logic:** needs good board semantics.

### Likely hybrid for you

Given your architecture and solo workflow, a hybrid makes sense:

- **Primary:** Read–plan–apply phases with patch-based merging (Option C + E).  
- **Safety:** File-level locking as a fallback when conflicts are frequent (Option A).  
- **Optimization:** Region locking for high-traffic files (Option B).  
- **Structure:** Semantic ownership via specialized sub-agents (Option D).  
- **Visibility:** Coordination board for claims and status (Option F).

---

## Generated/changed docs (conceptually)

Here’s what “changed” based on your decisions:

- **Compatibility map doc:**  
  - Updated to map all MCP-origin functionality into OAC Abilities, commands, tools—no extra MCPs.
- **Requirements doc:**  
  - Added plugin installation via build-context-system, TDD toggle, pattern toggles, version conditionals, attribution requirements, multi-agent coordination, and embedded “What else needs to be considered?”.
- **Multi-step plan doc:**  
  - Phase 1 now includes build-context integration, project scan, registry doc generation, existing project detection, and testing baseline.  
  - Later phases reference the registry doc and attribution sources.
- **Plugin docs (to be generated by the system):**
  - **Ability/command/agent registry** under `.opencode/`.  
  - **Build-context-system** updates describing Unity subdomains and plugin behavior.  
  - **Attribution file(s)** tracking MIT-licensed sources.  
  - **Coordination and pattern configuration docs** explaining toggles and concurrency model.

If you’d like, next we can sketch the actual structure of that registry doc (fields, examples) so it’s ready to implement.