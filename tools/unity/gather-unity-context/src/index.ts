import { basename, join } from 'node:path';
import { dirExists, nowIso, readJson, writeJson } from '../../../shared/io';
import { PromptClient, loadAnswersFile } from '../../../shared/prompt-client';
import { probeToolchain } from '../../../shared/toolchain';
import { selectRoute } from '../../../shared/tool-routing';
import { resolveOptions } from './cli';
import { findLiveInstance, startEditor, stopEditor } from './editor';
import { fingerprintInputs, fingerprintOf } from './fingerprint';
import { runGate } from './gate';
import {
  produceAsmdefMap,
  produceCompileState,
  produceDeprecationScan,
  produceLogDigest,
  produceProjectSettings,
  produceTestInventory,
} from './offline';
import { inspectMcp, inspectPipeline, inventoryCommands } from './producers';
import { clearScratch, ensureScratch } from './scratch';
import { discoverProjectStructure } from './structure';

interface ScanResult {
  projectName?: string;
  foundProject?: boolean;
  assetFolder?: string | null;
}

async function main(): Promise<void> {
  const options = resolveOptions(process.argv.slice(2));
  const answers = loadAnswersFile(options.answersFile);
  const prompts = new PromptClient({
    promptScript: options.promptScript,
    answers,
    nonInteractive: options.nonInteractive,
  });

  if (options.force) clearScratch(options.scratchDir);
  else ensureScratch(options.scratchDir);

  const scan = readJson<ScanResult>(join(options.projectDataDir, 'scan-result.json'));
  const projectName = scan?.projectName || basename(options.projectRoot);
  const assetFolder = scan?.assetFolder || join(options.projectRoot, 'Assets');
  const foundProject = scan?.foundProject ?? dirExists(assetFolder);

  const toolchain = probeToolchain(options.projectRoot, options.cliCommand);
  const cliAvailable = Boolean(toolchain.cliPath);
  const selection = selectRoute({ bridge: null, cliAvailable });

  // The gate needs the Editor. If one is not running, start it with -automated
  // and stop it again once we are done.
  let editorInstance = null;
  let editorStartedByUs = false;
  if (options.runGate) {
    editorInstance = findLiveInstance(options.projectRoot, options.cliCommand);
    if (!editorInstance) {
      editorInstance = startEditor(options.projectRoot, options.cliCommand);
      editorStartedByUs = editorInstance != null;
    }
  }

  try {
    const structure = await discoverProjectStructure({
      projectRoot: options.projectRoot,
      assetFolder,
      projectName,
      prompts,
    });

    const { commandList, commandSchema } = inventoryCommands(options.projectRoot, options.cliCommand);
    const pipeline = inspectPipeline(options.cliCommand);
    const mcp = inspectMcp(options.projectRoot, options.cliCommand);

    const fpInputs = fingerprintInputs(options.projectRoot, projectName);
    const fingerprint = fingerprintOf(fpInputs);
    const gate = runGate(options, editorInstance);

    const offlineInput = {
      projectRoot: options.projectRoot,
      assetFolder,
      opencodeDir: options.opencodeDir,
    };
    const compileState = produceCompileState(offlineInput);
    const logDigest = produceLogDigest(offlineInput);
    const projectSettings = produceProjectSettings(offlineInput);
    const asmdefMap = produceAsmdefMap(offlineInput);
    const testInventory = produceTestInventory(offlineInput);
    const deprecationScan = produceDeprecationScan(offlineInput);

    const hardFailures =
      (gate.editMode?.status === 'failed' ? 1 : 0) + (gate.playMode?.status === 'failed' ? 1 : 0);

    const verificationReport = {
      schemaVersion: 1,
      generatedAt: nowIso(),
      project: projectName,
      projectPath: options.projectRoot,
      configuredUnityVersion: toolchain.unityVer,
      status: gate.status,
      gateResult: gate.status,
      instance: gate.instance,
      startedByEditor: editorStartedByUs,
      summary: {
        editMode: gate.editMode?.counts ?? null,
        playMode: gate.playMode?.counts ?? null,
      },
      results: { editMode: gate.editMode, playMode: gate.playMode },
      fingerprint,
      errors: [],
    };

    const gateState = {
      schemaVersion: 1,
      generatedAt: nowIso(),
      project: projectName,
      projectPath: options.projectRoot,
      fingerprint,
      fingerprintInputs: fpInputs,
      unityCliVer: toolchain.cliVer,
      unityVer: toolchain.unityVer,
      unityEnv: toolchain.env,
      gateResult: gate.status,
      gateInstance: gate.instance,
      gateStartedByEditor: editorStartedByUs,
      lastVerificationUtc: gate.status === 'not_run' ? null : nowIso(),
      reviewRequired: 0,
      hardFailures,
      routing: { route: selection.route, reason: selection.reason },
    };

    writeJson(join(options.projectDataDir, 'project-structure.json'), structure);
    writeJson(join(options.projectDataDir, 'unity-command-list.json'), commandList);
    writeJson(join(options.projectDataDir, 'unity-command-schema.json'), commandSchema);
    writeJson(join(options.projectDataDir, 'unity-pipeline-status.json'), pipeline);
    writeJson(join(options.projectDataDir, 'unity-mcp-status.json'), mcp);
    writeJson(join(options.projectDataDir, 'unity-verification-report.json'), verificationReport);
    writeJson(join(options.projectDataDir, 'gate-state.json'), gateState);
    writeJson(join(options.projectDataDir, 'compile-state.json'), compileState);
    writeJson(join(options.projectDataDir, 'log-digest.json'), logDigest);
    writeJson(join(options.projectDataDir, 'project-settings.json'), projectSettings);
    writeJson(join(options.projectDataDir, 'asmdef-map.json'), asmdefMap);
    writeJson(join(options.projectDataDir, 'test-inventory.json'), testInventory);
    writeJson(join(options.projectDataDir, 'deprecation-scan.json'), deprecationScan);

    const summary = {
      generatedAt: nowIso(),
      projectName,
      foundProject,
      assetFolder,
      baseFolder: structure.baseFolder,
      baseFolderConfident: structure.baseFolderConfident,
      unityCliVer: toolchain.cliVer,
      unityVer: toolchain.unityVer,
      fingerprint,
      route: selection.route,
      routeReason: selection.reason,
      gateResult: gate.status,
      gateStartedByEditor: editorStartedByUs,
      cancelled: prompts.isCancelled(),
      paths: {
        projectDataDir: options.projectDataDir,
        projectStructure: join(options.projectDataDir, 'project-structure.json'),
        commandList: join(options.projectDataDir, 'unity-command-list.json'),
        commandSchema: join(options.projectDataDir, 'unity-command-schema.json'),
        pipelineStatus: join(options.projectDataDir, 'unity-pipeline-status.json'),
        mcpStatus: join(options.projectDataDir, 'unity-mcp-status.json'),
        verificationReport: join(options.projectDataDir, 'unity-verification-report.json'),
        gateState: join(options.projectDataDir, 'gate-state.json'),
        compileState: join(options.projectDataDir, 'compile-state.json'),
        logDigest: join(options.projectDataDir, 'log-digest.json'),
        projectSettings: join(options.projectDataDir, 'project-settings.json'),
        asmdefMap: join(options.projectDataDir, 'asmdef-map.json'),
        testInventory: join(options.projectDataDir, 'test-inventory.json'),
        deprecationScan: join(options.projectDataDir, 'deprecation-scan.json'),
      },
    };
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  } finally {
    if (editorStartedByUs && editorInstance) stopEditor(editorInstance);
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`gather-unity-context: ${message}\n`);
  process.exitCode = 1;
});
