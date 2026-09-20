---
description: "Apply the unity-3d sub-domain assets, project project data, then adapt"
requires: [selected_domain, selected_subdomain, merge_mode]
---

# Stage 7 — Apply and adapt the Unity 3D system

This hook owns generation for the selected sub-domain. Do NOT call `@system-builder` unless step 5
below decides to.

1. **Baseline copy** — apply the sub-domain's declared assets deterministically:

   ```bash
   node .opencode/xdomains/merge-domains.js \
     --domain-dir .opencode/xdomains/{selected_domain}/{selected_subdomain} \
     --opencode-dir .opencode \
     --mode {merge_mode}
   ```

2. **Project data → context** — refresh the Unity context, then project the raw project data into
   per-concern md (skip with a note if a script or the data is absent):

   ```bash
   node .opencode/xdomains/scripts/unity/gather-unity-context.mjs \
     --project-root . \
     --opencode-dir .opencode
   ```

   ```bash
   node .opencode/xdomains/{selected_domain}/{selected_subdomain}/scripts/build-project-context.js \
     --project-data .opencode/project-data \
     --opencode-dir .opencode \
     --subdomain {selected_subdomain}
   ```

   Then generate the sub-domain registry (machine + human readable):

   ```bash
   node .opencode/xdomains/scripts/shared/build-registry.mjs \
     --domain-dir .opencode/xdomains/{selected_domain}/{selected_subdomain} \
     --opencode-dir .opencode
   ```

3. **Verify** the result:
   - orchestrator and subagents under `.opencode/agent/`
   - commands under `.opencode/command/`
   - context under `.opencode/context/`
   - projected context under `.opencode/context/{selected_subdomain}/project/`
   - agents registered in `.opencode/config/agent-metadata.json`

4. **Adapt** where the interview answers or project data justify it (test methodology, UI
   framework, Unity version family, packages actually installed). Every deliberate edit to a
   copied file MUST be recorded in
   `.opencode/xdomains/{selected_domain}/{selected_subdomain}/ADAPTATIONS.md`:

   ```
   - <relative/path/to/file.md> — <reason>
   ```

5. **Call `@system-builder` only if** the project already had a system and `merge_mode` is
   `extend`, to wire routing from the existing orchestrator into the Unity 3D orchestrator.
   Otherwise skip generation entirely.

6. **Deliver** the summary: files copied, agents registered, context files projected,
   adaptations recorded, and the merge mode used.
