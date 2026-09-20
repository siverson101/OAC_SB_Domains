// ADR-0018 escalation ladder for scene and prefab edits.
//
// Scene and prefab assets are GUID-linked structures that are unsafe to hand-author,
// but the inspector/SerializedProperty API cannot express every edit. The ladder is
// fixed and strict:
//
//   1. inspector / SerializedProperty API edits   (single serialized field)
//   2. prefab patch with JSON ops + mandatory dry run (multi-op / structural)
//   3. unity-yaml-editing                          (last-resort fallback)
//
// This module is a pure decision helper: it never touches an asset.

export type EscalationRung = 'inspector' | 'prefab-patch' | 'unity-yaml-editing';

export const ESCALATION_LADDER: EscalationRung[] = ['inspector', 'prefab-patch', 'unity-yaml-editing'];

export type ChangeKind = 'single-property' | 'multi-property' | 'structural' | 'unsupported';

export interface EscalationInput {
  changeKind: ChangeKind;
  opCount?: number;
  hasUnsupportedOps?: boolean;
}

export interface EscalationDecision {
  rung: EscalationRung;
  ladder: EscalationRung[];
  changeKind: ChangeKind;
  reason: string;
  requiresDryRun: boolean;
  fallback: EscalationRung | null;
  steps: string[];
}

const INSPECTOR_STEPS = [
  'Resolve the target with the inspector / SerializedObject API.',
  'Write a single SerializedProperty and call ApplyModifiedProperties.',
  'Re-read the property to confirm the write landed.',
];

const PATCH_STEPS = [
  'Describe the edit as prefab patch JSON ops (ensure_child/ensure_component/set_property/...).',
  'Run `prefab patch --dryRun true` first; the dry run must mutate nothing.',
  'Inspect the proposed ops, then re-run without --dryRun and with confirm.',
  'Validate with compile + get_logs before trusting the edit.',
];

const YAML_STEPS = [
  'Confirm the edit is genuinely unsupported by the inspector and patch ops.',
  'Load the unity-yaml-editing fallback and follow its decision order.',
  'Checkpoint the asset before editing and validate the GUID links after.',
];

export function decideEscalation(input: EscalationInput): EscalationDecision {
  const changeKind = input.hasUnsupportedOps ? 'unsupported' : input.changeKind;

  if (changeKind === 'unsupported') {
    return {
      rung: 'unity-yaml-editing',
      ladder: ESCALATION_LADDER,
      changeKind,
      reason: 'One or more ops are not expressible as inspector writes or prefab patch ops.',
      requiresDryRun: false,
      fallback: null,
      steps: YAML_STEPS,
    };
  }

  if (changeKind === 'single-property') {
    return {
      rung: 'inspector',
      ladder: ESCALATION_LADDER,
      changeKind,
      reason: 'A single serialized field is the cheapest and safest edit; start at rung 1.',
      requiresDryRun: false,
      fallback: 'prefab-patch',
      steps: INSPECTOR_STEPS,
    };
  }

  return {
    rung: 'prefab-patch',
    ladder: ESCALATION_LADDER,
    changeKind,
    reason:
      changeKind === 'structural'
        ? 'Structural child/component changes are covered by prefab patch ops, but not by a single property write.'
        : 'Multiple property writes belong in one prefab patch load/save cycle.',
    requiresDryRun: true,
    fallback: 'unity-yaml-editing',
    steps: PATCH_STEPS,
  };
}

export function inferChangeKind(ops: { op: string }[], hasUnsupportedOps: boolean): ChangeKind {
  if (hasUnsupportedOps) return 'unsupported';
  if (ops.some((op) => op.op === 'ensure_child' || op.op === 'ensure_component')) return 'structural';
  if (ops.length === 1 && ops[0]?.op === 'set_property') return 'single-property';
  return 'multi-property';
}
