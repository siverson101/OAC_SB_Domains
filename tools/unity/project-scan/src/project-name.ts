import { basename } from 'node:path';
import type { PromptClient } from '../../../shared/prompt-client';

export async function resolveProjectName(projectRoot: string, prompts: PromptClient): Promise<string> {
  const defaultName = basename(projectRoot);

  if (prompts.known('projectName')) return String(prompts.get('projectName') || defaultName);

  const confirm = await prompts.ask({
    title: 'Project name',
    questions: [
      {
        id: 'projectNameOk',
        type: 'confirm',
        message: `Use "${defaultName}" as the project name?`,
        initialValue: true,
      },
    ],
  });
  if (confirm.projectNameOk === true) return defaultName;

  const renamed = await prompts.ask({
    title: 'Project name',
    questions: [
      {
        id: 'projectName',
        type: 'text',
        message: 'Enter the project name',
        defaultValue: defaultName,
        initialValue: defaultName,
      },
    ],
  });
  return String(renamed.projectName || defaultName);
}
