// Unit tests for the xdomain merge engine.
//
// Run: bun test tests
const { describe, test, expect } = require('bun:test');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const {
    parseArgs,
    parseFrontmatter,
    isLocalOpencodeDir,
    computeDestination,
    collectAssets,
} = require('../xdomains/merge-domains.js');

const DOMAIN_DIR = path.resolve(__dirname, '../xdomains/game-dev/unity-3d');

describe('parseArgs', () => {
    test('parses --key=value, --key value, booleans and positionals', () => {
        const a = parseArgs(['extra', '--domain-dir', 'd', '--mode=extend', '--dry-run']);
        expect(a['domain-dir']).toBe('d');
        expect(a.mode).toBe('extend');
        expect(a['dry-run']).toBe(true);
        expect(a._).toEqual(['extra']);
    });
});

describe('parseFrontmatter', () => {
    test('reads name and description, stripping quotes', () => {
        const fm = parseFrontmatter('---\nname: Foo\ndescription: "A bar"\nmode: primary\n---\n\n# x');
        expect(fm.name).toBe('Foo');
        expect(fm.description).toBe('A bar');
        expect(fm.mode).toBe('primary');
    });

    test('returns an empty object when there is no frontmatter', () => {
        expect(parseFrontmatter('# no frontmatter here')).toEqual({});
    });
});

describe('isLocalOpencodeDir', () => {
    test('is true only for a directory named .opencode', () => {
        expect(isLocalOpencodeDir('/project/.opencode')).toBe(true);
        expect(isLocalOpencodeDir('/home/user/.config/opencode')).toBe(false);
    });
});

describe('computeDestination', () => {
    test('uses the default path when the destination does not exist', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xdomain-'));
        try {
            const dest = computeDestination(dir, 'agent/foo.md', 'unity-3d', 'extend');
            expect(dest).toBe(path.join(dir, 'agent/foo.md'));
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe('collectAssets', () => {
    test('selects declared assets from the unity-3d manifest', () => {
        const manifest = JSON.parse(fs.readFileSync(path.join(DOMAIN_DIR, 'sb-domain.json'), 'utf8'));
        const warnings = [];
        const assets = collectAssets(DOMAIN_DIR, manifest, warnings);
        const rels = assets.map((a) => a.rel);

        expect(rels).toContain('agent/unity-3d-orchestrator.md');
        expect(rels).toContain('command/unity-feature.md');
        expect(rels).toContain('context/unity-3d/navigation.md');
        expect(rels).toContain('context/domain/unity-common.md');
        expect(rels).toContain('unity-studio.json');
        // Only declared assets are selected; meta files are excluded.
        expect(rels).not.toContain('sb-domain.json');
        expect(rels).not.toContain('README.md');
    });
});
