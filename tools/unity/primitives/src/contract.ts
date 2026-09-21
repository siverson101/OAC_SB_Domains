// Minimal reader for `primitive.yaml` contracts (Phase 3 Step 3.3).
//
// The build toolchain has no YAML dependency, so the shared `tools/shared/yaml`
// subset parser is reused here. This module maps its generic tree onto the
// contract fields the structural check needs: the scalar identity fields and the
// `setup_steps` / `code_files` lists. Nested maps (`requires`, `provides`) and
// unrelated keys are ignored.
import { parseYaml, type YamlValue } from '../../../shared/yaml';

export interface PrimitiveContract {
  id: string;
  name: string;
  category: string;
  status: string;
  summary: string;
  sourceRepo: string;
  license: string;
  setupSteps: string[];
  codeFiles: string[];
}

export interface ContractIssue {
  field: string;
  message: string;
}

function asRecord(value: YamlValue): Record<string, YamlValue> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asString(value: YamlValue | undefined): string {
  return typeof value === 'string' ? value : '';
}

function asStringList(value: YamlValue | undefined): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function parsePrimitiveYaml(text: string): PrimitiveContract {
  const record = asRecord(parseYaml(text));
  return {
    id: asString(record.id),
    name: asString(record.name),
    category: asString(record.category),
    status: asString(record.status),
    summary: asString(record.summary),
    sourceRepo: asString(record.source_repo),
    license: asString(record.license),
    setupSteps: asStringList(record.setup_steps),
    codeFiles: asStringList(record.code_files),
  };
}

export function validateContract(contract: PrimitiveContract, expectedId: string): ContractIssue[] {
  const issues: ContractIssue[] = [];
  if (!contract.id) issues.push({ field: 'id', message: 'missing id' });
  else if (contract.id !== expectedId) issues.push({ field: 'id', message: `id '${contract.id}' does not match directory '${expectedId}'` });
  if (!contract.name) issues.push({ field: 'name', message: 'missing name' });
  if (!contract.category) issues.push({ field: 'category', message: 'missing category' });
  if (!contract.summary) issues.push({ field: 'summary', message: 'missing summary' });
  if (contract.setupSteps.length === 0) issues.push({ field: 'setup_steps', message: 'missing setup_steps' });
  if (contract.codeFiles.length === 0) issues.push({ field: 'code_files', message: 'missing code_files' });
  if (contract.status === 'extracted') {
    if (!contract.sourceRepo) issues.push({ field: 'source_repo', message: 'status extracted requires source_repo' });
    if (!contract.license) issues.push({ field: 'license', message: 'status extracted requires license' });
  }
  return issues;
}
