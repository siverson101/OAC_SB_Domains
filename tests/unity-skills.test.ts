// Optional Unity `unity-skills` integration + multi-axis agent templates
// (ADR-0019/0020): installer behaviour, template parity, and the conditional
// attribution/skill-reference contract.

import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { combinations, parseManifest, resolveTemplate } from '../tools/shared/templating/src/resolve';
import type { TemplateManifest } from '../tools/shared/templating/src/types';
import {
  ensureGitignore,
  localDownload,
  runUnitySkills,
  verifyLicense,
} from '../tools/unity/unity-skills/src/installer';
import type { UnitySkillsOptions } from '../tools/unity/unity-skills/src/types';

const repoRoot = resolve(import.meta.dir, '..');
const domains = ['unity-3d', 'unity-2d'].map((sub) => join(repoRoot, 'xdomains', 'game-dev', sub));

function withTempDir<T>(run: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'oac-unity-skills-'));
  try {
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function withTempDirAsync(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'oac-unity-skills-'));
  try {
    await run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Template parity (every committed variant == a fresh resolution)
// ---------------------------------------------------------------------------

function templateEntries(): { domain: string; manifest: TemplateManifest; manifestPath: string; templatePath: string }[] {
  const out: { domain: string; manifest: TemplateManifest; manifestPath: string; templatePath: string }[] = [];
  for (const domain of domains) {
    const sb = JSON.parse(readFileSync(join(domain, 'sb-domain.json'), 'utf8')) as {
      templates?: { template?: string; manifest?: string }[];
    };
    for (const entry of sb.templates ?? []) {
      const manifestPath = join(domain, entry.manifest ?? '');
      const templatePath = join(domain, entry.template ?? '');
      const manifest = parseManifest(JSON.parse(readFileSync(manifestPath, 'utf8')));
      out.push({ domain, manifest, manifestPath, templatePath });
    }
  }
  return out;
}

const TEMPLATES = templateEntries();

describe('multi-axis template parity', () => {
  test('there is at least one multi-axis and one single-axis template', () => {
    expect(TEMPLATES.length).toBeGreaterThan(0);
    expect(TEMPLATES.some((t) => t.manifest.axes.length > 1)).toBe(true);
    expect(TEMPLATES.some((t) => t.manifest.axes.length === 1)).toBe(true);
  });

  for (const { domain, manifest, templatePath } of TEMPLATES) {
    test(`${manifest.base}: every axis combination is committed and matches`, () => {
      const template = readFileSync(templatePath, 'utf8');
      const dir = dirname(templatePath);
      const combos = combinations(manifest);
      expect(combos.length).toBeGreaterThan(1);
      for (const combo of combos) {
        const resolved = resolveTemplate(template, manifest, combo);
        const file = join(dir, resolved.filename);
        expect(existsSync(file), `${manifest.base} missing ${resolved.filename}`).toBe(true);
        // Normalise line endings on both sides: git `core.autocrlf` may check
        // the template and/or the generated file out as CRLF, which is a
        // working-tree artifact, not content drift.
        const expected = (resolved.content.endsWith('\n') ? resolved.content : `${resolved.content}\n`).replace(/\r\n/g, '\n');
        const actual = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
        expect(actual, `${manifest.base} ${resolved.filename}`).toBe(expected);
        expect(resolved.content).not.toContain('{{');
        expect(resolved.content).not.toContain('}}');
      }
      // No stray variant files beyond the declared combinations.
      const expectedFiles = new Set(combos.map((combo) => resolveTemplate(template, manifest, combo).filename));
      const stray = readdirSync(dir)
        .filter((name) => name.endsWith('.md'))
        .filter((name) => name !== `${manifest.base}.md`)
        .filter((name) => name.startsWith(`${manifest.base}.`))
        .filter((name) => !expectedFiles.has(name));
      expect(stray, `${manifest.base} stray variants`).toEqual([]);
      // The sub-domain declares a template manifest listing this template.
      const tmPath = join(domain, 'agent', 'template_manifest.json');
      expect(existsSync(tmPath)).toBe(true);
      const tm = JSON.parse(readFileSync(tmPath, 'utf8')) as { templates: string[] };
      const relTemplate = relative(join(domain, 'agent'), templatePath).replace(/\\/g, '/');
      expect(tm.templates).toContain(relTemplate);
    });
  }

  test('placeholders are all declared in the manifest substitutions or built in', () => {
    for (const { manifest, templatePath } of TEMPLATES) {
      const template = readFileSync(templatePath, 'utf8');
      const names = [...template.matchAll(/\{\{([A-Za-z0-9_]+)\}\}/g)].map((m) => m[1]);
      for (const name of new Set(names)) {
        const known =
          Object.prototype.hasOwnProperty.call(manifest.substitutions, name) ||
          name === 'BASE_NAME' ||
          name === 'INSTALL_NAME' ||
          manifest.axes.some((axis) => axis.id === name);
        expect(known, `${manifest.base} placeholder {{${name}}}`).toBe(true);
      }
    }
  });
});

describe('templating resolver', () => {
  test('an unresolved placeholder throws', () => {
    const manifest = parseManifest({
      base: 'Demo',
      installAs: 'demo.md',
      axes: [{ id: 'unity_skills', values: { sk: true, nsk: false }, default: 'nsk' }],
      output: '{{BASE_NAME}}.{{unity_skills}}.md',
      substitutions: {},
    });
    expect(() => resolveTemplate('---\nname: Demo\n---\n{{MISSING}}\n', manifest, { unity_skills: 'nsk' })).toThrow();
  });

  test('a missing axis value and an unknown value both throw', () => {
    const manifest = parseManifest({
      base: 'Demo',
      installAs: 'demo.md',
      axes: [{ id: 'unity_skills', values: { sk: true, nsk: false }, default: 'nsk' }],
      output: '{{BASE_NAME}}.{{unity_skills}}.md',
      substitutions: { X: { sk: 'x', nsk: '' } },
    });
    expect(() => resolveTemplate('{{X}}', manifest, {})).toThrow();
    expect(() => resolveTemplate('{{X}}', manifest, { unity_skills: 'maybe' })).toThrow();
  });

  test('an unsupported manifest schemaVersion throws', () => {
    expect(() =>
      parseManifest({
        schemaVersion: 999,
        base: 'Demo',
        installAs: 'demo.md',
        axes: [{ id: 'a', values: { x: 'x' } }],
        output: '{{BASE_NAME}}.{{a}}.md',
        substitutions: {},
      })
    ).toThrow();
  });

  test('the shared tool is the only resolver (no substitution logic in the apply engine)', () => {
    const merge = readFileSync(join(repoRoot, 'xdomains', 'merge-domains.js'), 'utf8');
    expect(merge).toContain('template-agent.mjs');
    // It shells out to the shared tool; it never substitutes placeholders itself.
    expect(merge).not.toMatch(/\{\{[A-Z_]+\}\}/);
    expect(merge).not.toContain('.replace(/{{');
  });
});

describe('agent evaluation verdict', () => {
  const noOverlap = ['UnityScene', 'UnityAnimator', 'UnityTddSpecialist', 'UnityNativePlugin'];
  const spec = readFileSync(resolve(repoRoot, '..', '.scratch', 'unity-skills', 'spec.md'), 'utf8');

  test('agents with no Unity-skill overlap have no template', () => {
    const bases = TEMPLATES.map((t) => t.manifest.base);
    for (const base of noOverlap) expect(bases, base).not.toContain(base);
  });

  test('the spec records the no-overlap verdict', () => {
    for (const base of noOverlap) expect(spec, base).toContain(base);
    expect(spec).toContain('evaluated, no overlap');
  });
});

describe('conditional attribution and skill references', () => {
  const allVariants = TEMPLATES.flatMap(({ manifest, templatePath }) => {
    const template = readFileSync(templatePath, 'utf8');
    const dir = dirname(templatePath);
    return combinations(manifest).map((combo) => ({
      key: templatePath,
      base: manifest.base,
      combo,
      content: readFileSync(join(dir, resolveTemplate(template, manifest, combo).filename), 'utf8'),
    }));
  });

  test('every sk variant carries the Unity attribution comment and a path reference', () => {
    const sk = allVariants.filter((v) => v.combo.unity_skills === 'sk');
    expect(sk.length).toBeGreaterThan(0);
    for (const variant of sk) {
      expect(variant.content, `${variant.base} attribution`).toContain('Unity Companion License');
      expect(variant.content, `${variant.base} holder`).toContain('Unity Technologies');
      expect(variant.content, `${variant.base} skill ref`).toContain('<skill_references>');
      expect(variant.content, `${variant.base} vendor path`).toContain('.opencode/xdomains/vendor/unity-skills/');
      expect(variant.content, `${variant.base} fallback rule`).toContain('unity_skill_path');
    }
  });

  test('every nsk variant carries no Unity attribution and no skill references', () => {
    const nsk = allVariants.filter((v) => v.combo.unity_skills === 'nsk');
    expect(nsk.length).toBeGreaterThan(0);
    for (const variant of nsk) {
      expect(variant.content, `${variant.base} attribution`).not.toContain('Unity Companion License');
      expect(variant.content, `${variant.base} skill ref`).not.toContain('<skill_references>');
      expect(variant.content, `${variant.base} fallback rule`).not.toContain('unity_skill_path');
    }
  });

  test('each sk variant keeps the same base frontmatter as its nsk sibling', () => {
    const frontmatter = (content: string): string =>
      (/^---\r?\n([\s\S]*?)\r?\n---/.exec(content)?.[1] ?? '').replace(/\r\n/g, '\n');
    const sk = allVariants.filter((v) => v.combo.unity_skills === 'sk');
    expect(sk.length).toBeGreaterThan(0);
    for (const variant of sk) {
      const sibling = allVariants.find(
        (other) =>
          other.key === variant.key &&
          other.combo.unity_skills === 'nsk' &&
          other.combo.ui_stack === variant.combo.ui_stack
      );
      expect(sibling, `${variant.base} nsk sibling`).toBeDefined();
      expect(frontmatter(variant.content), `${variant.base} frontmatter`).toBe(frontmatter(sibling!.content));
    }
  });

  test('every UI-stack variant carries its stack-specific rule', () => {
    const uiVariants = allVariants.filter((v) => typeof v.combo.ui_stack === 'string');
    expect(uiVariants.length).toBeGreaterThan(0);
    for (const variant of uiVariants) {
      expect(variant.content, `${variant.base} ${variant.combo.ui_stack}`).toContain(`${variant.combo.ui_stack}_authoring`);
    }
  });
});

// ---------------------------------------------------------------------------
// Installer
// ---------------------------------------------------------------------------

function makeSource(dir: string, license = 'Unity Skills © 2026 Unity Technologies\n\nLicensed under the Unity Companion License for Unity-dependent projects.\n') {
  const source = join(dir, 'source');
  mkdirSync(join(source, 'skills', 'ui-uitk'), { recursive: true });
  writeFileSync(join(source, 'LICENSE.md'), license);
  writeFileSync(join(source, 'skills', 'ui-uitk', 'SKILL.md'), '# ui-uitk\n');
  return source;
}

function options(dir: string, overrides: Partial<UnitySkillsOptions> = {}): UnitySkillsOptions {
  const projectRoot = join(dir, 'project');
  const opencodeDir = join(projectRoot, '.opencode');
  mkdirSync(opencodeDir, { recursive: true });
  return {
    projectRoot,
    opencodeDir,
    ability: 'unity-skills',
    json: true,
    list: false,
    install: true,
    off: false,
    status: false,
    consent: true,
    uiStack: 'uitk',
    now: '2026-09-23T00:00:00.000Z',
    ...overrides,
  };
}

describe('unity-skills installer', () => {
  test('verifyLicense rejects a missing or wrong LICENSE.md', () => {
    withTempDir((dir) => {
      expect(verifyLicense(dir).ok).toBe(false);
      writeFileSync(join(dir, 'LICENSE.md'), 'MIT License');
      expect(verifyLicense(dir).ok).toBe(false);
      writeFileSync(join(dir, 'LICENSE.md'), 'Unity Companion License\nCopyright © Unity Technologies');
      expect(verifyLicense(dir).ok).toBe(true);
    });
  });

  test('install copies into the vendor path, verifies the license, and enables the toggle', async () => {
    await withTempDirAsync(async (dir) => {
      const opts = options(dir);
      opts.download = localDownload(makeSource(dir));
      const result = await runUnitySkills(opts);
      expect(result.status).toBe('installed');
      expect(result.licenseVerified).toBe(true);
      expect(existsSync(join(opts.opencodeDir, 'xdomains', 'vendor', 'unity-skills', 'LICENSE.md'))).toBe(true);
      const config = JSON.parse(readFileSync(join(opts.opencodeDir, 'unity-studio.json'), 'utf8'));
      expect(config.toggles.unitySkills).toBe(true);
      expect(readFileSync(join(opts.projectRoot, '.gitignore'), 'utf8')).toContain('.opencode/xdomains/vendor/');
    });
  });

  test('declined consent is a no-op', async () => {
    await withTempDirAsync(async (dir) => {
      const opts = options(dir, { install: true, consent: false });
      const result = await runUnitySkills(opts);
      expect(result.status).toBe('refused');
      expect(existsSync(join(opts.opencodeDir, 'xdomains', 'vendor', 'unity-skills'))).toBe(false);
      expect(existsSync(join(opts.opencodeDir, 'unity-studio.json'))).toBe(false);
    });
  });

  test('a license mismatch aborts and removes the partial download', async () => {
    await withTempDirAsync(async (dir) => {
      const opts = options(dir);
      const source = makeSource(dir, 'MIT License\n');
      opts.download = localDownload(source);
      const result = await runUnitySkills(opts);
      expect(result.status).toBe('refused');
      expect(result.errors.join(' ')).toContain('Unity Companion License');
      expect(existsSync(join(opts.opencodeDir, 'xdomains', 'vendor', 'unity-skills'))).toBe(false);
    });
  });

  test('a missing skills/ directory aborts', async () => {
    await withTempDirAsync(async (dir) => {
      const opts = options(dir);
      const source = join(dir, 'license-only');
      mkdirSync(source, { recursive: true });
      writeFileSync(join(source, 'LICENSE.md'), 'Unity Companion License\nCopyright © Unity Technologies');
      opts.download = localDownload(source);
      const result = await runUnitySkills(opts);
      expect(result.status).toBe('refused');
      expect(result.errors.join(' ')).toContain('skills/');
      expect(existsSync(join(opts.opencodeDir, 'xdomains', 'vendor', 'unity-skills'))).toBe(false);
    });
  });

  test('install without consent refuses before downloading', async () => {
    await withTempDirAsync(async (dir) => {
      const opts = options(dir, { install: true, consent: false });
      let downloaded = false;
      opts.download = (dest) => {
        downloaded = true;
        return localDownload(makeSource(dir))(dest);
      };
      const result = await runUnitySkills(opts);
      expect(result.status).toBe('refused');
      expect(downloaded).toBe(false);
    });
  });

  test('off disables the toggle without touching the vendor path', async () => {
    await withTempDirAsync(async (dir) => {
      const opts = options(dir, { install: false, off: true, consent: false });
      writeFileSync(join(opts.opencodeDir, 'unity-studio.json'), JSON.stringify({ schemaVersion: 1, toggles: { unitySkills: true } }));
      const result = await runUnitySkills(opts);
      expect(result.status).toBe('disabled');
      const config = JSON.parse(readFileSync(join(opts.opencodeDir, 'unity-studio.json'), 'utf8'));
      expect(config.toggles.unitySkills).toBe(false);
    });
  });

  test('ensureGitignore is idempotent', () => {
    withTempDir((dir) => {
      expect(ensureGitignore(dir)).toBe(true);
      expect(ensureGitignore(dir)).toBe(false);
      expect(readFileSync(join(dir, '.gitignore'), 'utf8')).toContain('.opencode/xdomains/vendor/');
    });
  });

  test('the repository .gitignore ignores the vendor path', () => {
    const gitignore = readFileSync(join(repoRoot, '.gitignore'), 'utf8');
    expect(gitignore).toMatch(/xdomains\/vendor\//);
  });
});

// ---------------------------------------------------------------------------
// Attribution file
// ---------------------------------------------------------------------------

describe('attribution records the optional install', () => {
  const attribution = readFileSync(join(repoRoot, 'docs', 'Attribution.md'), 'utf8');

  test('names the repository, holder, and LicenseRef', () => {
    expect(attribution).toContain('Unity-Technologies/skills');
    expect(attribution).toContain('Unity Technologies');
    expect(attribution).toContain('LicenseRef-Unity-Companion');
    expect(attribution).toContain('Optional install');
  });

  test('carries the full Unity Companion License text', () => {
    expect(attribution).toContain('Unity Companion License');
    expect(attribution).toContain('Unity Technologies SF');
    expect(attribution).toContain('You own your content');
    expect(attribution).toContain('(10.29.2024)');
  });

  test('states the optional-install exception and the derivative-works position', () => {
    expect(attribution.toLowerCase()).toContain('optional-install exception');
    expect(attribution).toMatch(/no\s+assignment of derivative-work IP to Unity/i);
  });

  test('basename sanity: variant files are not tracked under a vendor path', () => {
    // Guards the "no Unity source in tracked paths" rule at the repo level.
    expect(existsSync(join(repoRoot, 'xdomains', 'vendor'))).toBe(false);
  });
});
