<!-- Context: unity-3d/knowledge/version-dispatch | Priority: critical | Version: 1.0 | Updated: 2026-09-20 | Unity: 6.0,6.3,6.5,LTS+ -->

# Knowledge Version Dispatch

Selects which knowledge files apply to the detected Unity editor version. This is the entry point
for the version-gated knowledge layer; the machine-readable form is
`xdomains/context/unity/version-matrix.json` (the `dispatch` map), which is the single source of the
editor-line -> dispatch-key mapping. This page is a rendering of that table.

## Detected Version
1. Read the editor version from `unity-project.json` (`unityVersion`, for example `6000.5.7f1`) or
   `ProjectSettings/ProjectVersion.txt`.
2. Map the editor line to a dispatch key using `dispatch` in `version-matrix.json`: `6000.0` -> `6.0`,
   `6000.3` -> `6.3`, `6000.5` -> `6.5`. An editor line the map does not list resolves to the nearest
   known key at or below it (`6000.1`/`6000.2` -> `6.0`); a line above every known key uses the
   `newerDispatchKey` (`LTS+`) overlay.
3. Load the engine and middleware base files, then the single matching overlay from `versions/`.

## Dispatch Table
| Dispatch key | Editor version | Overlay |
|--------------|----------------|---------|
| `6.0` | 6000.0 (Unity 6.0 LTS) | `versions/unity-6.0.md` |
| `6.3` | 6000.3 (Unity 6.3 LTS) | `versions/unity-6.3.md` |
| `6.5` | 6000.5 | `versions/unity-6.5.md` |
| `LTS+` | newer than the known overlays | `versions/unity-lts.md` |

Base files (always loaded):
- Engine: `engine/foundations.md`, `engine/graphics.md`, `engine/physics.md`, `engine/ui.md`,
  `engine/animation.md`, `engine/input.md`, `engine/testing.md`.
- Middleware: `middleware/unitask.md`, `middleware/addressables.md`,
  `middleware/dependency-injection.md`, `middleware/flow-framework.md`, `middleware/soap.md`,
  `middleware/cinemachine.md`, `middleware/textmeshpro.md`, `middleware/dotween.md`,
  `middleware/amplify.md`.

## Machine-Queryable Tables
The lookup tables live with the shared Unity context and are version-tagged per entry. Reference them
rather than duplicating values:

| Concern | Table |
|---------|-------|
| Version matrix (dispatch + feature flags) | `xdomains/context/unity/version-matrix.json` |
| API quick reference | `xdomains/context/unity/unity-api-quickref.json` |
| Deprecation map | `xdomains/context/unity/deprecated-patterns.json` |
| Platform defines | `xdomains/context/unity/platform-defines.json` |
| Shader properties | `xdomains/context/unity/shader-properties.json` |
| Lifecycle order | `xdomains/context/unity/lifecycle-order.json` |
| Package decisions | `xdomains/context/unity/package-choices.json` |
| Understood packages | `xdomains/context/unity/understood-package-categories.json` |

## Rules
- Never mix knowledge from two overlays; exactly one overlay applies per project.
- Base files stay version-neutral and push version-specific claims into an overlay or a `since` field
  in a lookup table.
- The pattern resolver (`programming-patterns.json`) and package choices still gate which middleware
  knowledge is relevant; version gating only decides which files load.

> Verify against primary sources: version-to-overlay mapping, deprecations, and API availability must
> be confirmed against the Unity manual, package docs, and the project's `Packages/manifest.json` for
> the exact editor version. This layer records OAC guidance, not a substitute for the primary docs.
