// scene-editing — the ADR-0018 escalation ladder as a decision helper.
//
// Scene edits are the riskiest Act ability: the API can express most changes but
// not all, and hand-authored YAML is a last resort. This ability does not mutate
// anything; it picks the correct rung for a requested change and hands the caller
// the concrete steps plus the gate plan.
import { decideEscalation, type ChangeKind, type EscalationDecision } from './escalation';
import { planActGate, type GatePlan } from './gate';
import { makeResult, type ActOptions } from './shared';
import type { ActBase } from './types';

const VALID_CHANGE_KINDS: ChangeKind[] = ['single-property', 'multi-property', 'structural', 'unsupported'];

export interface SceneEditingResult extends ActBase {
  changeKind: ChangeKind;
  requestedChangeKind: string | null;
  // Null when the requested change kind is invalid: no escalation decision was
  // actually made, so a caller cannot mistake a fallback rung for a real one.
  escalation: EscalationDecision | null;
  gate: GatePlan;
}

export function sceneEditing(options: ActOptions, cliAvailable: boolean | null = null): SceneEditingResult {
  const requested = options.changeKind?.trim() || null;
  const valid = requested && (VALID_CHANGE_KINDS as string[]).includes(requested);
  const changeKind: ChangeKind = valid ? (requested as ChangeKind) : 'single-property';
  const escalation = valid ? decideEscalation({ changeKind }) : null;

  const result: SceneEditingResult = {
    ...makeResult('scene-editing', 'observed_locally', 'Scene/prefab edit escalation decision', [], 'offline'),
    changeKind,
    requestedChangeKind: requested,
    escalation,
    gate: planActGate(options.gate, cliAvailable),
  };

  if (requested && !valid) {
    result.status = 'unknown';
    result.errors.push(`unknown --change-kind "${requested}"; no escalation decision made`);
  }
  result.summary = escalation
    ? `rung: ${escalation.rung} (${changeKind})${escalation.requiresDryRun ? ' · dry run required' : ''}`
    : `unknown change kind "${requested}"; no escalation decision made`;
  return result;
}
