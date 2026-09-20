import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readJson } from './io';
import type { PromptQuestion, PromptSpec } from './types';

export interface PromptClientOptions {
  promptScript: string;
  answers: Record<string, unknown>;
  nonInteractive: boolean;
}

export function defaultFor(q: PromptQuestion): unknown {
  switch (q.type) {
    case 'select':
      return q.initialValue ?? q.options?.[0]?.value ?? '';
    case 'multiselect':
      return q.initialValues ?? [];
    case 'text':
      return q.defaultValue ?? '';
    case 'confirm':
      return q.initialValue ?? false;
  }
}

export class PromptClient {
  private answers: Record<string, unknown>;
  private cancelledFlag = false;

  constructor(private opts: PromptClientOptions) {
    this.answers = { ...opts.answers };
  }

  known(id: string): boolean {
    return id in this.answers;
  }

  get<T = unknown>(id: string): T {
    return this.answers[id] as T;
  }

  isCancelled(): boolean {
    return this.cancelledFlag;
  }

  private fillDefaults(questions: PromptQuestion[]): void {
    for (const q of questions) {
      if (!(q.id in this.answers)) this.answers[q.id] = defaultFor(q);
    }
  }

  async ask(spec: PromptSpec): Promise<Record<string, unknown>> {
    const unanswered = spec.questions.filter((q) => !(q.id in this.answers));
    if (unanswered.length === 0) return this.answers;

    if (this.cancelledFlag || this.opts.nonInteractive) {
      this.fillDefaults(unanswered);
      return this.answers;
    }

    const dir = mkdtempSync(join(tmpdir(), 'oac-scan-'));
    const specPath = join(dir, 'spec.json');
    const outPath = join(dir, 'answers.json');
    try {
      writeFileSync(specPath, JSON.stringify({ ...spec, questions: unanswered }, null, 2));
      const res = spawnSync(process.execPath, [this.opts.promptScript, '--spec', specPath, '--out', outPath], {
        stdio: 'inherit',
      });
      if (res.status === 130) {
        this.cancelledFlag = true;
        this.fillDefaults(unanswered);
        return this.answers;
      }
      if (res.status !== 0) {
        this.cancelledFlag = true;
        this.fillDefaults(unanswered);
        return this.answers;
      }
      const parsed = readJson<{ answers?: Record<string, unknown> }>(outPath);
      Object.assign(this.answers, parsed?.answers ?? {});
      return this.answers;
    } finally {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }
}

export function loadAnswersFile(path?: string): Record<string, unknown> {
  if (!path) return {};
  return readJson<Record<string, unknown>>(path) ?? {};
}
