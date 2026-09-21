// Shared kebab-case slug validation for artifact names.
//
// Feature slugs become file names under `.opencode/<dir>/`, so they must be
// restricted to a safe kebab-case alphabet; a slug such as `../escape` must be
// rejected before it reaches a path join. Kept in one place so the compose
// plan/test-plan artifacts and the verify test-dedup artifact cannot drift.
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}
