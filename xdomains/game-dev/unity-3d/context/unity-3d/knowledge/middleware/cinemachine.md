<!-- Context: unity-3d/knowledge/middleware/cinemachine | Priority: medium | Version: 1.0 | Updated: 2026-09-20 | Unity: 6.0,6.3,6.5,LTS+ -->

# Cinemachine

Package: `com.unity.cinemachine`. A procedural camera system: virtual cameras compete for priority
and the Cinemachine Brain on the main `Camera` blends between them.

## Model
- Add a **Cinemachine Brain** to the main camera. Add **Cinemachine Cameras** (virtual cameras) as
  child GameObjects; the highest-priority active virtual camera drives the brain.
- Each virtual camera has a **Follow** target, a **Look At** target, and a **Body/Aim** pipeline
  (for example `Transposer` for 3rd person, `Framing Transposer` for 2D, `Hard Lock` for fixed).
- **Impulse** sources/callbacks add camera shake; keep shake on a separate channel from framing.

## Working with It
- Change cameras by enabling/disabling them or raising/lowering `Priority`; the Brain blends per its
  default blend or a `CinemachineBlenderSettings` asset.
- Use **Cinemachine Confiner** (2D/3D) to keep the camera inside level bounds.
- Drive gameplay camera state from code by targeting virtual cameras, never by moving the Brain.
- Separate **camera** concerns from **player** logic: the camera follows, it does not own gameplay.

## Version 3.x Notes
- Cinemachine 3.x renames types (for example `CinemachineCamera` replaces `CinemachineVirtualCamera`)
  and moves the package under `com.unity.cinemachine`. Check the installed major version before
  generating code, and do not mix 2.x and 3.x APIs.

## Testing
- Camera behaviour is time- and frame-dependent: use PlayMode tests with a few frames of settle time.
- Assert on virtual-camera state and priority transitions rather than exact world positions where
  damping makes values fuzzy.

> Verify against primary sources: Cinemachine 2.x and 3.x have different namespaces and components.
> Confirm against the installed package docs and samples.
