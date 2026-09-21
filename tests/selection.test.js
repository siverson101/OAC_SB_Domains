// Apply-engine studio-mode selection tests (Phase 4, ticket 04).
//
// Run: bun test tests
const { describe, test, expect } = require('bun:test');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const MERGE = path.resolve(__dirname, '../xdomains/merge-domains.js');
const DOMAIN = path.resolve(__dirname, '../xdomains/game-dev/unity-3d');

function freshDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'xdomain-select-'));
}

function apply(mode, dir, extra) {
    return spawnSync(
        process.execPath,
        [MERGE, '--domain-dir', DOMAIN, '--opencode-dir', dir, ...(mode ? ['--studio-mode', mode] : []), ...(extra || [])],
        { encoding: 'utf8' }
    );
}

function applyRaw(args) {
    return spawnSync(process.execPath, [MERGE, ...args], { encoding: 'utf8' });
}

function writeConfig(dir, config) {
    fs.writeFileSync(path.join(dir, 'unity-studio.json'), JSON.stringify(config));
}

function withMetadata(dir) {
    fs.mkdirSync(path.join(dir, 'config'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'config', 'agent-metadata.json'), '{\n  "agents": {}\n}\n');
    return dir;
}

function exists(dir, rel) {
    return fs.existsSync(path.join(dir, rel));
}

describe('studio-mode selection', () => {
    test('lean installs the lean hierarchy and no full-studio agents', () => {
        const dir = withMetadata(freshDir());
        try {
            const res = apply('lean', dir);
            expect(res.status).toBe(0);

            expect(exists(dir, 'agent/unity-3d-orchestrator.md')).toBe(true);
            expect(exists(dir, 'agent/subagents/unity/implementer.md')).toBe(true);
            expect(exists(dir, 'agent/full-studio')).toBe(false);
            expect(exists(dir, 'agent/subagents/unity/tdd-specialist.md')).toBe(false);
            expect(exists(dir, 'agent/subagents/unity/native-plugin.md')).toBe(false);

            expect(exists(dir, 'command/unity-feature.md')).toBe(true);
            expect(exists(dir, 'context/unity-3d/navigation.md')).toBe(true);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    test('full installs the full-studio hierarchy and no lean specialists', () => {
        const dir = withMetadata(freshDir());
        try {
            const res = apply('full', dir);
            expect(res.status).toBe(0);

            expect(exists(dir, 'agent/full-studio/full-studio-orchestrator.md')).toBe(true);
            expect(exists(dir, 'agent/full-studio/creative-director.md')).toBe(true);
            expect(exists(dir, 'agent/subagents')).toBe(false);

            expect(exists(dir, 'command/unity-feature.md')).toBe(true);
            expect(exists(dir, 'context/unity-3d/navigation.md')).toBe(true);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    test('no flag on a non-interactive install defaults to lean', () => {
        const dir = withMetadata(freshDir());
        try {
            const res = apply(null, dir);
            expect(res.status).toBe(0);
            expect(exists(dir, 'agent/full-studio')).toBe(false);
            expect(exists(dir, 'agent/subagents/unity/implementer.md')).toBe(true);
            expect(JSON.parse(fs.readFileSync(path.join(dir, 'unity-studio.json'), 'utf8')).studioMode).toBe('lean');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    test('persists the chosen mode without clobbering other config fields', () => {
        const dir = withMetadata(freshDir());
        try {
            fs.writeFileSync(
                path.join(dir, 'unity-studio.json'),
                JSON.stringify({ schemaVersion: 1, studioMode: 'lean', reviewIntensity: 'lean', patterns: ['factory'] })
            );
            const res = apply('full', dir);
            expect(res.status).toBe(0);

            const config = JSON.parse(fs.readFileSync(path.join(dir, 'unity-studio.json'), 'utf8'));
            expect(config.studioMode).toBe('full');
            expect(config.reviewIntensity).toBe('lean');
            expect(config.patterns).toEqual(['factory']);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    test('gates the TDD extra on the installed toggle', () => {
        const dir = withMetadata(freshDir());
        try {
            fs.writeFileSync(
                path.join(dir, 'unity-studio.json'),
                JSON.stringify({ schemaVersion: 1, studioMode: 'lean', toggles: { tdd: true, ftf: false } })
            );
            const res = apply('lean', dir);
            expect(res.status).toBe(0);
            expect(exists(dir, 'agent/subagents/unity/tdd-specialist.md')).toBe(true);
            expect(exists(dir, 'agent/subagents/unity/native-plugin.md')).toBe(false);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    test('gates the native-plugin extra on a detected native sub-project', () => {
        const dir = withMetadata(freshDir());
        try {
            fs.mkdirSync(path.join(dir, 'project-data'), { recursive: true });
            fs.writeFileSync(
                path.join(dir, 'project-data', 'native-project-state.json'),
                JSON.stringify({ schemaVersion: 1, state: { status: 'declared', solutionExists: true } })
            );
            const res = apply('lean', dir);
            expect(res.status).toBe(0);
            expect(exists(dir, 'agent/subagents/unity/native-plugin.md')).toBe(true);
            expect(exists(dir, 'agent/subagents/unity/tdd-specialist.md')).toBe(false);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    test('does not enable native-plugin on a declared solution whose file is missing', () => {
        const dir = withMetadata(freshDir());
        try {
            fs.mkdirSync(path.join(dir, 'project-data'), { recursive: true });
            fs.writeFileSync(
                path.join(dir, 'project-data', 'native-project-state.json'),
                JSON.stringify({
                    schemaVersion: 1,
                    state: { status: 'declared', solution: 'Native/build.sln', solutionExists: false },
                })
            );
            const res = apply('lean', dir);
            expect(res.status).toBe(0);
            expect(exists(dir, 'agent/subagents/unity/native-plugin.md')).toBe(false);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    test('dry-run lists only the chosen set and writes nothing', () => {
        const leanDir = path.join(freshDir(), 'oc');
        const fullDir = path.join(freshDir(), 'oc');
        try {
            const lean = apply('lean', leanDir, ['--dry-run']);
            expect(lean.status).toBe(0);
            expect(lean.stdout).toContain('agent/unity-3d-orchestrator.md');
            expect(lean.stdout).not.toContain('agent/full-studio/');
            expect(fs.existsSync(leanDir)).toBe(false);

            const full = apply('full', fullDir, ['--dry-run']);
            expect(full.status).toBe(0);
            expect(full.stdout).toContain('agent/full-studio/full-studio-orchestrator.md');
            expect(full.stdout).not.toContain('agent/subagents/unity/');
            expect(fs.existsSync(fullDir)).toBe(false);
        } finally {
            fs.rmSync(path.dirname(leanDir), { recursive: true, force: true });
            fs.rmSync(path.dirname(fullDir), { recursive: true, force: true });
        }
    });

    test('rejects an unknown studio mode', () => {
        const dir = withMetadata(freshDir());
        try {
            const res = apply('wide', dir);
            expect(res.status).not.toBe(0);
            expect(res.stderr).toContain('Unknown studio mode');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    test('rejects a bare --studio-mode instead of prompting or defaulting', () => {
        const dir = withMetadata(freshDir());
        try {
            const res = applyRaw(['--domain-dir', DOMAIN, '--opencode-dir', dir, '--studio-mode']);
            expect(res.status).not.toBe(0);
            expect(res.stderr).toContain('requires a value');
            expect(exists(dir, 'agent')).toBe(false);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    test('uses an existing config studioMode when no flag is given', () => {
        const dir = withMetadata(freshDir());
        try {
            writeConfig(dir, { schemaVersion: 1, studioMode: 'full' });
            const res = apply(null, dir);
            expect(res.status).toBe(0);
            expect(exists(dir, 'agent/full-studio/full-studio-orchestrator.md')).toBe(true);
            expect(JSON.parse(fs.readFileSync(path.join(dir, 'unity-studio.json'), 'utf8')).studioMode).toBe('full');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    test('warns before overwriting a differing existing studioMode', () => {
        const dir = withMetadata(freshDir());
        try {
            writeConfig(dir, { schemaVersion: 1, studioMode: 'lean' });
            const res = apply('full', dir);
            expect(res.status).toBe(0);
            expect(res.stderr).toContain("overwriting existing studioMode 'lean' with 'full'");
            expect(JSON.parse(fs.readFileSync(path.join(dir, 'unity-studio.json'), 'utf8')).studioMode).toBe('full');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    test('a dry run with no flag resolves from config and never blocks', () => {
        const dir = withMetadata(freshDir());
        try {
            writeConfig(dir, { schemaVersion: 1, studioMode: 'full' });
            const res = apply(null, dir, ['--dry-run']);
            expect(res.status).toBe(0);
            expect(res.stdout).toContain('studioMode=full');
            expect(exists(dir, 'agent')).toBe(false);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
