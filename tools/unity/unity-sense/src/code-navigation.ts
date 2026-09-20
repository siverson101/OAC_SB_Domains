// code-navigation — offline symbol/declaration lookup over project source.
//
// Walks `.cs` files under the project's Assets folder, extracts declarations
// (namespace/type/method/member) with `file:line`, and attributes each file to
// its owning assembly using the Phase 2a asmdef reader. No Editor involved.
import { readdirSync } from 'node:fs';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { dirExists, readJson, readText, toPosix, unique } from '../../../shared/io';
import { produceAsmdefMap } from '../../gather-unity-context/src/offline';
import { asRecord, makeResult, projectDataDir, str, type SenseBase, type SenseOptions, type SenseStatus } from './shared';

const MAX_MATCHES = 200;

const WALK_EXCLUDES = new Set([
  'library',
  'temp',
  'obj',
  'logs',
  'build',
  'builds',
  'usersettings',
  'node_modules',
  '.git',
  '.vs',
  '.idea',
  'bin',
]);

function walkFiles(root: string, match: (name: string) => boolean, maxDepth = 16): string[] {
  const out: string[] = [];
  const walk = (dir: string, depth: number): void => {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (WALK_EXCLUDES.has(entry.name.toLowerCase())) continue;
        walk(full, depth + 1);
        continue;
      }
      if (entry.isFile() && match(entry.name)) out.push(full);
    }
  };
  walk(root, 0);
  return out;
}

interface DeclPattern {
  kind: string;
  re: RegExp;
}

const DECL_PATTERNS: DeclPattern[] = [
  { kind: 'namespace', re: /\bnamespace\s+([A-Za-z_][A-Za-z0-9_.]*)/ },
  { kind: 'type', re: /\b(?:class|struct|interface|enum|record)\s+([A-Za-z_][A-Za-z0-9_]*)/ },
  {
    kind: 'method',
    re: /^\s*(?:\[[^\]]*\]\s*)*(?:public|private|protected|internal)\s+(?:static\s+|virtual\s+|override\s+|sealed\s+|async\s+|partial\s+|abstract\s+|extern\s+|unsafe\s+|new\s+)*(?:[A-Za-z0-9_<>,\[\]\.\?]+\s+)+([A-Za-z_][A-Za-z0-9_]*)\s*\(/,
  },
  {
    kind: 'member',
    re: /^\s*(?:public|private|protected|internal)\s+(?:static\s+|readonly\s+|const\s+|volatile\s+|new\s+)*(?:[A-Za-z0-9_<>,\[\]\.\?]+\s+)+([A-Za-z_][A-Za-z0-9_]*)\s*[;={]/,
  },
];

export interface SymbolMatch {
  symbol: string;
  kind: string;
  file: string;
  line: number;
  text: string;
  assembly: string | null;
}

export interface CodeNavigationResult extends SenseBase {
  assetFolder: string;
  assetFolderSource: string;
  query: string | null;
  scannedFiles: number;
  symbolCount: number;
  matchCount: number;
  truncated: boolean;
  assemblies: { count: number; testCount: number; names: string[] };
  matches: SymbolMatch[];
}

function resolveAssetFolder(options: SenseOptions): { assetFolder: string; source: string } {
  if (options.assetFolder) return { assetFolder: options.assetFolder, source: 'option' };
  const scan = asRecord(readJson<unknown>(join(projectDataDir(options), 'scan-result.json')));
  const folder = str(scan, 'assetFolder');
  if (folder) {
    return { assetFolder: isAbsolute(folder) ? folder : join(options.projectRoot, folder), source: 'scan-result.json' };
  }
  return { assetFolder: join(options.projectRoot, 'Assets'), source: 'default' };
}

export function codeNavigation(options: SenseOptions): CodeNavigationResult {
  const { assetFolder, source: assetFolderSource } = resolveAssetFolder(options);
  const asmdefMap = produceAsmdefMap({ projectRoot: options.projectRoot, assetFolder, opencodeDir: options.opencodeDir });

  const dirs = asmdefMap.assemblies.map((assembly) => {
    const full = isAbsolute(assembly.path) ? assembly.path : join(options.projectRoot, assembly.path);
    return { name: assembly.name, dir: toPosix(dirname(full)) };
  });
  const ownerAssembly = (file: string): string | null => {
    let current = toPosix(dirname(file));
    for (;;) {
      const found = dirs.find((entry) => entry.dir === current);
      if (found) return found.name;
      const parent = dirname(current);
      if (parent === current) return null;
      current = parent;
    }
  };

  const query = options.query?.trim() ? options.query.trim().toLowerCase() : null;
  const files = walkFiles(assetFolder, (name) => name.toLowerCase().endsWith('.cs'));
  const matches: SymbolMatch[] = [];
  let scannedFiles = 0;
  let symbolCount = 0;
  let truncated = false;

  outer: for (const file of files) {
    const text = readText(file);
    if (text === null) continue;
    scannedFiles++;
    const rel = toPosix(relative(options.projectRoot, file));
    const assembly = ownerAssembly(file);
    const lines = text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      for (const pattern of DECL_PATTERNS) {
        const match = pattern.re.exec(line);
        if (!match) continue;
        symbolCount++;
        if (query && !match[1].toLowerCase().includes(query)) continue;
        if (matches.length >= MAX_MATCHES) {
          truncated = true;
          break outer;
        }
        matches.push({ symbol: match[1], kind: pattern.kind, file: rel, line: index + 1, text: line.trim(), assembly });
      }
    }
  }

  const status: SenseStatus = !dirExists(assetFolder)
    ? 'unknown'
    : scannedFiles === 0
      ? 'unavailable'
      : 'observed_locally';

  const result: CodeNavigationResult = {
    ...makeResult('code-navigation', status, 'Offline symbol/declaration lookup over project source', []),
    assetFolder: toPosix(assetFolder),
    assetFolderSource,
    query: options.query?.trim() || null,
    scannedFiles,
    symbolCount,
    matchCount: matches.length,
    truncated,
    assemblies: {
      count: asmdefMap.assemblyCount,
      testCount: asmdefMap.testAssemblyCount,
      names: unique(asmdefMap.assemblies.map((assembly) => assembly.name)),
    },
    matches,
  };
  result.summary = result.query
    ? `${matches.length} declaration(s) for "${result.query}" across ${scannedFiles} file(s)`
    : `${symbolCount} declaration(s) across ${scannedFiles} file(s)`;
  return result;
}
