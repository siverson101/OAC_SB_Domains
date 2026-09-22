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
    persistStudioMode,
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
        expect(rels).toContain('command/unity-implement.md');
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
        expect(rels).toContain('command/unity-implement.md');
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
    const options = { domainDir: DOMAIN_DIR };

    test('lean membership is agents + 7 base subagents, gated extras excluded', () => {
        const lean = selectHierarchy(manifest, 'lean', {}, options);
        expect(lean.agents).toEqual(['agent/unity-3d-orchestrator.md']);
        expect(lean.subagents).toHaveLength(7);
        expect(lean.subagents).not.toContain('agent/subagents/unity/tdd-specialist.md');
    });

    test('gating includes only the enabled optional extras', () => {
        const lean = selectHierarchy(manifest, 'lean', { tdd: true }, options);
        expect(lean.subagents).toContain('agent/subagents/unity/tdd-specialist.md');
        expect(lean.subagents).not.toContain('agent/subagents/unity/native-plugin.md');

        const native = selectHierarchy(manifest, 'lean', { 'native-subproject': true }, options);
        expect(native.subagents).toContain('agent/subagents/unity/native-plugin.md');
        expect(native.subagents).not.toContain('agent/subagents/unity/tdd-specialist.md');
    });

    test('full membership is the orchestrator plus 17 full-studio subagents', () => {
        const full = selectHierarchy(manifest, 'full', {}, options);
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
    test('accepts only lean and full, with no aliases', async () => {
        expect(await resolveStudioMode({ 'studio-mode': 'lean' })).toBe('lean');
        expect(await resolveStudioMode({ 'studio-mode': 'full' })).toBe('full');
        expect(normalizeStudioMode('Full Studio')).toBeNull();
        expect(normalizeStudioMode('full-studio')).toBeNull();
    });

    test('normalizes case and surrounding whitespace', async () => {
        expect(await resolveStudioMode({ 'studio-mode': 'FULL' })).toBe('full');
        expect(await resolveStudioMode({ 'studio-mode': ' Full ' })).toBe('full');
        expect(normalizeStudioMode('  LEAN  ')).toBe('lean');
    });

    test('defaults to lean when non-interactive', async () => {
        expect(await resolveStudioMode({}, { interactive: false })).toBe('lean');
    });

    test('uses the existing config mode when non-interactive', async () => {
        expect(await resolveStudioMode({}, { interactive: false, existingMode: 'full' })).toBe('full');
    });

    test('does not prompt on a dry run', async () => {
        const prompt = () => {
            throw new Error('prompted on dry run');
        };
        expect(await resolveStudioMode({}, { interactive: true, dryRun: true, prompt })).toBe('lean');
        expect(await resolveStudioMode({}, { interactive: true, dryRun: true, existingMode: 'full', prompt })).toBe('full');
    });

    test('prompts when interactive and falls back to the existing mode', async () => {
        expect(await resolveStudioMode({}, { interactive: true, prompt: async () => '' })).toBe('lean');
        expect(await resolveStudioMode({}, { interactive: true, prompt: async () => 'full' })).toBe('full');
        expect(await resolveStudioMode({}, { interactive: true, existingMode: 'full', prompt: async () => '' })).toBe('full');
    });

    test('throws on an unknown mode', async () => {
        await expect(resolveStudioMode({ 'studio-mode': 'wide' })).rejects.toThrow();
    });

    test('throws on a bare --studio-mode with no value', async () => {
        await expect(resolveStudioMode({ 'studio-mode': true })).rejects.toThrow('--studio-mode requires a value');
    });

    test('ignores the undocumented camelCase studioMode key', async () => {
        expect(await resolveStudioMode({ studioMode: 'full' }, { interactive: false })).toBe('lean');
    });
});

describe('persistStudioMode', () => {
    function freshDir() {
        return fs.mkdtempSync(path.join(os.tmpdir(), 'xdomain-persist-'));
    }

    test('preserves other fields in a valid config', () => {
        const dir = freshDir();
        try {
            fs.writeFileSync(
                path.join(dir, 'unity-studio.json'),
                JSON.stringify({ schemaVersion: 1, reviewIntensity: 'lean', patterns: ['factory'] })
            );
            const warnings = [];
            persistStudioMode(dir, 'full', warnings);
            expect(warnings).toEqual([]);
            const config = JSON.parse(fs.readFileSync(path.join(dir, 'unity-studio.json'), 'utf8'));
            expect(config.studioMode).toBe('full');
            expect(config.reviewIntensity).toBe('lean');
            expect(config.patterns).toEqual(['factory']);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    for (const [label, malformed] of [['JSON array', '[]'], ['JSON string', '"nope"']]) {
        test(`warns and rewrites a malformed config (${label})`, () => {
            const dir = freshDir();
            try {
                fs.writeFileSync(path.join(dir, 'unity-studio.json'), malformed);
                const warnings = [];
                persistStudioMode(dir, 'lean', warnings);
                expect(warnings).toHaveLength(1);
                expect(warnings[0]).toContain('dropping prior content');
                const config = JSON.parse(fs.readFileSync(path.join(dir, 'unity-studio.json'), 'utf8'));
                expect(config).toEqual({ studioMode: 'lean' });
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        });
    }

    test('creates the file when absent', () => {
        const dir = freshDir();
        try {
            const warnings = [];
            persistStudioMode(dir, 'full', warnings);
            expect(warnings).toEqual([]);
            const config = JSON.parse(fs.readFileSync(path.join(dir, 'unity-studio.json'), 'utf8'));
            expect(config).toEqual({ studioMode: 'full' });
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
