<!-- Context: unity-3d/templates/monobehaviour-feature | Standards-Version: 1.0 | Priority: high | Updated: 2026-09-20 | Unity: 6.0,6.3,6.5,LTS+ -->

# Template: MonoBehaviour Feature

Self-contained scaffold for one runtime feature. Copy the directory into a project, rename the
namespace, and fill in the feature hooks. The behaviour owns its own state and exposes explicit
`Enable`/`Disable` entry points so a composition root can drive it without reflection.

## Files

| File | Purpose |
|------|---------|
| `FeatureBehaviour.cs` | Runtime component with an idempotent enable/disable lifecycle. |
| `FeatureTests.cs` | EditMode tests for the enable/disable transitions. |

## Usage

1. Copy the files into your runtime and test assemblies.
2. Replace `Game.Features` with the project namespace.
3. Override `OnFeatureEnabled` / `OnFeatureDisabled` with the feature's work.
4. Add the component to a GameObject or instantiate it from a composition root.

## Standards

- `Standards-Version: 1.0`.
- Cache references in `Awake`/`Start`; never resolve components per frame.
- Enable and disable must be idempotent so callers cannot double-apply side effects.
- No package dependencies beyond the Unity runtime and the Test Framework (tests only).
