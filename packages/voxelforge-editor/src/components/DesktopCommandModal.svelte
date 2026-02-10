<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { get } from 'svelte/store';
  import { X } from 'phosphor-svelte';
  import type { DesktopModalRequest } from '$lib/desktop/ui-command-store';
  import {
    type CreateCommandInput,
    type DeployCommandInput,
    type GenerateCommandInput,
    type PluginCommandInput,
    type PresetCommandInput,
    buildCreateArgs,
    buildDeployArgs,
    buildGenerateArgs,
    buildPluginArgs,
    buildPresetArgs,
    parseGenericArgsInput,
  } from '$lib/desktop/cli-args';
  import { cliConsoleStore } from '$lib/cli-console/store';
  import { projectStore, uiStore } from '$lib/stores';

  let { modal }: { modal: DesktopModalRequest | null } = $props();

  const dispatch = createEventDispatcher<{ close: void }>();

  let modalKey = '';
  let error = $state<string | null>(null);
  let busy = $state(false);

  let createForm = $state<CreateCommandInput & { destination: string }>({
    name: 'my-game',
    template: 'vanilla',
    destination: '.',
    pm: '',
    installMode: 'install',
    yes: false,
    force: false,
    git: true,
    verbose: false,
    quiet: false,
    dryRun: false,
    noColor: false,
  });

  let generateForm = $state<GenerateCommandInput>({
    type: 'scenario',
    prompt: '',
    provider: 'auto',
    model: '',
    seed: '',
    size: '',
    textureSize: '',
    depth: '',
    scale: '',
    detail: '',
    maxVoxels: '',
    quality: '',
    attempts: '',
    minScore: '',
    modelEscalation: 'default',
    allowBase: false,
    strictQuality: false,
    outFormat: '',
    enhancedTerrain: 'default',
    workers: 'auto',
    intentMode: '',
    intentStrict: false,
    autoView: 'default',
    debugAi: false,
    verbose: false,
    quiet: false,
    dryRun: false,
    noColor: false,
  });

  let deployForm = $state<DeployCommandInput>({
    dir: 'dist',
    channel: 'alpha',
    build: false,
    verbose: false,
    quiet: false,
    dryRun: false,
    noColor: false,
  });

  let pluginForm = $state<PluginCommandInput>({
    action: 'list',
    name: '',
    verbose: false,
    quiet: false,
    dryRun: false,
    noColor: false,
  });

  let presetForm = $state<PresetCommandInput>({
    command: 'dev',
    verbose: false,
    quiet: false,
    dryRun: false,
    noColor: false,
  });

  let genericCommand = $state('');
  let genericCwd = $state('');

  const ALLOWED_PRIMARY = new Set([
    'create',
    'dev',
    'build',
    'preview',
    'serve',
    'deploy',
    'generate',
    'plugin',
    '--help',
    '--list',
    '--version',
  ]);

  const close = (): void => {
    dispatch('close');
  };

  const applyVerboseQuiet = (
    value: { verbose?: boolean; quiet?: boolean },
    mode: 'verbose' | 'quiet' | 'none',
  ): void => {
    value.verbose = mode === 'verbose';
    value.quiet = mode === 'quiet';
  };

  const runCli = async (args: string[], cwd: string | undefined, label: string, wait = false) => {
    error = null;
    busy = true;
    uiStore.panels.show('console');
    try {
      if (wait) {
        return await cliConsoleStore.runCommandAndWait({ args, cwd, label });
      }
      await cliConsoleStore.runCommand({ args, cwd, label });
      return null;
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : String(runError);
      error = message;
      return null;
    } finally {
      busy = false;
    }
  };

  const browseDestination = async (): Promise<void> => {
    if (!window.voxelyn?.selectDirectory) return;
    const selected = await window.voxelyn.selectDirectory();
    if (!selected?.path) return;
    createForm.destination = selected.path;
  };

  const joinProjectPath = async (parent: string, name: string): Promise<string> => {
    if (window.voxelyn?.projectJoin) {
      return await window.voxelyn.projectJoin(parent, name);
    }
    if (parent.endsWith('/') || parent.endsWith('\\')) return `${parent}${name}`;
    return `${parent}/${name}`;
  };

  const handleCreate = async (): Promise<void> => {
    if (!modal) return;
    const name = createForm.name.trim();
    if (!name) {
      error = 'Project name is required.';
      return;
    }
    const destination = createForm.destination.trim() || '.';
    const args = buildCreateArgs({
      ...createForm,
      name,
    });

    const result = await runCli(args, destination, `create ${name}`, true);
    if (!result || result.code !== 0 || createForm.dryRun) return;

    const createdPath = await joinProjectPath(destination, name);
    if (window.voxelynDesktop?.openProjectPath) {
      await window.voxelynDesktop.openProjectPath(createdPath);
    }
    close();
  };

  const handleGenerate = async (): Promise<void> => {
    const type = generateForm.type.trim();
    const prompt = generateForm.prompt.trim();
    if (!type || !prompt) {
      error = 'Type and prompt are required.';
      return;
    }

    const cwd = get(projectStore).projectRoot ?? undefined;
    if (!cwd) {
      error = 'Open a project before running generate.';
      return;
    }

    const args = buildGenerateArgs({ ...generateForm, type, prompt });
    const result = await runCli(args, cwd, `generate ${type}`, true);
    if (result && result.code === 0) {
      await projectStore.refresh();
      close();
    }
  };

  const handleDeploy = async (): Promise<void> => {
    const cwd = get(projectStore).projectRoot ?? undefined;
    if (!cwd) {
      error = 'Open a project before deploy.';
      return;
    }
    const args = buildDeployArgs(deployForm);
    const result = await runCli(args, cwd, 'deploy', true);
    if (result && result.code === 0) close();
  };

  const handlePlugin = async (): Promise<void> => {
    if ((pluginForm.action === 'add' || pluginForm.action === 'remove') && !pluginForm.name?.trim()) {
      error = 'Plugin name is required for add/remove.';
      return;
    }
    const cwd = get(projectStore).projectRoot ?? undefined;
    const args = buildPluginArgs(pluginForm);
    const result = await runCli(args, cwd, `plugin ${pluginForm.action}`, true);
    if (result && result.code === 0) close();
  };

  const handlePreset = async (): Promise<void> => {
    const cwd = get(projectStore).projectRoot ?? undefined;
    if (!cwd) {
      error = 'Open a project before running this command.';
      return;
    }
    const args = buildPresetArgs(presetForm);
    const result = await runCli(args, cwd, presetForm.command, true);
    if (result && result.code === 0) close();
  };

  const handleGeneric = async (): Promise<void> => {
    const args = parseGenericArgsInput(genericCommand);
    if (args.length === 0) {
      error = 'Command is required.';
      return;
    }
    const primary = args[0] ?? '';
    if (!ALLOWED_PRIMARY.has(primary)) {
      error = `Command not allowed: ${primary}`;
      return;
    }

    const cwd = genericCwd.trim() || get(projectStore).projectRoot || undefined;
    const result = await runCli(args, cwd, args.join(' '), true);
    if (result && result.code === 0) close();
  };

  const resetForModal = (): void => {
    error = null;
    const payload = modal?.payload ?? {};

    if (modal?.kind === 'new-project') {
      const projectRoot = get(projectStore).projectRoot;
      createForm = {
        name: 'my-game',
        template: 'vanilla',
        destination: projectRoot ?? '.',
        pm: '',
        installMode: 'install',
        yes: false,
        force: false,
        git: true,
        verbose: false,
        quiet: false,
        dryRun: false,
        noColor: false,
      };
      return;
    }

    if (modal?.kind === 'generate') {
      const suggested = typeof payload.type === 'string' && payload.type.length > 0 ? payload.type : 'scenario';
      generateForm = {
        ...generateForm,
        type: suggested,
      };
      return;
    }

    if (modal?.kind === 'plugin') {
      const action = typeof payload.action === 'string' ? payload.action : 'list';
      pluginForm = {
        ...pluginForm,
        action: action === 'add' || action === 'remove' || action === 'list' ? action : 'list',
      };
      return;
    }

    if (modal?.kind === 'run-preset') {
      const command = typeof payload.command === 'string' ? payload.command : 'dev';
      presetForm = {
        ...presetForm,
        command: command === 'build' || command === 'preview' || command === 'serve' || command === 'dev' ? command : 'dev',
      };
      return;
    }

    if (modal?.kind === 'run-cli') {
      genericCommand = '';
      genericCwd = get(projectStore).projectRoot ?? '';
    }
  };

  $effect(() => {
    const nextKey = modal ? `${modal.kind}:${JSON.stringify(modal.payload ?? {})}` : '';
    if (nextKey !== modalKey) {
      modalKey = nextKey;
      if (modal) {
        resetForModal();
      }
    }
  });
</script>

{#if modal}
  <div
    class="backdrop"
    role="button"
    tabindex="0"
    onclick={(event) => event.currentTarget === event.target && close()}
    onkeydown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        close();
      }
    }}
  >
    <div class="modal">
      <header>
        <h3>
          {#if modal.kind === 'new-project'}New Project
          {:else if modal.kind === 'generate'}Generate
          {:else if modal.kind === 'deploy'}Deploy
          {:else if modal.kind === 'plugin'}Plugin
          {:else if modal.kind === 'run-preset'}Run Command
          {:else}Run CLI Command{/if}
        </h3>
        <button type="button" class="icon" onclick={close}><X size={14} /></button>
      </header>

      <section class="content">
        {#if modal.kind === 'new-project'}
          <div class="grid two">
            <label>Name <input bind:value={createForm.name} /></label>
            <label>Template
              <select bind:value={createForm.template}>
                <option value="vanilla">vanilla</option>
                <option value="react">react</option>
                <option value="svelte">svelte</option>
              </select>
            </label>
            <label class="wide">Destination
              <div class="row">
                <input bind:value={createForm.destination} />
                <button type="button" onclick={browseDestination}>Browse</button>
              </div>
            </label>
            <label>Package Manager
              <select bind:value={createForm.pm}>
                <option value="">auto</option>
                <option value="npm">npm</option>
                <option value="pnpm">pnpm</option>
                <option value="yarn">yarn</option>
                <option value="bun">bun</option>
              </select>
            </label>
            <label>Install
              <select bind:value={createForm.installMode}>
                <option value="install">install</option>
                <option value="no-install">no-install</option>
                <option value="default">default</option>
              </select>
            </label>
          </div>
          <div class="row toggles">
            <label><input type="checkbox" bind:checked={createForm.yes} /> --yes</label>
            <label><input type="checkbox" bind:checked={createForm.force} /> --force</label>
            <label><input type="checkbox" bind:checked={createForm.git} /> --git</label>
            <label><input type="checkbox" bind:checked={createForm.dryRun} /> --dry-run</label>
            <label><input type="checkbox" bind:checked={createForm.noColor} /> --no-color</label>
          </div>
          <div class="row toggles">
            <label><input type="radio" name="create-verbosity" checked={!createForm.verbose && !createForm.quiet} onchange={() => applyVerboseQuiet(createForm, 'none')} /> normal</label>
            <label><input type="radio" name="create-verbosity" checked={createForm.verbose} onchange={() => applyVerboseQuiet(createForm, 'verbose')} /> --verbose</label>
            <label><input type="radio" name="create-verbosity" checked={createForm.quiet} onchange={() => applyVerboseQuiet(createForm, 'quiet')} /> --quiet</label>
          </div>
          <footer>
            <button type="button" onclick={close}>Cancel</button>
            <button type="button" class="primary" onclick={handleCreate} disabled={busy}>Run</button>
          </footer>
        {:else if modal.kind === 'generate'}
          <div class="grid two">
            <label>Type <input bind:value={generateForm.type} placeholder="texture|scenario|object" /></label>
            <label>Provider
              <select bind:value={generateForm.provider}>
                <option value="auto">auto</option>
                <option value="gemini">gemini</option>
                <option value="openai">openai</option>
                <option value="anthropic">anthropic</option>
                <option value="groq">groq</option>
                <option value="ollama">ollama</option>
                <option value="copilot">copilot</option>
              </select>
            </label>
            <label class="wide">Prompt <input bind:value={generateForm.prompt} /></label>
            <label>Model <input bind:value={generateForm.model} /></label>
            <label>Seed <input type="number" bind:value={generateForm.seed} /></label>
            <label>Size <input bind:value={generateForm.size} placeholder="256x256" /></label>
            <label>Texture Size <input bind:value={generateForm.textureSize} /></label>
            <label>Depth <input type="number" bind:value={generateForm.depth} /></label>
            <label>Scale <input type="number" step="0.1" bind:value={generateForm.scale} /></label>
            <label>Detail
              <select bind:value={generateForm.detail}>
                <option value="">default</option>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </label>
            <label>Max Voxels <input type="number" bind:value={generateForm.maxVoxels} /></label>
            <label>Quality
              <select bind:value={generateForm.quality}>
                <option value="">default</option>
                <option value="fast">fast</option>
                <option value="balanced">balanced</option>
                <option value="high">high</option>
                <option value="ultra">ultra</option>
              </select>
            </label>
            <label>Attempts <input type="number" bind:value={generateForm.attempts} /></label>
            <label>Min Score <input type="number" step="0.01" min="0" max="1" bind:value={generateForm.minScore} /></label>
            <label>Model Escalation
              <select bind:value={generateForm.modelEscalation}>
                <option value="default">default</option>
                <option value="on">on</option>
                <option value="off">off</option>
              </select>
            </label>
            <label>Out Format
              <select bind:value={generateForm.outFormat}>
                <option value="">default</option>
                <option value="bundle">bundle</option>
                <option value="layout">layout</option>
                <option value="terrain-spec">terrain-spec</option>
              </select>
            </label>
            <label>Enhanced Terrain
              <select bind:value={generateForm.enhancedTerrain}>
                <option value="default">default</option>
                <option value="on">on</option>
                <option value="off">off</option>
              </select>
            </label>
            <label>Workers <input bind:value={generateForm.workers} placeholder="auto" /></label>
            <label>Intent Mode
              <select bind:value={generateForm.intentMode}>
                <option value="">default</option>
                <option value="fast">fast</option>
                <option value="balanced">balanced</option>
                <option value="deep">deep</option>
              </select>
            </label>
            <label>Auto View
              <select bind:value={generateForm.autoView}>
                <option value="default">default</option>
                <option value="on">on</option>
                <option value="off">off</option>
              </select>
            </label>
          </div>
          <div class="row toggles">
            <label><input type="checkbox" bind:checked={generateForm.allowBase} /> --allow-base</label>
            <label><input type="checkbox" bind:checked={generateForm.strictQuality} /> --strict-quality</label>
            <label><input type="checkbox" bind:checked={generateForm.intentStrict} /> --intent-strict</label>
            <label><input type="checkbox" bind:checked={generateForm.debugAi} /> --debug-ai</label>
            <label><input type="checkbox" bind:checked={generateForm.dryRun} /> --dry-run</label>
            <label><input type="checkbox" bind:checked={generateForm.noColor} /> --no-color</label>
          </div>
          <div class="row toggles">
            <label><input type="radio" name="generate-verbosity" checked={!generateForm.verbose && !generateForm.quiet} onchange={() => applyVerboseQuiet(generateForm, 'none')} /> normal</label>
            <label><input type="radio" name="generate-verbosity" checked={generateForm.verbose} onchange={() => applyVerboseQuiet(generateForm, 'verbose')} /> --verbose</label>
            <label><input type="radio" name="generate-verbosity" checked={generateForm.quiet} onchange={() => applyVerboseQuiet(generateForm, 'quiet')} /> --quiet</label>
          </div>
          <footer>
            <button type="button" onclick={close}>Cancel</button>
            <button type="button" class="primary" onclick={handleGenerate} disabled={busy}>Run</button>
          </footer>
        {:else if modal.kind === 'deploy'}
          <div class="grid two">
            <label>Dir <input bind:value={deployForm.dir} /></label>
            <label>Channel <input bind:value={deployForm.channel} /></label>
          </div>
          <div class="row toggles">
            <label><input type="checkbox" bind:checked={deployForm.build} /> --build</label>
            <label><input type="checkbox" bind:checked={deployForm.dryRun} /> --dry-run</label>
            <label><input type="checkbox" bind:checked={deployForm.noColor} /> --no-color</label>
          </div>
          <div class="row toggles">
            <label><input type="radio" name="deploy-verbosity" checked={!deployForm.verbose && !deployForm.quiet} onchange={() => applyVerboseQuiet(deployForm, 'none')} /> normal</label>
            <label><input type="radio" name="deploy-verbosity" checked={deployForm.verbose} onchange={() => applyVerboseQuiet(deployForm, 'verbose')} /> --verbose</label>
            <label><input type="radio" name="deploy-verbosity" checked={deployForm.quiet} onchange={() => applyVerboseQuiet(deployForm, 'quiet')} /> --quiet</label>
          </div>
          <footer>
            <button type="button" onclick={close}>Cancel</button>
            <button type="button" class="primary" onclick={handleDeploy} disabled={busy}>Run</button>
          </footer>
        {:else if modal.kind === 'plugin'}
          <div class="grid two">
            <label>Action
              <select bind:value={pluginForm.action}>
                <option value="list">list</option>
                <option value="add">add</option>
                <option value="remove">remove</option>
              </select>
            </label>
            <label>Name <input bind:value={pluginForm.name} disabled={pluginForm.action === 'list'} /></label>
          </div>
          <div class="row toggles">
            <label><input type="checkbox" bind:checked={pluginForm.dryRun} /> --dry-run</label>
            <label><input type="checkbox" bind:checked={pluginForm.noColor} /> --no-color</label>
          </div>
          <div class="row toggles">
            <label><input type="radio" name="plugin-verbosity" checked={!pluginForm.verbose && !pluginForm.quiet} onchange={() => applyVerboseQuiet(pluginForm, 'none')} /> normal</label>
            <label><input type="radio" name="plugin-verbosity" checked={pluginForm.verbose} onchange={() => applyVerboseQuiet(pluginForm, 'verbose')} /> --verbose</label>
            <label><input type="radio" name="plugin-verbosity" checked={pluginForm.quiet} onchange={() => applyVerboseQuiet(pluginForm, 'quiet')} /> --quiet</label>
          </div>
          <footer>
            <button type="button" onclick={close}>Cancel</button>
            <button type="button" class="primary" onclick={handlePlugin} disabled={busy}>Run</button>
          </footer>
        {:else if modal.kind === 'run-preset'}
          <div class="grid two">
            <label>Command
              <select bind:value={presetForm.command}>
                <option value="dev">dev</option>
                <option value="build">build</option>
                <option value="preview">preview</option>
                <option value="serve">serve</option>
              </select>
            </label>
          </div>
          <div class="row toggles">
            <label><input type="checkbox" bind:checked={presetForm.dryRun} /> --dry-run</label>
            <label><input type="checkbox" bind:checked={presetForm.noColor} /> --no-color</label>
          </div>
          <div class="row toggles">
            <label><input type="radio" name="preset-verbosity" checked={!presetForm.verbose && !presetForm.quiet} onchange={() => applyVerboseQuiet(presetForm, 'none')} /> normal</label>
            <label><input type="radio" name="preset-verbosity" checked={presetForm.verbose} onchange={() => applyVerboseQuiet(presetForm, 'verbose')} /> --verbose</label>
            <label><input type="radio" name="preset-verbosity" checked={presetForm.quiet} onchange={() => applyVerboseQuiet(presetForm, 'quiet')} /> --quiet</label>
          </div>
          <footer>
            <button type="button" onclick={close}>Cancel</button>
            <button type="button" class="primary" onclick={handlePreset} disabled={busy}>Run</button>
          </footer>
        {:else}
          <div class="grid one">
            <label>Args
              <input
                bind:value={genericCommand}
                placeholder="create my-game vanilla --pm pnpm"
              />
            </label>
            <label>Cwd
              <input bind:value={genericCwd} placeholder="/path/to/project" />
            </label>
          </div>
          <footer>
            <button type="button" onclick={close}>Cancel</button>
            <button type="button" class="primary" onclick={handleGeneric} disabled={busy}>Run</button>
          </footer>
        {/if}

        {#if error}
          <p class="error">{error}</p>
        {/if}
      </section>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 1200;
    display: grid;
    place-items: center;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(2px);
  }

  .modal {
    width: min(920px, calc(100vw - 32px));
    max-height: calc(100vh - 48px);
    overflow: auto;
    border: 1px solid #2f3a5f;
    border-radius: 10px;
    background: #101827;
    color: #e5ebff;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.45);
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 14px;
    border-bottom: 1px solid #283453;
    position: sticky;
    top: 0;
    background: #111b2e;
  }

  h3 {
    margin: 0;
    font-size: 14px;
  }

  .icon {
    border: 1px solid #324264;
    border-radius: 6px;
    background: #15223a;
    color: #dbe8ff;
    width: 28px;
    height: 28px;
    cursor: pointer;
  }

  .content {
    padding: 14px;
    display: grid;
    gap: 12px;
  }

  .grid {
    display: grid;
    gap: 10px;
  }

  .grid.one {
    grid-template-columns: 1fr;
  }

  .grid.two {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .wide {
    grid-column: 1 / -1;
  }

  label {
    display: grid;
    gap: 4px;
    font-size: 12px;
    color: #aab6d8;
  }

  input,
  select {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #314163;
    border-radius: 6px;
    padding: 6px 8px;
    background: #0f1728;
    color: #e8efff;
  }

  .row {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }

  .row.toggles label {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    font-size: 12px;
    color: #c4d2f3;
  }

  .row.toggles input[type='checkbox'],
  .row.toggles input[type='radio'] {
    width: auto;
  }

  footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  footer button {
    border: 1px solid #324264;
    border-radius: 6px;
    padding: 7px 12px;
    background: #15223a;
    color: #dbe8ff;
    cursor: pointer;
  }

  footer button.primary {
    background: #1d4ed8;
    border-color: #2d62f0;
    color: white;
  }

  footer button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .error {
    margin: 0;
    color: #ff9d9d;
    font-size: 12px;
  }

  @media (max-width: 820px) {
    .grid.two {
      grid-template-columns: 1fr;
    }
  }
</style>
