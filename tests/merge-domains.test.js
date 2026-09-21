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
    selectHierarchy,
    resolveStudioMode,
    normalizeStudioMode,
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

    test('lean (the default) installs no full-studio agents and no gated extras', () => {
        const manifest = JSON.parse(fs.readFileSync(path.join(DOMAIN_DIR, 'sb-domain.json'), 'utf8'));
        const rels = collectAssets(DOMAIN_DIR, manifest, []).map((a) => a.rel);

        expect(rels).toContain('agent/unity-3d-orchestrator.md');
        expect(rels).toContain('agent/subagents/unity/implementer.md');
        expect(rels.some((rel) => rel.startsWith('agent/full-studio/'))).toBe(false);
        expect(rels).not.toContain('agent/subagents/unity/tdd-specialist.md');
        expect(rels).not.toContain('agent/subagents/unity/native-plugin.md');
    });

    test('full mode installs the full-studio hierarchy and no lean specialists', () => {
        const manifest = JSON.parse(fs.readFileSync(path.join(DOMAIN_DIR, 'sb-domain.json'), 'utf8'));
        const rels = collectAssets(DOMAIN_DIR, manifest, [], { studioMode: 'full' }).map((a) => a.rel);

        expect(rels).toContain('agent/full-studio/full-studio-orchestrator.md');
        expect(rels).toContain('agent/full-studio/creative-director.md');
        expect(rels.some((rel) => rel.startsWith('agent/subagents/unity/'))).toBe(false);
        expect(rels).toContain('command/unity-feature.md');
        expect(rels).toContain('context/unity-3d/navigation.md');
        expect(rels).toContain('unity-studio.json');
    });

    test('gated lean extras install only when their gate holds', () => {
        const manifest = JSON.parse(fs.readFileSync(path.join(DOMAIN_DIR, 'sb-domain.json'), 'utf8'));
        const tdd = collectAssets(DOMAIN_DIR, manifest, [], { studioMode: 'lean', gating: { tdd: true } }).map((a) => a.rel);
        expect(tdd).toContain('agent/subagents/unity/tdd-specialist.md');
        expect(tdd).not.toContain('agent/subagents/unity/native-plugin.md');

        const native = collectAssets(DOMAIN_DIR, manifest, [], { studioMode: 'lean', gating: { 'native-subproject': true } }).map((a) => a.rel);
        expect(native).toContain('agent/subagents/unity/native-plugin.md');
        expect(native).not.toContain('agent/subagents/unity/tdd-specialist.md');
    });
});

describe('selectHierarchy', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(DOMAIN_DIR, 'sb-domain.json'), 'utf8'));

    test('lean membership is agents + 7 base subagents, gated extras excluded', () => {
        const lean = selectHierarchy(manifest, 'lean', {});
        expect(lean.agents).toEqual(['agent/unity-3d-orchestrator.md']);
        expect(lean.subagents).toHaveLength(7);
        expect(lean.subagents).not.toContain('agent/subagents/unity/tdd-specialist.md');
    });

    test('gating includes only the enabled optional extras', () => {
        const lean = selectHierarchy(manifest, 'lean', { tdd: true });
        expect(lean.subagents).toContain('agent/subagents/unity/tdd-specialist.md');
        expect(lean.subagents).not.toContain('agent/subagents/unity/native-plugin.md');
    });

    test('full membership is the orchestrator plus 17 full-studio subagents', () => {
        const full = selectHierarchy(manifest, 'full', {});
        expect(full.agents).toEqual(['agent/full-studio/full-studio-orchestrator.md']);
        expect(full.subagents).toHaveLength(17);
        expect(full.subagents.every((rel) => rel.startsWith('agent/full-studio/'))).toBe(true);
    });

    test('falls back to flat arrays when studioModes is absent', () => {
        const flat = selectHierarchy({ agents: ['agent/a.md'], subagents: ['agent/subagents/a.md'] }, 'lean', {});
        expect(flat).toEqual({ agents: ['agent/a.md'], subagents: ['agent/subagents/a.md'] });
    });
});

describe('resolveStudioMode', () => {
    test('honours the flag and its aliases', () => {
        expect(resolveStudioMode({ 'studio-mode': 'lean' })).toBe('lean');
        expect(resolveStudioMode({ 'studio-mode': 'full' })).toBe('full');
        expect(normalizeStudioMode('Full Studio')).toBe('full');
        expect(normalizeStudioMode('full-studio')).toBe('full');
    });

    test('defaults to lean when non-interactive', () => {
        expect(resolveStudioMode({}, { interactive: false })).toBe('lean');
    });

    test('prompts when interactive and defaults to lean on an empty answer', () => {
        expect(resolveStudioMode({}, { interactive: true, prompt: () => '' })).toBe('lean');
        expect(resolveStudioMode({}, { interactive: true, prompt: () => 'full' })).toBe('full');
    });

    test('throws on an unknown mode', () => {
        expect(() => resolveStudioMode({ 'studio-mode': 'wide' })).toThrow();
    });
});
