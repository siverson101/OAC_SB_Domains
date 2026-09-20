<!-- Context: unity-2d/concepts/project-layout | Priority: high | Version: 1.0 | Updated: 2026-09-07 -->

# Unity Project Layout

## Standard Unity Folders
```
<project>/
├── Assets/
│   ├── _Project/            # Your content root (avoid Assets/ root clutter)
│   │   ├── Scripts/         # C# (MonoBehaviour, Editor)
│   │   ├── Scenes/          # .unity scene files
│   │   ├── Prefabs/         # Reusable prefabs
│   │   ├── Art/             # Models, textures, materials
│   │   ├── Animation/       # Animator controllers, clips
│   │   ├── Audio/           # Sound & music
│   │   ├── UI/              # UI Toolkit / uGUI assets
│   │   ├── Shaders/         # Shader + VFX Graph assets
│   │   └── Tests/           # EditMode/PlayMode test assemblies
│   ├── Plugins/             # 3rd-party native/plugin assets
├── Packages/                # manifest.json (package versions)
├── ProjectSettings/         # Project-wide settings
└── Logs/
```

## Folder Conventions
- Scene-only assets stay in `Scenes/`; everything referenced across scenes goes in `Prefabs/` or shared folders.
- Editor-only code goes under an `Editor/` folder (or an `Editor` asmdef) so it is stripped from builds.
- Use Assembly Definitions (`.asmdef`) to organize scripts and speed up compilation.

## Packages & Versions
- `Packages/manifest.json` pins package versions (URP, Input System, Cinemachine, UI Toolkit).
- Keep package versions stable; document upgrades in the decisions log.

## Reference
- See `../domain/unity-common.md` for the canonical layout summary.
