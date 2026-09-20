### Instructions for any LLM updating `Requirements.md` as OAC evolves

#### Structure and organization

- **Maintain a stable top-level structure:**  
  - **Rule:** Keep `Requirements.md` organized into clear sections:  
    - Goals  
    - Functional Requirements  
    - Non-functional Requirements  
    - Licensing and Attribution  
    - Versioning and Compatibility  
    - Patterns and Packages  
    - Multi-agent Coordination  
    - “What else needs to be considered?”  
  - **Rule:** When integrating a new code base, **extend existing sections** first; only add new sections if the content doesn’t fit any existing category.

- **Use incremental, traceable updates:**  
  - **Rule:** For each integration, add a **subsection** under the relevant section (e.g., “FR: UnityCLI.AgenticExtensions integration”) rather than rewriting the whole doc.  
  - **Rule:** Summarize changes in a short “Update log” at the bottom or top (e.g., “Added requirements for AIBridge-based runtime debugging”).

#### Capturing new requirements per code base

- **Map new functionality to existing requirement categories:**  
  - **Rule:** For each new repo/code base:  
    - Identify its contributions (Abilities, Commands, Agents, Knowledge, Patterns).  
    - Add corresponding requirements under Functional/Non-functional/Patterns/Coordination sections.  
  - **Rule:** Explicitly link new requirements to the **registry doc** (e.g., “See registry entry for Ability: RuntimeUIValidation”).

- **Record integration progress and readiness:**  
  - **Rule:** For each code base, add a small status line:  
    - “Planned”, “Partially integrated”, “Fully integrated”, “Deprecated”.  
  - **Rule:** Update status as work progresses, so `Requirements.md` reflects current integration state.

#### Licensing and attribution in `Requirements.md`

- **Add license-aware requirements:**  
  - **Rule:** When a new MIT-licensed repo is integrated, add requirements such as:  
    - “Maintain attribution for [RepoName] in central file and relevant source files.”  
    - “Ensure any modifications to [RepoName]-derived code are documented in the registry.”  
  - **Rule:** If a repo has special conditions (e.g., non-MIT), add explicit constraints (e.g., “No direct code copying; use conceptual patterns only”).

#### Versioning and conditionals

- **Extend version matrix as needed:**  
  - **Rule:** When a new feature depends on specific Unity versions or packages, update the versioning section with:  
    - Supported versions.  
    - Conditional behavior.  
    - Fallbacks or limitations.  
  - **Rule:** Ensure each new requirement mentions its version constraints.

#### Coordination, patterns, and plugin docs

- **Tie new requirements to coordination model:**  
  - **Rule:** If a new code base introduces workflows that affect multi-agent behavior (e.g., new patch/lock semantics), add requirements under “Multi-agent Coordination” describing:  
    - How agents should coordinate.  
    - Any new locks/boards/patch rules.

- **Ensure plugin documentation is required for each addition:**  
  - **Rule:** For every new Ability/Command/Agent, add a requirement that plugin docs under `.opencode/` must be updated (registry, build-context docs, pattern toggles, attribution).  
  - **Rule:** `Requirements.md` should always state that **docs and registry updates are mandatory** parts of integration, not optional.

#### Consultation and review

- **Flag architecture-impacting requirements:**  
  - **Rule:** When adding requirements that imply architecture changes (new layers, new coordination mechanisms, new plugin lifecycle), mark them clearly (e.g., “Requires architecture review”).  
  - **Rule:** Do not assume approval; note that Scott must review and confirm before implementation.

If you want, I can draft a concrete `Requirements.md` skeleton that bakes these rules in so future updates stay consistent.