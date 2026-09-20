import { join, resolve } from 'node:path';
import { discoverAssetFolder } from './asset-folder';
import { resolveOptions } from './cli';
import {
  contextPaths,
  loadFiletypes,
  loadPackageChoices,
  loadPatterns,
  loadUnderstoodPackages,
} from '../../../shared/context-files';
import { fileExists, nowIso, writeJson } from '../../../shared/io';
import { runPackageChoices } from './package-choices';
import { runPatternsInterview } from './patterns-interview';
import { PromptClient, loadAnswersFile } from '../../../shared/prompt-client';
import { detectInputUsage, discoverProjectFiles } from './project-files';
import { buildProjectJson } from './project-meta';
import { resolveProjectName } from './project-name';
import { runSubProjects } from './sub-projects';
import { activeInputHandler, probeToolchain } from '../../../shared/toolchain';
import { applySyntheticBuiltins, readUnityPackages } from './unity-packages';
import type { NativeState } from '../../../shared/types';

async function main(): Promise<void> {
  const opts = resolveOptions(process.argv.slice(2));
  const answers = loadAnswersFile(opts.answersFile);
  const prompts = new PromptClient({
    promptScript: opts.promptScript,
    answers,
    nonInteractive: opts.nonInteractive,
  });
  const warnings: string[] = [];
  const paths = contextPaths(opts.contextDir);

  const projectName = await resolveProjectName(opts.projectRoot, prompts);
  const { foundProject, assetFolder } = await discoverAssetFolder(opts.projectRoot, prompts);

  const filetypes = loadFiletypes(paths.filetypes);
  let files: ReturnType<typeof discoverProjectFiles> = { folders: {}, filetypeToFolder: {}, codeFiles: [] };
  let inputUsage = { usesInputSystem: false, usesLegacyInput: false };
  if (foundProject && assetFolder) {
    files = discoverProjectFiles(opts.projectRoot, assetFolder, filetypes.filetypes);
    inputUsage = detectInputUsage(files.codeFiles);
  } else if (!foundProject) {
    warnings.push('No Assets folder found; treated as a non-Unity project.');
  }

  let toolchain = probeToolchain(opts.projectRoot);
  if (!toolchain.cliPath) {
    const help = await prompts.ask({
      title: 'Unity CLI',
      questions: [
        {
          id: 'wantCliHelp',
          type: 'confirm',
          message:
            'The Unity CLI was not found on PATH. It lets the agents inspect the project, run tests, build, and capture the editor. Continue without it?',
          initialValue: true,
        },
      ],
    });
    if (help.wantCliHelp !== true) {
      const pathAnswer = await prompts.ask({
        title: 'Unity CLI path',
        questions: [{ id: 'cliPath', type: 'text', message: 'Path to the unity CLI executable' }],
      });
      const cliPath = String(pathAnswer.cliPath || '').trim();
      if (cliPath) toolchain = { ...probeToolchain(opts.projectRoot, cliPath), cliPath };
    }
  }

  const cliVer = toolchain.cliVer ?? null;
  const unityVer = toolchain.unityVer ?? null;

  const packagesResult = readUnityPackages(opts.projectRoot, toolchain.info);
  const handler = activeInputHandler(opts.projectRoot);
  const usesInputSystem =
    inputUsage.usesInputSystem || handler === 1 || handler === 2 || 'com.unity.inputsystem' in packagesResult.map;
  const usesLegacyInput = inputUsage.usesLegacyInput || handler === 0 || handler === 2;
  applySyntheticBuiltins(packagesResult.map, usesLegacyInput);
  const installed = new Set(Object.keys(packagesResult.map));

  let pipelineVer: string | null = packagesResult.map['com.unity.pipeline'] ?? null;
  if (!pipelineVer && foundProject && !opts.nonInteractive) {
    const action = await prompts.ask({
      title: 'Unity Pipeline package',
      questions: [
        {
          id: 'pipelineAction',
          type: 'select',
          message:
            'com.unity.pipeline is not installed. It unlocks Editor automation (commands, tests, builds) for the agents. Install it now via Window > Package Manager?',
          options: [
            { value: 'wait', label: 'I will install it now' },
            { value: 'skip', label: 'Skip for now' },
          ],
        },
      ],
    });
    if (action.pipelineAction === 'wait') {
      await prompts.ask({
        title: 'Unity Pipeline package',
        questions: [{ id: 'pipelineReady', type: 'confirm', message: 'Let me know when you are ready.', initialValue: true }],
      });
      const refreshed = readUnityPackages(opts.projectRoot, toolchain.info);
      if (refreshed.map['com.unity.pipeline']) {
        pipelineVer = refreshed.map['com.unity.pipeline'];
        Object.assign(packagesResult.map, refreshed.map);
      } else {
        warnings.push('com.unity.pipeline was still not found after the install step.');
      }
    }
  }

  const choices = loadPackageChoices(paths.packageChoices);
  const understood = loadUnderstoodPackages(paths.understoodPackages);
  const pkgResult = await runPackageChoices(choices, understood, installed, projectName, prompts);

  const patterns = loadPatterns(paths.patterns);
  const patternResult = await runPatternsInterview(patterns, prompts);
  warnings.push(...patternResult.warnings);

  const subResult = await runSubProjects(opts.projectRoot, projectName, prompts);

  const projectMeta = buildProjectJson({
    name: projectName,
    path: opts.projectRoot,
    info: toolchain.info,
    unityVer,
    env: toolchain.env,
    native: subResult.native,
    subProjects: subResult.subProjects,
  });

  if (foundProject) {
    await prompts.ask({
      title: 'Unity Editor',
      questions: [
        {
          id: 'editorReady',
          type: 'confirm',
          message: `Launch the Unity Editor for ${projectName}, then confirm to continue.`,
          initialValue: true,
        },
      ],
    });
  }
  const unityContext = {
    status: 'not-run',
    note: 'Run the gather-unity-context ability for full Unity context.',
  };

  const projectPref = {
    packageChoices: pkgResult.packageChoices,
    patterns: patternResult.patterns,
    deferredChoices: pkgResult.deferredChoices,
    usesInputSystem,
    usesLegacyInput,
  };

  const nativeState = buildNativeState(opts.projectRoot, projectName, subResult.native);

  writeJson(join(opts.projectDataDir, 'unity-project.json'), {
    projectName,
    projectPath: opts.projectRoot,
    unityVersion: unityVer,
    cliVersion: cliVer,
    pipelineVersion: pipelineVer,
    foundProject,
    assetFolder,
  });
  writeJson(join(opts.projectDataDir, 'unity-package-list.json'), {
    schemaVersion: 2,
    generatedAt: nowIso(),
    project: projectName,
    projectPath: opts.projectRoot,
    status: packagesResult.hasManifest ? 'observed_locally' : 'unavailable',
    files: {
      manifest: packagesResult.manifestPath,
      packagesLock: packagesResult.lockPath,
      manifestHash: packagesResult.manifestHash,
      packagesLockHash: packagesResult.lockHash,
    },
    packages: packagesResult.packages,
  });
  writeJson(join(opts.projectDataDir, 'native-project-state.json'), nativeState);
  writeJson(join(opts.projectDataDir, 'project-pref.json'), projectPref);
  writeJson(join(opts.projectDataDir, 'project-files.json'), {
    assetFolder,
    filetypeToFolder: files.filetypeToFolder,
    folders: files.folders,
  });

  writeJson(join(opts.interimDir, 'unity-packages.json'), {
    generatedAt: nowIso(),
    source: 'Packages/manifest.json + unity projects info',
    packages: packagesResult.map,
  });
  writeJson(join(opts.interimDir, 'project.json'), projectMeta);

  const scanResult = {
    generatedAt: nowIso(),
    projectName,
    foundProject,
    assetFolder,
    unityCliVer: cliVer,
    unityVer,
    pipelineVer,
    unityEnv: toolchain.env,
    inputFlags: { usesInputSystem, usesLegacyInput },
    cancelled: prompts.isCancelled(),
    unityContext,
    paths: {
      projectDataDir: opts.projectDataDir,
      interimDir: opts.interimDir,
      unityProject: join(opts.projectDataDir, 'unity-project.json'),
      unityPackageList: join(opts.projectDataDir, 'unity-package-list.json'),
      nativeProjectState: join(opts.projectDataDir, 'native-project-state.json'),
      projectPref: join(opts.projectDataDir, 'project-pref.json'),
      projectFiles: join(opts.projectDataDir, 'project-files.json'),
      unityPackages: join(opts.interimDir, 'unity-packages.json'),
      project: join(opts.interimDir, 'project.json'),
    },
    warnings,
  };
  writeJson(join(opts.projectDataDir, 'scan-result.json'), scanResult);

  process.stdout.write(JSON.stringify(scanResult, null, 2) + '\n');
}

function buildNativeState(projectRoot: string, projectName: string, native: NativeState | null): Record<string, unknown> {
  if (!native) {
    return {
      schemaVersion: 1,
      generatedAt: nowIso(),
      project: projectName,
      projectPath: projectRoot,
      state: {
        status: 'unavailable',
        solution: null,
        solutionExists: false,
        configuration: null,
        platform: null,
        artifacts: [],
      },
    };
  }
  const abs = (p: string): string => resolve(projectRoot, p);
  return {
    schemaVersion: 1,
    generatedAt: nowIso(),
    project: projectName,
    projectPath: projectRoot,
    state: {
      status: native.status,
      solution: native.solution ? abs(native.solution) : null,
      solutionExists: native.solutionExists,
      configuration: native.configuration,
      platform: native.platform,
      artifacts: native.artifacts.map((a) => ({
        name: a.name,
        kind: a.kind,
        path: abs(a.path),
        exists: a.path ? fileExists(abs(a.path)) : false,
        pdb: a.pdb ? abs(a.pdb) : null,
        pdbExists: a.pdb ? fileExists(abs(a.pdb)) : false,
      })),
    },
  };
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`scan-project: ${message}\n`);
  process.exitCode = 1;
});
