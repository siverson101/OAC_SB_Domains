// Validated, dependency-free loader for `.opencode/unity-studio.json`
// (Phase 3 Step 3.4).
//
// Fail-soft: a missing file yields the defaults with no problems; a malformed
// file yields the defaults plus the problems found, so callers can report and
// keep running. No field is ever silently accepted with the wrong type — an
// invalid value is recorded as a problem and replaced by the default.

import { readText } from '../../../shared/io';
import { asRecord } from '../../../shared/json-helpers';
import {
  DEFAULT_STUDIO_CONFIG,
  REVIEW_INTENSITIES,
  STUDIO_MODES,
  type ConfigProblem,
  type ReviewIntensity,
  type StudioConfig,
  type StudioMode,
  type StudioToggles,
} from './types';

const KNOWN_KEYS = new Set([
  '$schema',
  'schemaVersion',
  'studioMode',
  'reviewIntensity',
  'toggles',
  'patterns',
  'packages',
]);

const KNOWN_TOGGLE_KEYS = new Set(['tdd', 'ftf']);

export interface StudioConfigLoad {
  // True when the file exists and parsed as JSON (even if it had problems).
  present: boolean;
  path: string;
  config: StudioConfig;
  problems: ConfigProblem[];
}

// A fresh default object every call: callers may mutate the result.
export function defaultStudioConfig(): StudioConfig {
  return {
    ...DEFAULT_STUDIO_CONFIG,
    toggles: { ...DEFAULT_STUDIO_CONFIG.toggles },
    patterns: [],
    packages: [],
  };
}

function parseStringArray(value: unknown, field: string, problems: ConfigProblem[]): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    problems.push({ field, message: 'expected an array of strings' });
    return [];
  }
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === 'string' && item.trim() !== '') {
      const id = item.trim();
      if (!out.includes(id)) out.push(id);
    } else {
      problems.push({ field, message: `ignored non-string entry ${JSON.stringify(item)}` });
    }
  }
  return out;
}

function parseMode(value: unknown, problems: ConfigProblem[]): StudioMode {
  if (value === undefined) return DEFAULT_STUDIO_CONFIG.studioMode;
  if (typeof value === 'string' && (STUDIO_MODES as readonly string[]).includes(value)) {
    return value as StudioMode;
  }
  problems.push({ field: 'studioMode', message: `expected one of ${STUDIO_MODES.join('|')}, got ${JSON.stringify(value)}` });
  return DEFAULT_STUDIO_CONFIG.studioMode;
}

function parseIntensity(value: unknown, problems: ConfigProblem[]): ReviewIntensity {
  if (value === undefined) return DEFAULT_STUDIO_CONFIG.reviewIntensity;
  if (typeof value === 'string' && (REVIEW_INTENSITIES as readonly string[]).includes(value)) {
    return value as ReviewIntensity;
  }
  problems.push({
    field: 'reviewIntensity',
    message: `expected one of ${REVIEW_INTENSITIES.join('|')}, got ${JSON.stringify(value)}`,
  });
  return DEFAULT_STUDIO_CONFIG.reviewIntensity;
}

function parseToggles(value: unknown, problems: ConfigProblem[]): StudioToggles {
  const toggles: StudioToggles = { ...DEFAULT_STUDIO_CONFIG.toggles };
  if (value === undefined) return toggles;
  const record = asRecord(value);
  if (!record) {
    problems.push({ field: 'toggles', message: 'expected an object with boolean tdd/ftf flags' });
    return toggles;
  }
  for (const key of Object.keys(record)) {
    if (!KNOWN_TOGGLE_KEYS.has(key)) problems.push({ field: `toggles.${key}`, message: 'unknown toggle' });
  }
  for (const key of KNOWN_TOGGLE_KEYS) {
    const flag = record[key];
    if (flag === undefined) continue;
    if (typeof flag === 'boolean') toggles[key as keyof StudioToggles] = flag;
    else problems.push({ field: `toggles.${key}`, message: `expected a boolean, got ${JSON.stringify(flag)}` });
  }
  return toggles;
}

export function parseStudioConfig(value: unknown): { config: StudioConfig; problems: ConfigProblem[] } {
  const problems: ConfigProblem[] = [];
  const record = asRecord(value);
  if (!record) {
    problems.push({ field: '$', message: 'config must be a JSON object' });
    return { config: defaultStudioConfig(), problems };
  }

  for (const key of Object.keys(record)) {
    if (!KNOWN_KEYS.has(key)) problems.push({ field: key, message: 'unknown property' });
  }

  let schemaVersion = DEFAULT_STUDIO_CONFIG.schemaVersion;
  if (record.schemaVersion !== undefined) {
    if (typeof record.schemaVersion === 'number' && Number.isFinite(record.schemaVersion)) {
      schemaVersion = record.schemaVersion;
    } else {
      problems.push({ field: 'schemaVersion', message: `expected a number, got ${JSON.stringify(record.schemaVersion)}` });
    }
  }

  const config: StudioConfig = {
    schemaVersion,
    studioMode: parseMode(record.studioMode, problems),
    reviewIntensity: parseIntensity(record.reviewIntensity, problems),
    toggles: parseToggles(record.toggles, problems),
    patterns: parseStringArray(record.patterns, 'patterns', problems),
    packages: parseStringArray(record.packages, 'packages', problems),
  };

  return { config, problems };
}

export function loadStudioConfig(path: string): StudioConfigLoad {
  const text = readText(path);
  if (text === null) return { present: false, path, config: defaultStudioConfig(), problems: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      present: true,
      path,
      config: defaultStudioConfig(),
      problems: [{ field: '$', message: `invalid JSON: ${error instanceof Error ? error.message : String(error)}` }],
    };
  }

  const { config, problems } = parseStudioConfig(parsed);
  return { present: true, path, config, problems };
}
