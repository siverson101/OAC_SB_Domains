#!/usr/bin/env node
'use strict';

// Studio-mode swap for the Unity 3D sub-domain (Phase 7 Step 7.2, ADR-0013).
//
// One canonical swap: back up the installed agent set, install the requested
// hierarchy through the Phase 4 apply engine (`merge-domains.js`), and refresh
// the registry. Only the agent set changes; project-data, context, commands,
// abilities, recipes and config are preserved. Agent metadata is reconciled to
// the active hierarchy (the engine prunes the other hierarchy's entries).
//
// Usage:
//   node unity-studio-mode.js --opencode-dir .opencode --mode <lean|full> [--json]
//
// An absent or unknown mode refuses loudly and writes nothing.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('node:child_process');

const ENGINE = path.resolve(__dirname, '../../../merge-domains.js');
const DOMAIN_DIR = path.resolve(__dirname, '..');
const REGISTRY_BUNDLE = path.resolve(__dirname, '../../../scripts/shared/build-registry.mjs');
const BACKUP_ROOT = path.join('backups', 'unity-studio-mode');
const METADATA_REL = path.join('config', 'agent-metadata.json');

let engine;
try {
  engine = require(ENGINE);
} catch (error) {
  process.stderr.write(`cannot load the apply engine at ${ENGINE}: ${error.message}\n`);
  process.exit(2);
}

const {
  normalizeStudioMode,
  readExistingStudioMode,
  resolveGating,
  selectHierarchy,
  parseArgs,
} = engine;

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

// Millisecond-resolution timestamps can collide when two swaps land in the same
// tick; suffix until the backup dir is unique so a backup is never overwritten.
function uniqueBackupDir(base, name) {
  let candidate = path.join(base, name);
  let suffix = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(base, `${name}-${suffix}`);
    suffix += 1;
  }
  return candidate;
}

function pruneEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) pruneEmptyDirs(full);
  }
  if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}

function main() {
  const argv = parseArgs(process.argv.slice(2));
  const json = Boolean(argv.json);
  const opencodeDir = path.resolve(argv['opencode-dir'] || path.join(process.cwd(), '.opencode'));

  const refuse = (message) => {
    if (json) process.stdout.write(JSON.stringify({ status: 'refused', errors: [message] }, null, 2) + '\n');
    process.stderr.write(`${message}\n`);
    process.exitCode = 2;
  };

  const flag = argv.mode !== undefined ? argv.mode : argv['studio-mode'];
  const raw = flag !== undefined ? flag : (argv._ || [])[0];
  if (raw === undefined) return refuse('no studio mode given; expected lean or full');
  if (raw === true) return refuse('--mode requires a value: lean or full');
  const requested = normalizeStudioMode(String(raw));
  if (!requested) return refuse(`Unknown studio mode: ${raw} (expected lean or full)`);

  const manifestPath = path.join(DOMAIN_DIR, 'sb-domain.json');
  if (!fs.existsSync(manifestPath)) return refuse(`no sb-domain.json found in ${DOMAIN_DIR}`);
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    return refuse(`cannot read sb-domain.json in ${DOMAIN_DIR}: ${error.message}`);
  }

  const configPath = path.join(opencodeDir, 'unity-studio.json');
  const previousMode = readExistingStudioMode(opencodeDir) || 'lean';
  const gating = resolveGating(opencodeDir);
  const rosterFor = (mode) => {
    const { agents, subagents } = selectHierarchy(manifest, mode, gating, { domainDir: DOMAIN_DIR });
    return [...agents, ...subagents];
  };

  const backupEntries = rosterFor(previousMode).filter((rel) => fs.existsSync(path.join(opencodeDir, rel)));
  if (fs.existsSync(configPath)) backupEntries.push('unity-studio.json');
  if (fs.existsSync(path.join(opencodeDir, METADATA_REL))) backupEntries.push(METADATA_REL);

  let backupDir = null;
  if (backupEntries.length > 0) {
    backupDir = uniqueBackupDir(path.join(opencodeDir, BACKUP_ROOT), timestamp());
    for (const rel of backupEntries) {
      const dest = path.join(backupDir, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(path.join(opencodeDir, rel), dest);
    }
  }

  const removed = [];
  for (const rel of rosterFor(previousMode)) {
    const target = path.join(opencodeDir, rel);
    if (fs.existsSync(target)) {
      fs.rmSync(target);
      removed.push(rel);
    }
  }
  pruneEmptyDirs(path.join(opencodeDir, 'agent'));

  const apply = spawnSync(
    process.execPath,
    [
      ENGINE,
      '--domain-dir', DOMAIN_DIR,
      '--opencode-dir', opencodeDir,
      '--mode', 'replace',
      '--studio-mode', requested,
      '--prune-metadata',
    ],
    { encoding: 'utf8' }
  );

  if (apply.status !== 0) {
    for (const rel of rosterFor(requested)) {
      try { fs.rmSync(path.join(opencodeDir, rel), { force: true }); } catch (_) { /* ignore */ }
    }
    if (backupDir) {
      for (const rel of backupEntries) {
        const dest = path.join(opencodeDir, rel);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(path.join(backupDir, rel), dest);
      }
    }
    process.stderr.write(apply.stderr.trim() || 'apply engine failed; restored the backed-up agent set\n');
    process.exitCode = 1;
    return;
  }

  let registry = 'unavailable';
  if (fs.existsSync(REGISTRY_BUNDLE)) {
    const reg = spawnSync(
      process.execPath,
      [REGISTRY_BUNDLE, '--domain-dir', DOMAIN_DIR, '--opencode-dir', opencodeDir],
      { encoding: 'utf8' }
    );
    registry = reg.status === 0 ? 'regenerated' : 'failed';
    if (reg.status !== 0) process.stderr.write(`  warning: registry regeneration failed: ${reg.stderr.trim()}\n`);
  } else {
    process.stderr.write(`  warning: registry bundle not found at ${REGISTRY_BUNDLE}; skipped\n`);
  }

  const result = {
    status: previousMode === requested ? 'reapplied' : 'swapped',
    previousMode,
    studioMode: requested,
    backupDir: backupDir ? path.relative(opencodeDir, backupDir).split(path.sep).join('/') : null,
    backedUp: backupEntries,
    removed,
    registry,
  };

  if (json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }

  process.stdout.write(`${result.status}: ${previousMode} -> ${requested}\n`);
  process.stdout.write(`  backed up: ${backupEntries.length} file(s)${backupDir ? ` -> ${result.backupDir}` : ''}\n`);
  process.stdout.write(`  removed: ${removed.length} agent file(s)\n`);
  process.stdout.write(`  registry: ${registry}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
