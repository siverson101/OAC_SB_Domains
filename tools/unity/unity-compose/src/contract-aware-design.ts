// contract-aware-design — validate capabilities against the unified contract
// schema (ADR-0012, `xdomains/context/capability-contract.schema.json`).
//
// Every command/ability markdown file carries contract frontmatter. This ability
// parses that frontmatter and validates it against the JSON schema so a design
// can be checked without reading each file by hand. Offline, read-only and
// fail-soft.
import { readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { dirExists, readJson, readText, toPosix } from '../../../shared/io';
import { parseFrontmatter } from '../../../shared/registry/src/frontmatter';
import { validateContract } from '../../../shared/registry/src/contract';
import { makeResult, type ComposeBase, type ComposeOptions, type Json } from './shared';

export interface ContractCheck {
  id: string;
  path: string;
  family: string | null;
  mode: string | null;
  ok: boolean;
  errors: string[];
}

export interface ContractAwareResult extends ComposeBase {
  schemaPath: string;
  capabilitiesDir: string;
  checked: number;
  valid: number;
  invalid: number;
  results: ContractCheck[];
}

export function defaultCapabilitiesDir(options: ComposeOptions): string {
  return join(options.projectRoot, 'xdomains', 'game-dev', 'unity-3d', 'command');
}

export function defaultSchemaPath(options: ComposeOptions): string {
  return join(options.projectRoot, 'xdomains', 'context', 'capability-contract.schema.json');
}

export function listMarkdown(dir: string): string[] {
  const files: string[] = [];
  const walk = (current: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(current, entry);
      let directory = false;
      try {
        directory = statSync(full).isDirectory();
      } catch {
        continue;
      }
      if (directory) {
        walk(full);
        continue;
      }
      if (entry.endsWith('.md')) files.push(full);
    }
  };
  walk(dir);
  return files.sort();
}

export function checkCapability(path: string, schema: Record<string, unknown>): ContractCheck {
  const text = readText(path);
  const id = basename(path, '.md');
  if (text === null) {
    return { id, path: toPosix(path), family: null, mode: null, ok: false, errors: ['unreadable file'] };
  }
  const frontmatter = parseFrontmatter(text);
  const data = frontmatter as Record<string, unknown>;
  const validation = validateContract(data, schema as Parameters<typeof validateContract>[1]);
  const family = typeof data.family === 'string' ? data.family : null;
  const mode = typeof data.mode === 'string' ? data.mode : null;
  return {
    id: typeof data.id === 'string' ? data.id : id,
    path: toPosix(path),
    family,
    mode,
    ok: validation.ok,
    errors: validation.errors,
  };
}

export function runContractAwareDesign(options: ComposeOptions): ContractAwareResult {
  const schemaPath = options.schema ?? defaultSchemaPath(options);
  const capabilitiesDir = options.capabilitiesDir ?? defaultCapabilitiesDir(options);
  const schema = readJson<Json>(schemaPath);

  if (!schema) {
    const base = makeResult('contract-aware-design', 'unavailable', `no contract schema at ${toPosix(schemaPath)}`, []);
    return { ...base, schemaPath: toPosix(schemaPath), capabilitiesDir: toPosix(capabilitiesDir), checked: 0, valid: 0, invalid: 0, results: [] };
  }
  if (!dirExists(capabilitiesDir)) {
    const base = makeResult('contract-aware-design', 'unavailable', `no capabilities directory at ${toPosix(capabilitiesDir)}`, []);
    return { ...base, schemaPath: toPosix(schemaPath), capabilitiesDir: toPosix(capabilitiesDir), checked: 0, valid: 0, invalid: 0, results: [] };
  }

  const results = listMarkdown(capabilitiesDir).map((path) => checkCapability(path, schema));
  const valid = results.filter((result) => result.ok).length;
  const invalid = results.length - valid;
  const status = invalid > 0 ? 'observed_locally' : 'ok';
  const summary = `${results.length} capability contract(s) checked; ${valid} valid, ${invalid} invalid`;
  const base = makeResult('contract-aware-design', status, summary, []);
  return { ...base, schemaPath: toPosix(schemaPath), capabilitiesDir: toPosix(capabilitiesDir), checked: results.length, valid, invalid, results };
}
