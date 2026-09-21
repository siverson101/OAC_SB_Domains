// Shared text canonicalisation for comparison.
//
// Collapses runs of whitespace to a single space and lowercases, so two
// spellings that differ only in spacing or case compare equal. Used for test
// conditions/assertions and for checklist steps.
export function canonicalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}
