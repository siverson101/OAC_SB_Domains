<!-- Context: unity-3d/version-matrix | Priority: high | Version: 1.0 -->

# Unity Version Matrix

> Generated from `xdomains/context/unity/version-matrix.json`. Do not edit by hand; regenerate with `build-registry.mjs`.

Machine-readable per-version feature matrix for the Unity 6.x line. Single source of truth for the version-gated seams consumed by tools/shared/unity-version.ts and the version-matrix Sense ability.

- Versions: `6.0`, `6.3`, `6.5`, `LTS+`
- Primary version: `6.3`
- Newer dispatch key: `LTS+`

## Dispatch keys

| Editor line | Dispatch key |
|---|---|
| `6000.0` | `6.0` |
| `6000.3` | `6.3` |
| `6000.5` | `6.5` |

## Feature flags

| Feature | Since | Deprecated | Removed | `6.0` | `6.3` | `6.5` | `LTS+` |
|---|---|---|---|---|---|---|---|
| urp-default-pipeline | 6.0 | — | — | yes | yes | yes | yes |
| built-in-render-pipeline | 6.0 | 6.5 | — | yes | yes | no | no |
| hdrp-maintenance-mode | 6.3 | — | — | no | yes | yes | yes |
| builtin-shader-cgprogram-deprecated | 6.5 | 6.5 | — | no | no | yes | yes |
| awaitable-async-primitive | 6.0 | — | — | yes | yes | yes | yes |
| ecs-dots-core-package | 6.3 | — | — | no | yes | yes | yes |
| ui-toolkit-runtime-stable | 6.0 | — | — | yes | yes | yes | yes |
| ui-toolkit-default-runtime-ui | 6.3 | — | — | no | yes | yes | yes |
| find-object-of-type-obsolete | 6.0 | 6.0 | — | yes | yes | yes | yes |
| lighting-auto-generate | — | — | 6.0 | no | no | no | no |
| rigidbody-set-density | 6.0 | 6.1 | — | yes | yes | yes | yes |
| cluster-light-loop-keyword | 6.0 | 6.1 | — | yes | yes | yes | yes |
| dx12-default-graphics-api | 6.3 | — | — | no | yes | yes | yes |

## Overlays

| Dispatch key | Overlay |
|---|---|
| `6.0` | `versions/unity-6.0.md` |
| `6.3` | `versions/unity-6.3.md` |
| `6.5` | `versions/unity-6.5.md` |
| `LTS+` | `versions/unity-lts.md` |

> Verify every version-gated flag against the Unity manual, the relevant upgrade guide, the package docs, and the project's Packages/manifest.json for the exact editor version. This matrix records OAC guidance, not a substitute for the primary docs.
