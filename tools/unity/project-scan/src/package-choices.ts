import type { PackageChoicesFile, UnderstoodPackagesFile } from '../../../shared/context-files';
import type { PromptClient } from '../../../shared/prompt-client';
import type { PromptQuestion } from '../../../shared/types';

export function derivePrettyName(packageName: string): string {
  const last = packageName.split('.').pop() ?? packageName;
  return last
    .split(/[-_]/)
    .map((segment) => (segment ? segment.charAt(0).toUpperCase() + segment.slice(1) : segment))
    .join('');
}

export function prettyNameFor(packageName: string, understood: UnderstoodPackagesFile): string {
  const row = understood.packages.find((p) => p.packageName === packageName);
  return row?.prettyName || derivePrettyName(packageName);
}

export interface PackageChoiceResult {
  packageChoices: Record<string, string>;
  deferredChoices: Record<string, string[]>;
}

export async function runPackageChoices(
  choices: PackageChoicesFile,
  understood: UnderstoodPackagesFile,
  installed: Set<string>,
  projectName: string,
  prompts: PromptClient
): Promise<PackageChoiceResult> {
  const packageChoices: Record<string, string> = {};
  const deferredChoices: Record<string, string[]> = {};
  const questions: PromptQuestion[] = [];
  const pending: { category: string; present: string[] }[] = [];

  for (const row of choices.choices ?? []) {
    const present = (row.packageNames ?? []).filter((p) => installed.has(p));
    if (row.deferToStage4) {
      deferredChoices[row.category] = present;
      continue;
    }
    if (present.length === 0) continue;
    if (present.length === 1) {
      packageChoices[row.category] = present[0];
      continue;
    }
    pending.push({ category: row.category, present });
    questions.push({
      id: `choice:${row.category}`,
      type: 'select',
      message: row.prompt.replace(/<project_name>/g, projectName),
      options: present.map((p) => ({ value: p, label: prettyNameFor(p, understood) })),
    });
  }

  if (questions.length > 0) {
    const answers = await prompts.ask({ title: 'Package choices', questions });
    for (const entry of pending) {
      packageChoices[entry.category] = String(answers[`choice:${entry.category}`]);
    }
  }

  return { packageChoices, deferredChoices };
}
