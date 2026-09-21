# xdomains

The installed extra domains. Copied into `<opencode-dir>/xdomains/` by the repo's `install.sh`.

## Layout

```
xdomains/
├── discover-xdomains.sh          # read-only discovery helper
├── merge-domains.js              # deterministic apply engine (used by /build-context-system)
└── <domain>/<sub-domain>/        # one self-contained sub-domain
```

## Sub-domain manifest (`sb-domain.json`)

Required fields
- `name` (string) — sub-domain id (kebab-case)
- `displayName` (string) — human-readable name
- `version` (string) — semver
- `domain` (string) — parent domain folder name (e.g. `game-dev`)
- `subdomain` (string) — this sub-domain's name (e.g. `unity-3d`)
- `paths` (object) — plugin-relative folders by asset type
- `compatibility.opencode_min_version` (string)

Recommended fields
- `sharedContext` (array) — context files shared by the whole domain
- `studioModes` (object) — the single source of truth for agent membership: a `lean` and `full`
  key, each with `agents` + `subagents` arrays and an optional Lean `optional` list of agent paths;
  the gating condition lives once, in each optional agent's frontmatter `enabledBy`
  (`tdd` | `native-subproject`)
- `commands` / `context` / `skills` / `scripts` (array) — declared shared assets
- `abilities` (array) — declared ability names; realised as commands (ADR-0004)
- `tools` (array) — declared tool names
- `description` (string)

## Builder hooks

A builder hook is a markdown file that alters a System Builder stage. Hooks are resolved by
filesystem convention from the selected sub-domain:

```
hooks/
  before/stage-N-slug.md      # run, then the built-in stage
  instead/stage-N-slug.md     # replace the built-in stage body (wrapper + checkpoint kept)
  after/stage-N-slug.md       # built-in stage, then run
```

Precedence within a stage: `before` -> (`instead` | built-in) -> `after`. A hook begins with YAML
frontmatter and may declare `requires: [selected_subdomain]`. A malformed hook is warned about and
the built-in stage is used instead; a hook never fails a build.

Known stage slugs: `stage-3-identify-use-cases`, `stage-4-assess-complexity`,
`stage-5-identify-integrations`, `stage-7-generate-system`.

## Applying

```bash
node .opencode/xdomains/merge-domains.js \
  --domain-dir .opencode/xdomains/<domain>/<sub-domain> \
  --opencode-dir .opencode \
  --mode extend \
  --studio-mode lean
```

`--studio-mode` selects the `lean` or `full` hierarchy from `studioModes`; without it the engine
prompts when interactive and otherwise defaults to `lean`. It installs exactly one hierarchy, gates
the optional Lean extras on the TDD toggle / native detection, and writes the choice to
`.opencode/unity-studio.json`. The engine reads `sb-domain.json` and copies only declared assets,
registers agents in `.opencode/config/agent-metadata.json`, and rewrites `.opencode/context`
references for global/custom installs. Deliberate LLM edits are recorded in the sub-domain's `ADAPTATIONS.md`;
re-applying warns before overwriting a listed file (`--force` to override).

## Project data and context projection

Raw per-project inputs live in `.opencode/project-data/`. `context-projections.json` maps each
output md to its sources and each consumer to the outputs it loads. `scripts/build-project-context.js`
writes focused context files to `.opencode/context/<sub-domain>/project/`. Missing sources are
skipped, never fatal.

## Scripts and interactive prompting

Shared and domain scripts live under `xdomains/scripts/`, organised by what they affect
(`unity/`, `cpp/`, `python/`, `shared/`). They are bundled, self-contained ESM files, so `install.sh`
copies them with the rest of the tree and they run with no `node_modules` and no network access.

`shared/prompt.mjs` asks a list of questions defined in a JSON spec and writes the answers as JSON.
A domain hook can call it to delegate an interview to a script and consume the result:

```bash
node .opencode/xdomains/scripts/shared/prompt.mjs --spec <questions.json> --out <answers.json>
```

Add `--defaults` to answer every question from its initial/default value without a terminal (CI and
non-interactive fallback). Use `--spec -` / `--out -` for stdin/stdout. `--help` documents the spec
shape.

`unity/scan-project.mjs` runs the project scan: it discovers the Assets root, classifies files, reads
Unity packages and toolchain info (via the `unity` CLI when present), asks package-choice and
programming-pattern questions through `prompt.mjs`, and writes project data. The stage-3 hook calls
it:

```bash
node .opencode/xdomains/scripts/unity/scan-project.mjs --project-root . --opencode-dir .opencode
```

`unity/gather-unity-context.mjs` gathers the full Unity context (project structure, toolchain,
commands, pipeline, Unity CLI MCP, gate/verification) into `.opencode/project-data/` for projection.

Add `--non-interactive` (or `--answers <file>`) for CI. Scripts are fail-soft and never fail a build.
Raw inputs go to `.opencode/project-data/`; intermediates go to
`.opencode/xdomains/context/project/`.

### Authoring scripts

Sources live under `tools/` by area (`tools/unity/`, `tools/shared/`, …) and are bundled into the
matching `xdomains/scripts/<area>/` with Bun:

```bash
bun install      # once, at the repo root
bun run build    # tools/<area> -> xdomains/scripts/<area>/*.mjs
```

`node_modules` stays at the repo root and is never part of the distributed tree. Rebuild and commit
the generated `xdomains/scripts/<area>/*.mjs` whenever a source changes.
