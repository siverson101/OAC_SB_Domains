### Rules and instructions for any LLM merging functionality and extending OAC

#### General architecture and ownership

- **Respect OAC as the primary architecture:**  
  - **Rule:** Do not introduce new MCP servers or parallel architectures; all functionality must be expressed as OAC **Commands**, **Abilities**, **Agents/Sub-agents**, and **Knowledge**.  
  - **Rule:** If an architecture change (new layer, new lifecycle, new coordination model) is required, **stop and propose it explicitly** for Scott’s review before implementing.

- **No duplication, only refactoring and extension:**  
  - **Rule:** Before adding a new Ability/Command, search the existing OAC Unity plugin for similar functionality; if found, **extend or refactor** instead of duplicating.  
  - **Rule:** When importing patterns from another code base, map them onto existing OAC concepts (Abilities, Commands, Agents) and **merge** rather than create parallel versions.

- **Single source of truth for behavior:**  
  - **Rule:** For each behavior (e.g., “Run Unity tests”, “Gate review”, “Prefab automation”), there must be **one canonical Ability/Command**; other code bases may contribute implementations, patterns, or knowledge, but not separate canonical behaviors.

#### Licensing and attribution

- **Identify license and scope before using code:**  
  - **Rule:** For every external repo or file, determine its license (MIT, Apache, etc.) and note it in the OAC attribution registry.  
  - **Rule:** Do not copy code from non-compatible licenses; for MIT, you may copy with proper attribution.

- **Maintain central attribution file and per-file notices:**  
  - **Rule:** When importing code or substantial patterns from an MIT-licensed repo, update the central attribution file (e.g., `THIRD_PARTY_NOTICES.md`) with:  
    - Repo name, author, license, and which parts of OAC use it.  
  - **Rule:** If you copy or adapt source files, ensure each such file contains the original copyright + MIT license notice.

- **Document provenance in the registry:**  
  - **Rule:** For every Ability/Command/Agent added or modified, record its **source(s)** (repos, docs) in the registry doc so provenance is traceable.

#### Extending OAC Unity plugin

- **Use the plugin’s structure and build-context system:**  
  - **Rule:** All new functionality must be installed/configured via the OAC Unity plugin under `.opencode/`, respecting `build-context-system.md` (e.g., `unity-2d|unity-3d|unity-xr` subdomains).  
  - **Rule:** When adding new Abilities/Agents, update the plugin’s docs and registry so they appear in the build context and are discoverable.

- **Pattern and package toggles:**  
  - **Rule:** Any new pattern (Singleton, Command, State Machine, Object Pool, Factory, Service Locator, Event Bus, Observer) or package (UniTask, DoTween, TMP, Amplify, Zenject, FlowFramework, SOAP, Cinemachine, etc.) must be:  
    - Represented as a **configurable pattern/package toggle**.  
    - Not hard-coded; behavior must depend on project configuration.

- **Version and conditional support:**  
  - **Rule:** For Unity-specific features, declare supported versions (6.0, 6.3, 6.5, LTS) and implement conditionals; do not rely on deprecated Unity MCP.  
  - **Rule:** If a feature is unavailable on a given version, fail gracefully and document the limitation.

- **Consultation on architecture changes:**  
  - **Rule:** If merging a new code base requires:  
    - Changing the agent hierarchy.  
    - Changing coordination model (locks, patches, boards).  
    - Changing plugin lifecycle or build-context semantics.  
    Then **produce a short architecture proposal** and wait for Scott’s approval before proceeding.

---
