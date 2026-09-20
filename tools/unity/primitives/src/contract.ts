// Minimal, dependency-free reader for `primitive.yaml` contracts (Phase 3
// Step 3.3).
//
// The build toolchain has no YAML dependency, and the contract files use a
// flat, predictable shape, so this reader extracts only the fields the
// structural check needs: the scalar identity fields and the `setup_steps` /
// `code_files` lists. It deliberately ignores nested maps (`requires`,
// `provides`) and unrelated keys.

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

const SCALAR_KEYS = new Set(['id', 'name', 'category', 'status', 'summary', 'source_repo', 'license']);
const LIST_KEYS = new Set(['setup_steps', 'code_files']);

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  const quoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2);
  return quoted ? trimmed.slice(1, -1) : trimmed;
}

function splitInlineList(value: string): string[] {
  const inner = value.slice(1, -1).trim();
  if (!inner) return [];
  return inner
    .split(',')
    .map(stripQuotes)
    .filter((entry) => entry.length > 0);
}

export function parsePrimitiveYaml(text: string): PrimitiveContract {
  const scalars: Record<string, string> = {};
  const setupSteps: string[] = [];
  const codeFiles: string[] = [];
  let currentKey = '';

  for (const rawLine of text.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const indent = rawLine.length - rawLine.trimStart().length;
    const topLevel = indent === 0 ? /^([A-Za-z_][A-Za-z0-9_]*):(.*)$/.exec(rawLine) : null;

    if (topLevel) {
      currentKey = topLevel[1];
      const inline = topLevel[2].trim();
      if (LIST_KEYS.has(currentKey)) {
        if (inline.startsWith('[') && inline.endsWith(']')) {
          const items = splitInlineList(inline);
          if (currentKey === 'code_files') codeFiles.push(...items);
          else setupSteps.push(...items);
        }
      } else if (SCALAR_KEYS.has(currentKey) && inline) {
        scalars[currentKey] = stripQuotes(inline);
      }
      continue;
    }

    if (/^\s*-\s+/.test(rawLine)) {
      const item = stripQuotes(rawLine.replace(/^\s*-\s+/, ''));
      if (currentKey === 'code_files') codeFiles.push(item);
      else if (currentKey === 'setup_steps') setupSteps.push(item);
      continue;
    }

    // Folded/scalar continuation (e.g. a wrapped `summary`).
    if (indent > 0 && SCALAR_KEYS.has(currentKey) && scalars[currentKey]) {
      scalars[currentKey] = `${scalars[currentKey]} ${trimmed}`;
    }
  }

  return {
    id: scalars.id ?? '',
    name: scalars.name ?? '',
    category: scalars.category ?? '',
    status: scalars.status ?? '',
    summary: scalars.summary ?? '',
    sourceRepo: scalars.source_repo ?? '',
    license: scalars.license ?? '',
    setupSteps,
    codeFiles,
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
