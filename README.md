# OpenAgents Control - System Builder Domains

Extra domains for the OAC System Builder. A **domain** groups one or more **sub-domains**; each
sub-domain is a self-contained folder with an `sb-domain.json` manifest plus its agents, commands,
context, hooks, and scripts.

Example: the `game-dev` domain ships `unity-2d`, `unity-3d`, and `unity-xr` sub-domains.

## Install

Run the OAC installer first (Advanced profile), then this repo's installer.

```bash
# 1. OpenAgents Control (Advanced profile) into the project
<path-to-OAC>/install.sh advanced --install-dir .opencode

# 2. Extra domains into the same project
./install.sh . --force
```

Or point directly at the OpenCode directory (works for global installs too):

```bash
./install.sh --opencode-dir ~/.config/opencode --force
```

This copies the whole `xdomains/` tree to `<opencode-dir>/xdomains/`. Then, in OpenCode:

```
/build-context-system
```

Choose the `game-dev` domain; Stage 2.4 lists that domain's sub-domains. The selected sub-domain's
assets are applied into `.opencode/` (agents, commands, context) and its hooks drive the interview.

## Structure

```
xdomains/
├── discover-xdomains.sh          # read-only discovery helper
├── merge-domains.js              # deterministic apply engine
├── <domain>/
│   └── <sub-domain>/
│       ├── sb-domain.json        # manifest
│       ├── agent/                # orchestrator + subagents
│       ├── command/              # slash commands
│       ├── context/              # knowledge library
│       ├── hooks/                # builder hooks (before|instead|after)
│       ├── scripts/              # projection + helpers
│       ├── templates/
│       └── context-projections.json
└── README.md
```

## Available domains

### Game Dev (`game-dev/`)

| Sub-domain | Status | Notes |
|------------|--------|-------|
| `unity-3d` | Full | orchestrator, 7 subagents, 9 commands, context library |
| `unity-2d` | Full | same shape as unity-3d, 2D content |
| `unity-xr` | Planned | empty placeholder |

## Future domains

- Game Dev / Unreal, Godot, PyGame
- Language / LUA Dev, Python AI Dev
- Data Analytics, Hobby Robot Dev, Side Hustle Art Design

## Contributing

Agent notes and the check chain live in [`AGENTS.md`](AGENTS.md); the review standards live in
[`CODING_STANDARDS.md`](CODING_STANDARDS.md). CI (`.github/workflows/ci.yml`) runs the same checks on
every push and PR.

## Authoring a sub-domain

1. Create `xdomains/<domain>/<sub-domain>/`.
2. Add `sb-domain.json` (required: `name`, `displayName`, `version`, `domain`, `subdomain`, `paths`,
   `compatibility.opencode_min_version`).
3. Add assets under `agent/`, `command/`, `context/`, `hooks/`, `scripts/`.
4. Add builder hooks under `hooks/<mode>/stage-N-slug.md` (see `xdomains/README.md`).
5. Keep context files focused (50–150 lines).
