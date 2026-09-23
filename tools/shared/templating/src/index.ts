// Shared multi-axis agent templating tool (ADR-0020).
//
// Usage:
//   template-agent.mjs --template <path> --manifest <path> \
//       --axes ui_stack=ugui,unity_skills=sk --out <path>
//   template-agent.mjs --template <path> --manifest <path> \
//       --axes ... --print
//   template-agent.mjs --manifest <path> --generate   # write every variant
//   template-agent.mjs --manifest <path> --combinations
//
// One implementation, called by the apply engine (install) and by CI (parity).
// It never invents values: an unknown placeholder or an invalid selection throws.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { firstString, parseArgs } from '../../cli-args';
import { parseBool } from '../../json-helpers';
import { readText } from '../../io';
import {
  combinations,
  parseManifest,
  parseSelection,
  resolveTemplate,
  TEMPLATE_SCHEMA_VERSION,
} from './resolve';
import type { TemplateManifest } from './types';

interface Options {
  template: string | null;
  manifest: string;
  axes: string | null;
  out: string | null;
  print: boolean;
  generate: boolean;
  listCombinations: boolean;
}

function resolveOptions(argv: string[]): Options {
  const { values } = parseArgs(argv);
  return {
    template: firstString(values, ['template']) ?? null,
    manifest: firstString(values, ['manifest']) ?? '',
    axes: firstString(values, ['axes']) ?? null,
    out: firstString(values, ['out']) ?? null,
    print: parseBool(values.print, false),
    generate: parseBool(values.generate, false),
    listCombinations: parseBool(values.combinations, false),
  };
}

function loadManifest(path: string): TemplateManifest {
  const text = readText(path);
  if (text === null) throw new Error(`manifest not found: ${path}`);
  return parseManifest(JSON.parse(text));
}

function writeOut(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content.endsWith('\n') ? content : `${content}\n`);
}

export function run(argv: string[]): number {
  const options = resolveOptions(argv);
  if (!options.manifest) {
    process.stderr.write('usage: template-agent.mjs --manifest <path> [--template <path> --axes id=value,...] [--out <path>|--print|--generate|--combinations]\n');
    return 2;
  }

  const manifest = loadManifest(options.manifest);

  if (options.listCombinations) {
    for (const combo of combinations(manifest)) {
      process.stdout.write(`${Object.entries(combo).map(([k, v]) => `${k}=${v}`).join(',')}\n`);
    }
    return 0;
  }

  const templateDir = options.template ? dirname(options.template) : dirname(options.manifest);

  if (options.generate) {
    if (!options.template) throw new Error('--generate requires --template');
    const template = readText(options.template);
    if (template === null) throw new Error(`template not found: ${options.template}`);
    for (const combo of combinations(manifest)) {
      const resolved = resolveTemplate(template, manifest, combo);
      writeOut(join(templateDir, resolved.filename), resolved.content);
    }
    return 0;
  }

  if (!options.template) throw new Error('--template is required (or use --generate)');
  const template = readText(options.template);
  if (template === null) throw new Error(`template not found: ${options.template}`);
  if (!options.axes) throw new Error('--axes id=value,... is required');

  const resolved = resolveTemplate(template, manifest, parseSelection(options.axes));

  if (options.out) {
    writeOut(options.out, resolved.content);
    return 0;
  }
  if (options.print) {
    process.stdout.write(resolved.content);
    return 0;
  }
  // Default: print the resolved filename (used by dry runs).
  process.stdout.write(`${resolved.filename}\n`);
  return 0;
}

export { resolveTemplate, parseManifest, combinations, parseSelection, TEMPLATE_SCHEMA_VERSION };
export type { TemplateManifest } from './types';

try {
  process.exitCode = run(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
