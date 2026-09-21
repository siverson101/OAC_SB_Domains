<!-- Context: unity-3d/knowledge/versions/unity-lts | Priority: medium | Version: 1.0 | Updated: 2026-09-20 | Unity: LTS+ -->

# Version Overlay: Future LTS (LTS+)

Loaded in addition to the engine and middleware base files when the detected editor is newer than the
versions OAC has first-class overlays for (currently beyond 6.5). This is a forward-compatibility
overlay, not a statement that untested features work.

## Policy
- Treat newer-than-known versions as **feature-flagged**: use only APIs documented as stable in the
  detected version, and gate anything uncertain behind the appropriate `UNITY_*_OR_NEWER` define.
- Do not assume a 6.5 deprecation is the latest; re-check the upgrade guide for the detected version.
- Re-scan packages: bundled package majors may have changed (Addressables, Input System, Cinemachine,
  Test Framework). Resolve from `Packages/manifest.json`.
- Prefer conservative, well-documented APIs over brand-new ones when generating code for an unknown
  LTS.

## Signals to Collect
- Editor version from `ProjectSettings/ProjectVersion.txt` / `unity-project.json`.
- Pipeline package and version from `Packages/manifest.json`.
- Test Framework and Addressables versions, which change CLI/test behaviour.

> Verify against primary sources: an unknown LTS must be checked against its own manual and upgrade
> guide before any version-specific claim is trusted.
