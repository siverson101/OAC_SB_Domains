// Public surface of the primitive import gate (Phase 3 Step 3.3, ADR-0014).
//
// Pure, dependency-free helpers used by the import tooling and the structural
// test: decide whether a source primitive may be imported, parse its
// `primitive.yaml` contract, and read the source registry's PROVENANCE table.
export {
  ALLOWED_LICENSES,
  COPYLEFT_LICENSES,
  classifyLicense,
  decideImport,
  normalizeLicense,
  type ImportDecision,
  type ImportInput,
  type LicenseVerdict,
} from './license-gate';
export { parsePrimitiveYaml, validateContract, type ContractIssue, type PrimitiveContract } from './contract';
export { copyleftIds, licenseById, parseProvenanceTable, type ProvenanceEntry } from './provenance';
