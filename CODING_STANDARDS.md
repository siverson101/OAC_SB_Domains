# Coding standards

Read this **during review**, not implementation. Implementation has the context pressure; the reviewer
receives a diff and can afford the discipline.

Most of what this repo keeps getting wrong is **mechanical**, and mechanical things belong in a check,
not a rule. The guardrails below already exist — run them, and don't restate what they enforce. Only the
judgement calls at the bottom need a human or reviewer to hold the line.

## Guardrails (automated — run, don't re-assert)

```bash
bun run build:check && bun run typecheck && bun test tests
bash tests/test-domain-hooks.sh && bash tests/test-discover-xdomains.sh && bash tests/test-merge-domains.sh
```

| Invariant | Enforced by |
|-----------|-------------|
| Runtime envelope keys ⊆ envelope core ∪ the command's frontmatter `outputs` | `tests/output-contract.test.ts`, `tests/version-drift.test.ts` |
| Runtime `safetyGate` keys ⊆ `SAFETY_GATE_KEYS` | `tests/safety-gate.test.ts` |
| Every generated bundle matches a fresh build | `tests/bundles.test.ts`, `bun run build:check` |
| Committed `.opencode/context/**` docs match a fresh render | `tests/blueprint.test.ts`, `bun run build:check` |
| Declared counts == files on disk (knowledge, primitives, snippets, templates, commands, abilities, agents, recipes) | `tests/drift.test.ts`, `tests/knowledge.test.ts`, `tests/snippets-templates.test.ts`, `tests/primitives.test.ts` |
| Every ability resolves to a `command/<id>.md` (or installs via `abilities[]`) | `tests/registry.test.ts` |
| Agent `abilities:` ids are known; recipe links resolve | `tests/registry.test.ts`, `tests/recipes.test.ts` |
| Schema ↔ TS constants agree (recipe kinds, studio modes, gates) | `tests/recipes.test.ts`, `tests/gating-agreement.test.ts` |
| Domain manifests + hooks are well-formed | `tests/test-domain-hooks.sh` |
| The apply engine installs exactly one hierarchy and preserves shared assets | `tests/test-merge-domains.sh`, `tests/selection.test.js`, `tests/studio-mode.test.ts` |

## Judgement calls (the reviewer's job)

These have no guardrail — a test can't decide them. Name them explicitly in review.

- **One source of truth.** If a fact lives in two places and no test pins them together, that's the
  finding. Either derive one from the other or add the agreement test.
- **Honesty.** `null` means "not computed", never "clean". Distinguish `unavailable` from `unknown`.
  Never assert a negative you can't evidence. Prefer surfacing an ACTION REQUIRED over a silent skip.
- **Fail-soft, uniformly.** Guard sync and async paths alike; compute side-effectful values lazily on
  the success path; unknown CLI input refuses loudly, never a silent default.
- **Guard before build.** Refuse invalid input before constructing commands or computing escalation.
- **Shared helpers.** Cross-family helpers live in `tools/shared/`; families supply only their ability
  list + renderer. A comment pointing at a helper that lives elsewhere is a layering smell.
- **Document the semantics you rely on.** Units, relativity, and absence ("absent `safetyGate` flag =
  false") belong in the type or schema description.
- **Normalize paths once, on both sides** (`toPosix(...).toLowerCase()`), not one side.
- **Refactoring belongs to review**, not the red→green loop (see the `tdd` discipline in
  `docs/review-lessons.md`).
