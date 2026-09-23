// unity-skills — CLI for the optional Unity `unity-skills` install (ADR-0019).
//
// Usage:
//   unity-skills --opencode-dir .opencode --status [--json]
//   unity-skills --opencode-dir .opencode --install --yes [--ui-stack uitk] [--ref <sha>]
//   unity-skills --opencode-dir .opencode --off [--json]
//
// The download is the only network operation and only runs with explicit
// consent (`--yes`); every other step is offline and fail-soft.
import { runCli } from '../../../shared/cli-bootstrap';
import { resolveOptions } from './cli';
import { localDownload, runUnitySkills } from './installer';
import { UNITY_SKILLS_ABILITIES, type UnitySkillsOptions, type UnitySkillsResult } from './types';

const UI_STACKS = ['uitk', 'ugui', 'mixed'];

async function promptLine(question: string): Promise<string> {
  const readline = await import('node:readline/promises');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

async function promptYesNo(question: string): Promise<boolean> {
  return /^y(es)?$/i.test(await promptLine(question));
}

function render(result: UnitySkillsResult): string {
  const lines = [`[unity-skills] ${result.status} — ${result.summary}`];
  lines.push(`  vendor: ${result.vendorPath}`);
  if (result.commit) lines.push(`  commit: ${result.commit}`);
  lines.push(`  license verified: ${result.licenseVerified ? 'yes' : 'no'}`);
  lines.push(`  enabled: ${result.enabled ? 'yes' : 'no'}`);
  if (result.gitignoreUpdated) lines.push('  updated .gitignore');
  for (const error of result.errors) lines.push(`  error: ${error}`);
  if (result.action) lines.push(`  ACTION: ${result.action}`);
  return lines.join('\n');
}

runCli({
  abilities: UNITY_SKILLS_ABILITIES,
  resolveOptions,
  run: async (options: UnitySkillsOptions) => {
    if (options.source) options.download = localDownload(options.source);
    const interactive = Boolean(process.stdin.isTTY);
    // Consent is explicit: `--yes` skips the prompt, otherwise the interactive
    // install asks before any network call.
    if (options.install && !options.consent && interactive) {
      options.confirm = () =>
        promptYesNo(
          "Install Unity Technologies' unity-skills? It is downloaded into a gitignored vendor path and not redistributed by this repo [y/N]: "
        );
    }
    if (!options.uiStack) {
      const answer = interactive
        ? await promptLine(`UI stack (${UI_STACKS.join('|')}) [uitk]: `)
        : '';
      options.uiStack = UI_STACKS.includes(answer) ? answer : 'uitk';
    }
    return runUnitySkills(options);
  },
  render,
});
