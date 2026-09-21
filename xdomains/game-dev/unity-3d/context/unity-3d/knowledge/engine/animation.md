<!-- Context: unity-3d/knowledge/engine/animation | Priority: high | Version: 1.0 | Updated: 2026-09-20 | Unity: 6.0,6.3,6.5,LTS+ -->

# Animation (Unity 6.x)

Scope: skeletal animation, the Animator state machine, Timeline, and procedural/animation rigging.

## Animator
- An **Animator Controller** is a state machine of AnimationClips with parameters (float, int, bool,
  trigger) driving transitions.
- Prefer **hashed** parameter names: `Animator.StringToHash("Speed")`; never call `SetFloat("Speed")`
  with a string per frame.
- State machines scale badly: use sub-state machines and blend trees; keep transition counts low and
  avoid `Any State` transitions that fire every frame.
- Avatar masks split a skeleton so upper/lower body clips layer independently.

## Import and Rigging
- Humanoid rigs enable retargeting across humanoid characters; Generic rigs are for non-humanoid.
- Set **root motion** on the clip only when the animation should drive the transform; otherwise keep
  root motion in code.
- Optimise clip import: disable unnecessary curves, set compression, and enable `Optimize Game Objects`.

## Timeline and Sequencing
- Use **Timeline** (`com.unity.timeline`) for cutscenes and scripted sequences: tracks for animation,
  audio, activation, and custom `PlayableBehaviour`.
- Timeline is authored content; drive gameplay hooks through Signals or clip callbacks rather than
  polling.

## Procedural Animation
- `OnAnimatorIK` drives IK goals for foot placement and look-at; enable the matching IK pass.
- Use `Animator.MatchTarget` for ledge/vault alignment.
- DOTS/ECS animation is available through the Entities package for large crowds; keep it isolated from
  GameObject-based animation.

## Performance
- Cap the Animator count on screen; culling mode `Cull Update Transforms` saves CPU.
- Prefer GPU skinning for dense meshes; batch skinned renderers where possible.

> Verify against primary sources: Animator features, Timeline package versions and ECS animation
> support vary by editor version. Confirm against the Animation and Timeline package docs.
