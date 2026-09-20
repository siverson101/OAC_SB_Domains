<!-- Context: unity-3d/errors/common-unity-issues | Priority: medium | Version: 1.0 | Updated: 2026-09-07 -->

# Common Unity Issues & Fixes

## Compile Errors
- **"The type or namespace name could not be found"** → missing `using`, missing asmdef reference, or script outside the assembly. Verify `.asmdef` references.
- **Script is not attached to GameObject** → the `.cs.meta` GUID changed or class name ≠ file name. Re-import, re-add component.
- **Missing namespace/API** → version mismatch between code and installed packages (URP, Input System). Check `manifest.json`.

## Scene/Prefab Corruption
- **Broken references / Missing (Mono Script)** → script GUID mismatch. Revert targeted change or re-link script by GUID.
- **Scene won't open in text editor then Unity** → validate YAML; restore from backup; re-open in Unity.
- **Prefab overrides lost** → editing prefab contents instead of the instance; use the Prefab Mode or instance overrides.

## Build Failures
- **Build failed with exit 1 (batch mode)** → read log tail; common: scene not in Build Settings, missing output folder, Android SDK/keystore not configured.
- **Player setting errors** → verify target platform module installed (Windows/Android/iOS) via Unity Hub.

## Runtime Issues
- **Object moves jittery** → physics moved via `transform`; use `Rigidbody.MovePosition`.
- **Input does nothing** → old `Input.GetAxis` disabled under new Input System; enable "Both" or use Input Actions.
- **Camera not following** → camera code in `Update` before physics, or target null; use `LateUpdate`.

## Performance
- **Spikes/GC** → allocations in `Update`; use profiler, object pooling, cached refs.
