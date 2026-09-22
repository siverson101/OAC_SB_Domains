# OAC_SB_Domains — agent notes

Unity sub-domains for OpenAgents Control (System Builder xdomains). Sources under `tools/`, shipped
bundles under `xdomains/scripts/`.

## Before you implement

Read `docs/review-lessons.md` first. It records the 12 review themes this repo keeps re-learning
(one source of truth; the contract governs runtime output; fail-soft and honesty; generated-artifact
drift; shared helpers; …). Front-load them into any brief you write for an implementer.

## Where things live

| Need | Path |
|------|------|
| Plan (7 phases) | `docs/Plan.md` |
| Requirements / FRs / licensing | `docs/Requirements.md` |
| Domain glossary (workspace) | `C:\Users\siver\Dev\CONTEXT.md` |
| Decisions (workspace) | `C:\Users\siver\Dev\docs\adr\` |
| Coding standards (read at review) | `CODING_STANDARDS.md` |
| Review themes | `docs/review-lessons.md` |
| Capability contract | `xdomains/context/capability-contract.schema.json` |
| Tickets (local tracker) | `C:\Users\siver\Dev\.scratch\<feature>\` (`spec.md` + `issues/NN-*.md`) |

## Guardrails (run before you commit)

```bash
bun run build && bun run typecheck && bun test tests
bun run build:check                       # regenerates bundles + .opencode/context docs, then diffs them
bash tests/test-domain-hooks.sh && bash tests/test-discover-xdomains.sh && bash tests/test-merge-domains.sh
```

`bun test` exits non-zero on failure — always `echo $?`. CI (`.github/workflows/ci.yml`) runs this same
chain; keep it green. `CODING_STANDARDS.md` lists the invariants each check enforces.

## Conventions the code won't tell you

- **Shared helpers live in `tools/shared/`.** Families supply only their ability list + renderer; never
  re-implement `io`, `cli-args`, `result-envelope`, `safety-gate`, `tool-routing`, `unity-version`, etc.
- **Generated artifacts are committed and drift-checked.** Bundles under `xdomains/scripts/**` and docs
  under `.opencode/context/**` are marked `-diff` in `.gitattributes`; `build:check` fails if stale.
  Register any new generated path there.
- **One source of truth per fact.** When a fact must be duplicated (JSON schema vs TS), add a test that
  the two agree. Agent `abilities:` allowlists, `sb-domain.json` `studioModes`, recipe steps, and
  `version-matrix.json` are each authoritative for their concern.
- **Fail-soft and honest.** `null` means "not computed", never "clean"; distinguish `unavailable` from
  `unknown`; never assert a negative you can't evidence; bad CLI input refuses loudly.
- **Runtime = the Unity CLI** (`unity command` / `unity eval`). Never invoke bare `unity mcp`.

## Working here

- **Worktrees have no `node_modules`** — run `bun install` in each.
- **A branch checked out in the main tree can't also be a worktree.** `git checkout main` first, then
  create the worktree off `main`.
- **Ticket briefs are context pointers.** Point implementers at the spec, tickets, and prior commits;
  don't restate them.
- `xdomains/game-dev/unity-3d/registry.md` is **hand-maintained provenance**; the generated registry is
  `<opencode-dir>/context/<sub>/registry.md`. Do not glob `**/registry.md`.
- `bun run build` prints a summary per bundle; redirect (`>/dev/null`) when you only want the exit code.
- `plugins/` is a legacy tree — out of scope; never edit or commit it.
