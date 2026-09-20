import type { PatternsFile } from '../../../shared/context-files';
import type { PromptClient } from '../../../shared/prompt-client';
import type { PromptQuestion } from '../../../shared/types';

export interface PatternsResult {
  patterns: Record<string, string | string[]>;
  warnings: string[];
}

export async function runPatternsInterview(patterns: PatternsFile, prompts: PromptClient): Promise<PatternsResult> {
  const questions: PromptQuestion[] = [];
  const asked: string[] = [];

  for (const category of patterns.categories ?? []) {
    if (category.deferToStage4) continue;
    const options = (category.patterns ?? []).map((id) => {
      const pattern = patterns.patterns.find((p) => p.id === id);
      return { value: id, label: pattern?.name ?? id, hint: pattern?.whenToUse };
    });
    if (category.selection === 'single') {
      questions.push({
        id: `pattern:${category.id}`,
        type: 'select',
        message: `${category.name}: choose one`,
        options: [...options, { value: 'none', label: "None / I don't know" }],
        initialValue: options[0]?.value,
      });
    } else {
      questions.push({
        id: `pattern:${category.id}`,
        type: 'multiselect',
        message: `${category.name}: choose any that apply`,
        options,
        initialValues: [],
        required: false,
      });
    }
    asked.push(category.id);
  }

  const answers = await prompts.ask({ title: 'Programming patterns', questions });

  const result: Record<string, string | string[]> = {};
  const chosen = new Set<string>();
  for (const categoryId of asked) {
    const value = answers[`pattern:${categoryId}`];
    if (value === undefined) continue;
    result[categoryId] = value as string | string[];
    for (const id of Array.isArray(value) ? value : [value]) {
      if (typeof id === 'string' && id !== 'none') chosen.add(id);
    }
  }

  const warnings: string[] = [];
  for (const id of chosen) {
    const pattern = patterns.patterns.find((p) => p.id === id);
    for (const conflict of pattern?.conflictsWith ?? []) {
      if (chosen.has(conflict)) {
        warnings.push(`Pattern conflict: "${id}" conflicts with "${conflict}".`);
      }
    }
  }

  return { patterns: result, warnings };
}
