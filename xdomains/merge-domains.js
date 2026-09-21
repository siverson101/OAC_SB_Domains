#!/usr/bin/env node
'use strict';

// Extra-domain (xdomain) merge engine.
//
// Reads a sub-domain's sb-domain.json manifest, copies its declared assets into a
// project's OpenCode directory using the chosen merge mode, registers agent
// metadata, and (for global/custom installs) rewrites .opencode/context
// references to the real install path.
//
// Usage:
//   node merge-domains.js --domain-dir .opencode/xdomains/game-dev/unity-3d \
//        --opencode-dir <dir> [--subdomain unity-3d] \
//        [--mode extend|separate|replace] [--studio-mode lean|full] [--dry-run] \
//        [--no-register-metadata] [--no-rewrite-paths] [--force]
//
// The domain and sub-domain are read from sb-domain.json; --subdomain is an
// optional override.
//
// Merge modes:
//   extend   (default) keep existing files; on collision write {subdomain}_{name}
//   separate namespace assets under the sub-domain (assets already carrying the
//            sub-domain segment keep their path)
//   replace  overwrite default locations (the caller is responsible for backups)

const fs = require('fs');
const path = require('path');

const DEFAULT_MANIFEST = 'sb-domain.json';
const STUDIO_MODES = ['lean', 'full'];

// ---------------------------------------------------------------------------
// Studio-mode selection
// ---------------------------------------------------------------------------

function normalizeStudioMode(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'lean') return 'lean';
  if (normalized === 'full') return 'full';
  return null;
}

// Non-spinning prompt: node:readline/promises reads a line without the EAGAIN
// spin the previous byte-loop had, and the interface is always closed.
async function promptStudioMode(question) {
  const readline = require('node:readline/promises');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

function optionalPaths(optional) {
  const out = [];
  for (const entry of optional || []) {
    const rel = typeof entry === 'string' ? entry : entry && entry.path;
    if (rel) out.push(rel);
  }
  return out;
}

function readStudioConfig(opencodeDir) {
  const file = path.join(opencodeDir, 'unity-studio.json');
  if (!isFile(file)) return null;
  try {
    const config = readJson(file);
    return config && typeof config === 'object' && !Array.isArray(config) ? config : null;
  } catch (_) {
    return null;
  }
}

function readExistingStudioMode(opencodeDir) {
  if (!opencodeDir) return null;
  const config = readStudioConfig(opencodeDir);
  return config ? normalizeStudioMode(config.studioMode) : null;
}

function hasStudioModeFlag(argv) {
  return argv['studio-mode'] !== undefined || argv.studioMode !== undefined;
}

// A bare `--studio-mode` (present, no value) or an unknown value errors rather
// than silently falling through to the prompt or the default. The only accepted
// values are `lean` and `full`.
async function resolveStudioMode(argv, options) {
  const opts = options || {};

  if (hasStudioModeFlag(argv)) {
    const flag = argv['studio-mode'] !== undefined ? argv['studio-mode'] : argv.studioMode;
    if (flag === true) throw new Error('--studio-mode requires a value: lean or full');
    const mode = normalizeStudioMode(String(flag));
    if (!mode) throw new Error(`Unknown studio mode: ${flag} (expected lean or full)`);
    return mode;
  }

  const existing = opts.existingMode !== undefined ? opts.existingMode : readExistingStudioMode(opts.opencodeDir);
  const dryRun = opts.dryRun === true;
  const interactive = opts.interactive !== undefined ? opts.interactive : Boolean(process.stdin.isTTY);

  // A dry run is read-only and must never block on stdin.
  if (dryRun || !interactive) return existing || 'lean';

  const prompt = opts.prompt || promptStudioMode;
  const fallback = existing || 'lean';
  const answer = await prompt(`Studio mode: Lean | Full Studio [${fallback}]: `);
  return normalizeStudioMode(String(answer === null || answer === undefined ? '' : answer).trim()) || fallback;
}

function readAgentEnabledBy(domainDir, relPath) {
  if (!domainDir || !relPath) return undefined;
  try {
    return parseFrontmatter(fs.readFileSync(path.join(domainDir, relPath), 'utf8')).enabledBy;
  } catch (_) {
    return undefined;
  }
}

// Membership lives only in `studioModes`; a manifest without it falls back to
// the legacy flat `agents`/`subagents` arrays (fail-soft for older domains).
// The gating condition lives once, in each optional agent's frontmatter
// `enabledBy`; an optional path with no `enabledBy` is always installed.
function selectHierarchy(manifest, studioMode, gating, options) {
  const opts = options || {};
  const gates = gating || {};
  const modes = manifest.studioModes;
  if (!modes || typeof modes !== 'object') {
    return { agents: manifest.agents || [], subagents: manifest.subagents || [] };
  }
  const mode = modes[studioMode] || {};
  const agents = [...(mode.agents || [])];
  const subagents = [...(mode.subagents || [])];
  for (const rel of optionalPaths(mode.optional)) {
    const enabledBy = opts.readEnabledBy ? opts.readEnabledBy(rel) : readAgentEnabledBy(opts.domainDir, rel);
    if (enabledBy === undefined || gates[enabledBy] === true) subagents.push(rel);
  }
  return { agents, subagents };
}

// Optional Lean extras gate on the installed `.opencode/unity-studio.json`
// toggle and on a detected native sub-project. Detection reads the standard
// persisted `native-project-state.json` artifact (written by project-scan) at
// `<opencode-dir>/project-data/`. A missing artifact, or a merely declared
// solution whose file is missing, means "not detected" — the conservative
// default. Only an affirmative `solutionExists === true` enables the gate.
function detectNativeSubproject(opencodeDir) {
  const file = path.join(opencodeDir, 'project-data', 'native-project-state.json');
  if (!isFile(file)) return false;
  try {
    const state = readJson(file);
    const native = state && state.state;
    return Boolean(native) && native.solutionExists === true;
  } catch (_) {
    return false;
  }
}

function resolveGating(opencodeDir) {
  const config = readStudioConfig(opencodeDir);
  const toggles = config && config.toggles && typeof config.toggles === 'object' ? config.toggles : {};
  return {
    tdd: toggles.tdd === true,
    'native-subproject': detectNativeSubproject(opencodeDir),
  };
}

function persistStudioMode(opencodeDir, studioMode, warnings) {
  const file = path.join(opencodeDir, 'unity-studio.json');
  let config = readStudioConfig(opencodeDir);
  if (!config) {
    if (isFile(file)) warnings.push(`unity-studio.json is not a JSON object; rewriting with studioMode only`);
    config = {};
  }
  config.studioMode = studioMode;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

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
    if (!out._) out._ = [];
    out._.push(arg);
    i++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Small fs helpers
// ---------------------------------------------------------------------------

function isDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch (_) { return false; }
}

function isFile(p) {
  try { return fs.statSync(p).isFile(); } catch (_) { return false; }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function walk(dir, base) {
  const results = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const rel = path.relative(base, full).split(path.sep).join('/');
    if (isDir(full)) {
      results.push(...walk(full, base));
    } else {
      results.push({ full, rel });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Frontmatter
// ---------------------------------------------------------------------------

function parseFrontmatter(content) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!match) return {};
  const fm = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    fm[m[1]] = value;
  }
  return fm;
}

// ---------------------------------------------------------------------------
// Merge destination
// ---------------------------------------------------------------------------

function computeDestination(rootDest, relPath, subdomain, mergeMode) {
  const defaultDest = path.join(rootDest, relPath);
  if (!fs.existsSync(defaultDest)) return defaultDest;
  if (mergeMode === 'replace') return defaultDest;

  const parts = relPath.split('/');
  const alreadyNamespaced = parts.includes(subdomain);

  if (mergeMode === 'separate') {
    if (alreadyNamespaced) return defaultDest;
    const top = parts[0];
    const rest = parts.slice(1).join('/');
    return path.join(rootDest, top, subdomain, rest);
  }

  // extend: namespaced file in the same directory => {subdomain}_{filename}
  const dir = path.dirname(defaultDest);
  const filename = path.basename(defaultDest);
  return path.join(dir, `${subdomain}_${filename}`);
}

// ---------------------------------------------------------------------------
// Manifest-driven asset selection
// ---------------------------------------------------------------------------

function collectAssets(domainDir, manifest, warnings, options) {
  const opts = options || {};
  const assets = [];
  const seen = new Set();

  const addFile = (rel) => {
    if (!rel || seen.has(rel)) return;
    const src = path.join(domainDir, rel);
    if (isFile(src)) {
      seen.add(rel);
      assets.push({ rel, src });
    } else {
      warnings.push(`declared asset not found: ${rel}`);
    }
  };

  const addDir = (rel) => {
    if (!rel) return;
    const src = path.join(domainDir, rel);
    if (isDir(src)) {
      for (const f of walk(src, domainDir)) {
        if (!seen.has(f.rel)) {
          seen.add(f.rel);
          assets.push({ rel: f.rel, src: f.full });
        }
      }
    } else if (isFile(src)) {
      addFile(rel);
    } else {
      warnings.push(`declared asset not found: ${rel}`);
    }
  };

  // The selected hierarchy (mode membership + optional gating) then the
  // always-installed shared assets.
  const hierarchy = selectHierarchy(manifest, opts.studioMode || 'lean', opts.gating, { domainDir });
  for (const rel of hierarchy.agents) addFile(rel);
  for (const rel of hierarchy.subagents) addFile(rel);

  // Explicit file lists.
  for (const key of ['commands', 'skills', 'sharedContext', 'scripts', 'config']) {
    for (const rel of manifest[key] || []) addFile(rel);
  }

  // Directory lists.
  for (const rel of manifest.context || []) addDir(rel);

  // Abilities are realised as commands (ADR-0004). A declared ability resolves
  // to command/<name>.md; anything else is reported, never silently invented.
  for (const ability of manifest.abilities || []) {
    const rel = `command/${ability}.md`;
    if (isFile(path.join(domainDir, rel))) {
      addFile(rel);
    } else {
      warnings.push(`ability "${ability}" has no command implementation (command/${ability}.md)`);
    }
  }

  // Tools are file-or-directory assets under the declared tools path.
  const toolsPrefix = (manifest.paths && manifest.paths.tools) || 'tools/';
  for (const tool of manifest.tools || []) {
    const candidates = [
      `${toolsPrefix}${tool}`,
      `${toolsPrefix}${tool}.ts`,
      `tool/${tool}`,
      `tool/${tool}.ts`,
    ];
    const found = candidates.find((c) => isFile(path.join(domainDir, c)) || isDir(path.join(domainDir, c)));
    if (found) {
      addDir(found);
    } else {
      warnings.push(`tool "${tool}" has no implementation under ${toolsPrefix}`);
    }
  }

  return assets;
}

// ---------------------------------------------------------------------------
// Agent metadata registration
// ---------------------------------------------------------------------------

function registerMetadata(opencodeDir, domain, subdomain, assets, copied, warnings) {
  const metadataPath = path.join(opencodeDir, 'config', 'agent-metadata.json');
  let metadata;
  try {
    metadata = readJson(metadataPath);
  } catch (_) {
    warnings.push(`agent metadata not found or invalid: ${metadataPath}`);
    return 0;
  }
  if (!metadata.agents || typeof metadata.agents !== 'object') metadata.agents = {};

  const author = `domain:${domain}/${subdomain}`;

  let added = 0;
  for (const asset of assets) {
    if (!/^agent\/.*\.md$/.test(asset.rel)) continue;
    if (!copied.has(asset.rel)) continue;

    const id = path.basename(asset.rel, '.md');
    if (metadata.agents[id]) continue;

    let fm = {};
    try { fm = parseFrontmatter(fs.readFileSync(asset.src, 'utf8')); } catch (_) { /* ignore */ }

    const isSubagent = asset.rel.includes('/subagents/');
    const segments = asset.rel.split('/');
    let category = 'domain';
    if (isSubagent) {
      const idx = segments.indexOf('subagents');
      category = segments.slice(idx).join('/').replace(/\.md$/, '');
      category = path.dirname(category);
    }

    metadata.agents[id] = {
      id,
      name: fm.name || id,
      category,
      type: isSubagent ? 'subagent' : 'agent',
      version: '1.0.0',
      author,
      tags: ['domain', domain, subdomain],
      dependencies: [],
    };
    added++;
  }

  if (added > 0) {
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + '\n');
  }
  return added;
}

// ---------------------------------------------------------------------------
// Path rewriting (mirrors install.sh for global/custom installs)
// ---------------------------------------------------------------------------

function isLocalOpencodeDir(opencodeDir) {
  return path.basename(opencodeDir) === '.opencode';
}

function rewritePaths(file, opencodeDir) {
  let content;
  try { content = fs.readFileSync(file, 'utf8'); } catch (_) { return false; }
  if (!content.includes('.opencode/context')) return false;

  const rewritten = content
    .replace(/@\.opencode\/context\//g, `@${opencodeDir}/context/`)
    .replace(/\.opencode\/context/g, `${opencodeDir}/context`);

  if (rewritten === content) return false;
  fs.writeFileSync(file, rewritten);
  return true;
}

// ---------------------------------------------------------------------------
// Adaptations guard
// ---------------------------------------------------------------------------

function readAdaptations(domainDir) {
  const file = path.join(domainDir, 'ADAPTATIONS.md');
  if (!isFile(file)) return { file, paths: new Set() };
  const paths = new Set();
  const content = fs.readFileSync(file, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const m = /^\s*[-*]\s+`?([^`\s]+\.(?:md|json|ts|js|sh|yaml|yml))`?/.exec(line);
    if (m) paths.add(m[1]);
  }
  return { file, paths };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const argv = parseArgs(process.argv.slice(2));

  const domainDirArg = argv['domain-dir'] || argv['plugin-dir'];
  const mode = argv.mode || 'extend';
  const dryRun = Boolean(argv['dry-run'] || argv.dry);
  const doRegister = argv['no-register-metadata'] !== true;
  const doRewrite = argv['no-rewrite-paths'] !== true;
  const force = argv.force === true;

  if (!domainDirArg) {
    console.error('Usage: merge-domains.js --domain-dir .opencode/xdomains/<domain>/<subdomain> --opencode-dir <dir> [--mode extend|separate|replace] [--studio-mode lean|full] [--dry-run]');
    process.exit(2);
  }

  const domainDir = path.resolve(domainDirArg);
  const opencodeDir = path.resolve(argv['opencode-dir'] || '.opencode');

  if (!['extend', 'separate', 'replace'].includes(mode)) {
    console.error(`Unknown merge mode: ${mode}`);
    process.exit(2);
  }

  const existingMode = readExistingStudioMode(opencodeDir);
  let studioMode;
  try {
    studioMode = await resolveStudioMode(argv, { opencodeDir, existingMode, dryRun });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }

  const manifestPath = path.join(domainDir, DEFAULT_MANIFEST);
  if (!isFile(manifestPath)) {
    console.error(`No ${DEFAULT_MANIFEST} found in ${domainDir}`);
    process.exit(1);
  }

  const manifest = readJson(manifestPath);
  const domain = manifest.domain || path.basename(path.dirname(domainDir));
  const subdomain = argv.subdomain || manifest.subdomain || path.basename(domainDir);
  const warnings = [];
  if (hasStudioModeFlag(argv) && existingMode && existingMode !== studioMode) {
    console.error(`  warning: overwriting existing studioMode '${existingMode}' with '${studioMode}'`);
  }
  const gating = resolveGating(opencodeDir);

  const assets = collectAssets(domainDir, manifest, warnings, { studioMode, gating });

  const adaptations = readAdaptations(domainDir);
  const copied = new Set();
  const planned = [];

  for (const asset of assets) {
    const dest = computeDestination(opencodeDir, asset.rel, subdomain, mode);
    planned.push({ rel: asset.rel, src: asset.src, dest });

    if (dryRun) continue;

    const relDest = path.relative(opencodeDir, dest).split(path.sep).join('/');
    if (adaptations.paths.has(relDest) && fs.existsSync(dest) && !force) {
      warnings.push(`adapted by ADAPTATIONS.md, skipping (use --force): ${relDest}`);
      continue;
    }

    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(asset.src, dest);
    copied.add(asset.rel);

    if (doRewrite && !isLocalOpencodeDir(opencodeDir) && dest.endsWith('.md')) {
      rewritePaths(dest, opencodeDir);
    }
  }

  if (dryRun) {
    console.log(`Dry-run merge plan (${domain}/${subdomain}, mode=${mode}, studioMode=${studioMode}):`);
    for (const p of planned) {
      console.log(`  ${p.rel}  ->  ${path.relative(process.cwd(), p.dest)}`);
    }
    for (const w of warnings) console.error(`  warning: ${w}`);
    return;
  }

  persistStudioMode(opencodeDir, studioMode, warnings);

  let metadataAdded = 0;
  if (doRegister) {
    metadataAdded = registerMetadata(opencodeDir, domain, subdomain, assets, copied, warnings);
  }

  console.log(`Applied domain ${domain}/${subdomain} (mode=${mode}, studioMode=${studioMode})`);
  console.log(`  Files copied: ${copied.size}`);
  if (doRegister) console.log(`  Agents registered: ${metadataAdded}`);
  if (adaptations.paths.size > 0) {
    console.log(`  Adaptation guard active: ${adaptations.paths.size} file(s) listed in ${path.relative(process.cwd(), adaptations.file)}`);
  }
  for (const w of warnings) console.error(`  warning: ${w}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

module.exports = {
  STUDIO_MODES,
  parseArgs,
  parseFrontmatter,
  normalizeStudioMode,
  resolveStudioMode,
  selectHierarchy,
  optionalPaths,
  readStudioConfig,
  readExistingStudioMode,
  detectNativeSubproject,
  resolveGating,
  persistStudioMode,
  computeDestination,
  collectAssets,
  registerMetadata,
  rewritePaths,
  isLocalOpencodeDir,
};
