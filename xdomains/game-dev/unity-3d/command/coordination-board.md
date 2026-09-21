---
id: coordination-board
summary: Advisory on-disk coordination board at .opencode/coordination/ with claims, leases (TTL), fail-fast conflicts that name the holder, and a one-holder Editor hold.
family: compose
mode: offline
description: Keep the advisory coordination board (ADR-0011) for multi-agent work on one Unity project. Claims carry leases and fail fast naming the holder on conflict; the Editor hold admits one holder at a time. Persisted to .opencode/coordination/board.json + board.md so it survives a domain reload and works with the Editor closed.
inputs: { projectRoot: "string", opencodeDir: "string", verb: "claim|release|hold|release-hold|status", resource: "string?", holder: "string?", note: "string?", leaseSeconds: "number?" }
outputs: { status: "string", safetyGate: "object", action: "string", holder: "string?", expiresAt: "string?", board: "object" }
sideEffects: ["writes .opencode/coordination/board.json", "writes .opencode/coordination/board.md"]
safetyGate: { mutates: true, requiresEditor: false, advisory: true, writesState: true }
uses: []
provides: [coordination-board, coordination-claims, editor-hold]
requires: [opencode-coordination-dir]
testPlan: ["Claim a resource and confirm a conflicting claim fails fast naming the holder", "Confirm a lease expires and frees the resource", "Confirm a second holder cannot take the Editor hold"]
versionCompatibility: { unity: ["6.0", "6.3", "6.5", "LTS+"] }
---

# coordination-board

The board is **advisory**, not an enforced hard lock (ADR-0011). It lives on disk at
`.opencode/coordination/board.json` with a human-readable `.opencode/coordination/board.md`
projection, so it survives a Unity domain reload and works with the Editor closed.

```bash
node .opencode/xdomains/scripts/unity/unity-compose.mjs \
  --project-root . --opencode-dir .opencode \
  --ability coordination-board --verb claim \
  --resource Assets/Scripts/PlayerController.cs \
  --holder unity-3d-implementer --lease-seconds 900 --json
```

## Verbs

- `claim` — claim a resource with a lease (default 900s). A live claim held by **another** holder
  fails fast with `status: conflict` naming the holder and expiry; the same holder renews.
- `release` — release your own claim. Releasing another holder's claim is a conflict.
- `hold` — take the one-holder Editor hold. A second holder is refused while the hold is live.
- `release-hold` — release the Editor hold you own.
- `status` — print the pruned board (expired claims/holds are dropped).

Expired leases are pruned on every read, so a crashed holder does not wedge the board. Fail-soft:
an unreadable board is treated as empty, and nothing is ever hard-locked.
