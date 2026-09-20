<!-- Context: unity-3d/templates/scriptableobject-config | Standards-Version: 1.0 | Priority: high | Updated: 2026-09-20 | Unity: 6.0,6.3,6.5,LTS+ -->

# Template: ScriptableObject Config

Self-contained scaffold for shared configuration. A `GameConfig` asset holds designer-tunable
values, and a scene-level `ConfigProvider` hands the asset to runtime systems. Consumers depend on
the typed config, never on `Resources.Load`.

## Files

| File | Purpose |
|------|---------|
| `GameConfig.cs` | Read-only config asset; values clamped in `OnValidate`. |
| `ConfigProvider.cs` | Scene component that validates and exposes an assigned config asset. |

## Usage

1. Copy the files into your runtime assembly and set the namespace.
2. Create the asset: **Assets > Create > Game > Config > Game Config**.
3. Add `ConfigProvider` to a scene object and assign the asset in the Inspector.
4. Read `provider.Config` from systems that need the values.

## Standards

- `Standards-Version: 1.0`.
- Config assets are read-only at runtime; expose get-only properties.
- Validate and clamp in `OnValidate` so bad data is caught in the Editor.
- Never resolve config through `Resources`; assign it explicitly.
