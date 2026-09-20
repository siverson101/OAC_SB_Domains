// Single enforcement point for the capability-contract `safetyGate` flags.
//
// The schema declares six optional boolean flags; an absent flag means "not
// declared" and must be treated as false, never "unknown". Keeping the key list
// and the absent-to-false coercion here stops each family (and Phase 6) from
// re-deriving that convention.
export const SAFETY_GATE_KEYS = [
  'mutates',
  'requiresEditor',
  'requiresApproval',
  'dryRunFirst',
  'advisory',
  'writesState',
] as const;

export function safetyGateFlag(gate: unknown, key: string): boolean {
  if (gate === null || typeof gate !== 'object' || Array.isArray(gate)) return false;
  const value = (gate as Record<string, unknown>)[key];
  return typeof value === 'boolean' ? value : false;
}
