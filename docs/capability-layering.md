# Capability layering (tool / ability / command)

Every OAC capability sits in exactly one of three layers (ADR-0004, ADR-0012). The registry
(`xdomains/scripts/shared/build-registry.mjs`) records the layer per capability as `layer:
tool | ability | command` and renders it in the Commands / Abilities / Tools tables.

| Layer | Definition | Example |
|-------|-----------|---------|
| **tool** | Thin typed adapter with no workflow logic. Wraps a CLI, MCP tool, or typed data access. | `unity-cli-wrapper` |
| **ability** | A named capability that composes tools (and other abilities) into a reusable unit of work. Declared in `sb-domain.json`, realised as a command until the abilities runtime ships. | `unity-build`, `gather-unity-context` |
| **command** | The user-invocable entry point that realises an ability (`command/<ability>.md`). | `/unity-build` |

The layering rule: **tool → ability → command**. Tools do one typed thing; abilities compose tools
into a named capability; commands expose that capability to the user (an ability maps to
`command/<ability>.md`, merged into an existing command of the same name rather than duplicated).

The unified capability contract is defined in `xdomains/context/capability-contract.schema.json`
(`schemaVersion` 1); the full field list lives in `docs/Requirements.md` Goal 4.
