// Canonical "which agents are active" semantics shared by the registry and the
// apply engine (Phase 4, ticket 04). Membership comes from `studioModes`; the
// gating condition lives once, in each optional agent's frontmatter `enabledBy`.
//
// An optional path with no `enabledBy` is always active; a path whose
// `enabledBy` names a gate is active only when that gate holds.

export const STUDIO_GATES = ['tdd', 'native-subproject'] as const;
export type StudioGate = (typeof STUDIO_GATES)[number];
export type StudioGates = Record<StudioGate, boolean>;

export interface StudioModeRoster {
  agents: string[];
  subagents: string[];
  optional: string[];
}

// `optional` is a list of paths; the object form is tolerated for fail-soft
// reads of an older manifest.
export function optionalPaths(optional: (string | { path?: string })[] | undefined): string[] {
  const out: string[] = [];
  for (const entry of optional ?? []) {
    const rel = typeof entry === 'string' ? entry : entry?.path;
    if (rel) out.push(rel);
  }
  return out;
}

export function isGateEnabled(enabledBy: string | undefined, gates: StudioGates): boolean {
  if (enabledBy === undefined) return true;
  return gates[enabledBy as StudioGate] === true;
}

export function selectActiveRoster(
  source: StudioModeRoster,
  gates: StudioGates,
  enabledByFor: (path: string) => string | undefined
): { agents: string[]; subagents: string[] } {
  const agents = [...source.agents];
  const subagents = [...source.subagents];
  for (const path of source.optional) {
    if (isGateEnabled(enabledByFor(path), gates)) subagents.push(path);
  }
  return { agents, subagents };
}

export function emptyStudioGates(): StudioGates {
  return { tdd: false, 'native-subproject': false };
}
