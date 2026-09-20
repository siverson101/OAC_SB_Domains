import { describe, expect, test } from 'bun:test';
import { parseFrontmatter } from '../tools/shared/registry/src/frontmatter';
import { parseYaml } from '../tools/shared/yaml';

// Two YAML-ish subset parsers coexist: `tools/shared/yaml.ts` reads
// `primitive.yaml` contracts and `frontmatter.ts` reads capability frontmatter.
// They have different numeric grammars and block rules, so pin both the shared
// subset they must agree on and the divergences we deliberately tolerate.

const contractBody = [
  'id: unity.example.thing',
  'name: Example Thing',
  'category: example',
  'status: extracted',
  'enabled: true',
  'disabled: false',
  'retries: 3',
  'negative: -2',
  'ratio: 0.5',
  'setup_steps:',
  '  - Do the thing.',
  '  - Do the other thing.',
  'code_files:',
  '  - Scripts/Thing.cs',
  'tags: [alpha, beta, 3]',
  'license: MIT',
].join('\n');

function asFrontmatter(body: string) {
  return parseFrontmatter(`---\n${body}\n---\n`);
}

describe('primitive-contract parser agreement', () => {
  test('both parsers extract the same tree from a primitive-contract-shaped input', () => {
    expect(parseYaml(contractBody)).toEqual(asFrontmatter(contractBody));
  });

  test('the agreed subset covers strings, booleans, integers/decimals, flow arrays, block sequences', () => {
    const yaml = parseYaml(contractBody) as Record<string, unknown>;
    const fm = asFrontmatter(contractBody);

    expect(yaml.id).toBe('unity.example.thing');
    expect(yaml.license).toBe('MIT');
    expect(yaml.enabled).toBe(true);
    expect(yaml.disabled).toBe(false);
    expect(yaml.retries).toBe(3);
    expect(yaml.negative).toBe(-2);
    expect(yaml.ratio).toBe(0.5);
    expect(yaml.tags).toEqual(['alpha', 'beta', 3]);
    expect(yaml.setup_steps).toEqual(['Do the thing.', 'Do the other thing.']);
    expect(yaml.code_files).toEqual(['Scripts/Thing.cs']);

    for (const key of Object.keys(yaml)) {
      expect(yaml[key]).toEqual(fm[key]);
    }
  });

  test('the numeric-grammar divergence is pinned', () => {
    // `yaml.ts` only coerces decimal integers and `-?\d+\.\d+`; JSON.parse-based
    // `frontmatter.ts` also accepts exponent form and leading zeros.
    expect(parseYaml('x: 1e3')).toEqual({ x: '1e3' });
    expect(asFrontmatter('x: 1e3').x).toBe(1000);
    expect(parseYaml('x: 007')).toEqual({ x: 7 });
    expect(asFrontmatter('x: 007').x).toBe('007');
  });

  test('the null-token divergence is pinned', () => {
    expect(parseYaml('x: ~')).toEqual({ x: null });
    expect(asFrontmatter('x: ~').x).toBe('~');
  });

  test('the block-sequence indentation divergence is pinned', () => {
    // primitive.yaml sequences sit at the key's own indentation; frontmatter
    // only collects indented block content, so it yields an empty sequence.
    const sameIndent = 'items:\n- one\n- two';
    expect(parseYaml(sameIndent)).toEqual({ items: ['one', 'two'] });
    expect(asFrontmatter(sameIndent).items).toEqual([]);
  });
});
