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
  MODEL_TIERS,
  REVIEW_INTENSITIES,
  STUDIO_CONFIG_SCHEMA_VERSION,
  STUDIO_MODES,
  UI_STACKS,
  type ConfigProblem,
  type ModelTier,
  type ModelTiers,
  type ReviewIntensity,
  type StudioConfig,
  type StudioMode,
  type StudioToggles,
  type UiStack,
} from './types';

const KNOWN_KEYS = new Set([
  '$schema',
  'schemaVersion',
  'studioMode',
  'reviewIntensity',
  'uiStack',
  'toggles',
  'patterns',
  'packages',
  'modelTiers',
]);

const KNOWN_TOGGLE_KEYS = new Set(['tdd', 'ftf', 'unitySkills']);

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
    modelTiers: { ...DEFAULT_STUDIO_CONFIG.modelTiers },
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

function parseUiStack(value: unknown, problems: ConfigProblem[]): UiStack {
  if (value === undefined) return DEFAULT_STUDIO_CONFIG.uiStack;
  if (typeof value === 'string' && (UI_STACKS as readonly string[]).includes(value)) {
    return value as UiStack;
  }
  problems.push({ field: 'uiStack', message: `expected one of ${UI_STACKS.join('|')}, got ${JSON.stringify(value)}` });
  return DEFAULT_STUDIO_CONFIG.uiStack;
}

function parseToggles(value: unknown, problems: ConfigProblem[]): StudioToggles {
  const toggles: StudioToggles = { ...DEFAULT_STUDIO_CONFIG.toggles };
  if (value === undefined) return toggles;
  const record = asRecord(value);
  if (!record) {
    problems.push({ field: 'toggles', message: 'expected an object with boolean tdd/ftf/unitySkills flags' });
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

function parseModelTiers(value: unknown, problems: ConfigProblem[]): ModelTiers {
  const tiers: ModelTiers = {};
  if (value === undefined) return tiers;
  const record = asRecord(value);
  if (!record) {
    problems.push({
      field: 'modelTiers',
      message: `expected an object mapping ${MODEL_TIERS.join('|')} to a model id`,
    });
    return tiers;
  }
  for (const key of Object.keys(record)) {
    if (!(MODEL_TIERS as readonly string[]).includes(key)) {
      problems.push({ field: `modelTiers.${key}`, message: `unknown tier; expected one of ${MODEL_TIERS.join('|')}` });
      continue;
    }
    const model = record[key];
    if (typeof model !== 'string' || model.trim() === '') {
      problems.push({
        field: `modelTiers.${key}`,
        message: `expected a non-empty model id string, got ${JSON.stringify(model)}`,
      });
      continue;
    }
    tiers[key as ModelTier] = model.trim();
  }
  return tiers;
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
    if (typeof record.schemaVersion !== 'number' || !Number.isFinite(record.schemaVersion)) {
      problems.push({ field: 'schemaVersion', message: `expected a number, got ${JSON.stringify(record.schemaVersion)}` });
    } else if (record.schemaVersion !== STUDIO_CONFIG_SCHEMA_VERSION) {
      problems.push({
        field: 'schemaVersion',
        message: `unsupported schema version ${JSON.stringify(record.schemaVersion)}, expected ${STUDIO_CONFIG_SCHEMA_VERSION}`,
      });
    } else {
      schemaVersion = record.schemaVersion;
    }
  }

  const config: StudioConfig = {
    schemaVersion,
    studioMode: parseMode(record.studioMode, problems),
    reviewIntensity: parseIntensity(record.reviewIntensity, problems),
    uiStack: parseUiStack(record.uiStack, problems),
    toggles: parseToggles(record.toggles, problems),
    patterns: parseStringArray(record.patterns, 'patterns', problems),
    packages: parseStringArray(record.packages, 'packages', problems),
    modelTiers: parseModelTiers(record.modelTiers, problems),
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
