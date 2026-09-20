#!/usr/bin/env node
// Generic interactive prompt runner built on @clack/prompts.
//
// Reads a JSON question spec, asks the questions in the terminal, and writes the
// answers as JSON. Designed to be called by domain hooks so the LLM delegates the
// questioning and only consumes the resulting answers.
//
// Usage:
//   node prompt.mjs --spec <file|-> [--out <file|->] [--defaults] [--title "..."]
//
// Spec shape:
//   {
//     "title": "optional intro line",
//     "questions": [
//       { "id": "ui", "type": "select", "message": "What UI ...?",
//         "options": [{ "value": "UGUI", "label": "UGUI", "hint": "optional" }],
//         "initialValue": "UGUI" },
//       { "id": "systems", "type": "multiselect", "message": "...",
//         "options": [{ "value": "a", "label": "A" }], "initialValues": ["a"] },
//       { "id": "name", "type": "text", "message": "...",
//         "placeholder": "...", "defaultValue": "" },
//       { "id": "enable", "type": "confirm", "message": "...", "initialValue": true }
//     ]
//   }
//
// Output (written to --out, or stdout when --out is omitted or "-"):
//   { "title": "...", "cancelled": false, "answers": { "ui": "UGUI", ... } }
//
// --defaults answers every question from its initial/default value without any
// terminal interaction; useful for CI and as a non-interactive fallback.

import {
  intro,
  outro,
  note,
  text,
  select,
  multiselect,
  confirm,
  isCancel,
  cancel,
} from '@clack/prompts';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

function parseArgs(argv) {
  const out = {};
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith('--') && arg.includes('=')) {
      const eq = arg.indexOf('=');
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
      i++;
      continue;
    }
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out[key] = next;
        i += 2;
      } else {
        out[key] = true;
        i++;
      }
      continue;
    }
    i++;
  }
  return out;
}

function readInput(pathOrDash) {
  if (pathOrDash === '-') {
    return readFileSync(0, 'utf8');
  }
  return readFileSync(resolve(pathOrDash), 'utf8');
}

function writeOutput(pathOrDash, value) {
  const body = JSON.stringify(value, null, 2) + '\n';
  if (!pathOrDash || pathOrDash === '-') {
    process.stdout.write(body);
    return;
  }
  const dest = resolve(pathOrDash);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, body);
}

function normalizeOptions(options, questionId) {
  if (!Array.isArray(options) || options.length === 0) {
    throw new Error(`Question "${questionId}" must define a non-empty options array`);
  }
  return options.map((opt) => {
    if (typeof opt === 'string') return { value: opt, label: opt };
    if (!opt || typeof opt !== 'object' || opt.value === undefined) {
      throw new Error(`Question "${questionId}" has an option without a value`);
    }
    return { value: opt.value, label: opt.label ?? String(opt.value), hint: opt.hint };
  });
}

function defaultAnswer(question) {
  switch (question.type) {
    case 'select': {
      const options = normalizeOptions(question.options, question.id);
      return question.initialValue ?? options[0].value;
    }
    case 'multiselect':
      return question.initialValues ?? [];
    case 'text':
      return question.defaultValue ?? '';
    case 'confirm':
      return question.initialValue ?? false;
    default:
      throw new Error(`Unknown question type: ${question.type}`);
  }
}

function validateSpec(spec) {
  if (!spec || typeof spec !== 'object') throw new Error('Spec must be a JSON object');
  if (!Array.isArray(spec.questions) || spec.questions.length === 0) {
    throw new Error('Spec must contain a non-empty "questions" array');
  }
  const seen = new Set();
  for (const q of spec.questions) {
    if (!q.id || typeof q.id !== 'string') throw new Error('Every question needs a string "id"');
    if (seen.has(q.id)) throw new Error(`Duplicate question id: ${q.id}`);
    seen.add(q.id);
    if (!q.message) throw new Error(`Question "${q.id}" needs a "message"`);
    if (!['select', 'multiselect', 'text', 'confirm'].includes(q.type)) {
      throw new Error(`Question "${q.id}" has unsupported type: ${q.type}`);
    }
    if (q.type === 'select' || q.type === 'multiselect') normalizeOptions(q.options, q.id);
  }
}

async function askQuestions(spec, { defaults }) {
  const answers = {};
  if (defaults) {
    for (const q of spec.questions) answers[q.id] = defaultAnswer(q);
    return answers;
  }

  if (spec.title) intro(spec.title);

  for (const q of spec.questions) {
    let value;
    switch (q.type) {
      case 'select':
        value = await select({
          message: q.message,
          options: normalizeOptions(q.options, q.id),
          initialValue: q.initialValue,
        });
        break;
      case 'multiselect':
        value = await multiselect({
          message: q.message,
          options: normalizeOptions(q.options, q.id),
          initialValues: q.initialValues,
          required: q.required !== false,
        });
        break;
      case 'text':
        value = await text({
          message: q.message,
          placeholder: q.placeholder,
          defaultValue: q.defaultValue,
          initialValue: q.initialValue,
        });
        break;
      case 'confirm':
        value = await confirm({
          message: q.message,
          initialValue: q.initialValue ?? false,
        });
        break;
      default:
        throw new Error(`Unknown question type: ${q.type}`);
    }

    if (isCancel(value)) {
      cancel('Cancelled');
      return null;
    }
    answers[q.id] = value;
  }

  if (spec.title) outro('Answers recorded');
  return answers;
}

function printHelp() {
  process.stdout.write(
    [
      'prompt.mjs - run a JSON-defined set of interactive questions',
      '',
      'Usage:',
      '  node prompt.mjs --spec <file|-> [--out <file|->] [--defaults] [--title "..."]',
      '',
      'Options:',
      '  --spec FILE    JSON question spec (use - for stdin). Required.',
      '  --out FILE     Where to write answers JSON (use - or omit for stdout).',
      '  --defaults     Answer from initial/default values without prompting.',
      '  --title TEXT   Override the spec title used for the intro/outro.',
      '  --help, -h     Show this help.',
      '',
    ].join('\n')
  );
}

async function main() {
  const argv = parseArgs(process.argv.slice(2));
  if (argv.help || argv.h) {
    printHelp();
    return;
  }
  if (!argv.spec) {
    printHelp();
    process.exitCode = 2;
    return;
  }

  const spec = JSON.parse(readInput(argv.spec));
  if (argv.title) spec.title = argv.title;
  validateSpec(spec);

  const defaults = Boolean(argv.defaults);
  const answers = await askQuestions(spec, { defaults });

  if (answers === null) {
    writeOutput(argv.out, { title: spec.title ?? null, cancelled: true, answers: {} });
    process.exitCode = 130;
    return;
  }

  if (defaults && spec.title) note('Using default answers (--defaults)', 'non-interactive');
  writeOutput(argv.out, { title: spec.title ?? null, cancelled: false, answers });
}

main().catch((err) => {
  process.stderr.write(`prompt.mjs: ${err && err.message ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
