// Reads the `dependencies` object from a Unity `Packages/manifest.json`.
//
// Shared by the project-scan and version-drift abilities so the parse lives in
// one place. Fail-soft: a missing file reports `present: false`, and a file that
// exists but has no `dependencies` object reports `malformed: true`.
import { asRecord } from './json-helpers';
import { fileExists, readJson } from './io';

export interface ManifestDependencies {
  present: boolean;
  malformed: boolean;
  dependencies: Record<string, string> | null;
}

export function readManifestDependencies(manifestPath: string): ManifestDependencies {
  if (!fileExists(manifestPath)) return { present: false, malformed: false, dependencies: null };
  const dependencies = asRecord(asRecord(readJson<unknown>(manifestPath))?.dependencies);
  if (!dependencies) return { present: true, malformed: true, dependencies: null };
  const out: Record<string, string> = {};
  for (const [name, version] of Object.entries(dependencies)) out[name] = String(version);
  return { present: true, malformed: false, dependencies: out };
}
