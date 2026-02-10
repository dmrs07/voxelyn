<script lang="ts">
  import { onMount } from 'svelte';
  import { cliConsoleStore, type CliConsoleState, type CliRunRecord } from '$lib/cli-console/store';
  import { Terminal, ProhibitInset, Broom } from 'phosphor-svelte';

  let state = $state<CliConsoleState>({
    available: false,
    runs: [],
    activeRunId: null,
    error: null,
  });
  let filter = $state('active');

  const selectedRun = (): CliRunRecord | null => {
    if (state.runs.length === 0) return null;
    if (filter === 'active' && state.activeRunId) {
      return state.runs.find((run) => run.runId === state.activeRunId) ?? state.runs[0];
    }
    if (filter === 'all') return state.runs[0];
    return state.runs.find((run) => run.runId === filter) ?? state.runs[0];
  };

  const selectedOutput = (): string => {
    const run = selectedRun();
    if (!run) return '';
    return `${run.stdout}${run.stderr}`;
  };

  const statusLabel = (run: CliRunRecord): string => {
    if (run.status === 'running') return 'running';
    if (run.status === 'cancelled') return 'cancelled';
    if (run.status === 'success') return `success (${run.exitCode ?? 0})`;
    return `error (${run.exitCode ?? -1})`;
  };

  onMount(() => {
    cliConsoleStore.initialize();
    const unsub = cliConsoleStore.subscribe((next) => {
      state = next;
    });

    return () => {
      unsub();
    };
  });
</script>

<div class="console-panel">
  <header class="panel-header">
    <div class="title"><Terminal size={14} /> Console</div>
    <div class="actions">
      <button type="button" title="Clear runs" onclick={() => cliConsoleStore.clearRuns()}><Broom size={14} /></button>
      {#if selectedRun() && selectedRun()?.status === 'running'}
        <button
          type="button"
          class="danger"
          title="Cancel run"
          onclick={() => selectedRun() && cliConsoleStore.cancelRun(selectedRun()!.runId)}
        ><ProhibitInset size={14} /></button>
      {/if}
    </div>
  </header>

  <section class="panel-body">
    {#if !state.available}
      <p class="hint">CLI console is available only in Electron desktop mode.</p>
    {:else}
      <div class="controls">
        <label>
          Run
          <select bind:value={filter}>
            <option value="active">Active</option>
            <option value="all">Latest</option>
            {#each state.runs as run}
              <option value={run.runId}>{run.label} ({run.runId})</option>
            {/each}
          </select>
        </label>
      </div>

      {#if selectedRun()}
        {@const run = selectedRun()}
        <div class="run-meta">
          <div><strong>Status:</strong> {statusLabel(run)}</div>
          <div><strong>Args:</strong> <code>{run.args.join(' ')}</code></div>
          <div><strong>Cwd:</strong> <code>{run.cwd}</code></div>
          <div><strong>RunId:</strong> {run.runId}</div>
        </div>
        <pre class="output">{selectedOutput()}</pre>
      {:else}
        <p class="hint">No CLI runs yet.</p>
      {/if}

      {#if state.error}
        <p class="error">{state.error}</p>
      {/if}
    {/if}
  </section>
</div>

<style>
  .console-panel {
    display: flex;
    flex-direction: column;
    border: 1px solid #2a2a4e;
    border-radius: 8px;
    background: #0b1220;
    color: #dce4ff;
    min-height: 260px;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    border-bottom: 1px solid #2a2a4e;
    background: #111a2d;
  }

  .title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 700;
  }

  .actions {
    display: flex;
    gap: 6px;
  }

  .actions button {
    width: 26px;
    height: 26px;
    border-radius: 6px;
    border: 1px solid #334368;
    background: #1b2742;
    color: #dce4ff;
    cursor: pointer;
  }

  .actions button.danger {
    border-color: #8d2f2f;
    color: #ffb4b4;
    background: #2f1515;
  }

  .panel-body {
    padding: 10px;
    display: grid;
    gap: 10px;
  }

  .controls {
    display: flex;
    gap: 8px;
    font-size: 12px;
  }

  .controls label {
    display: grid;
    gap: 4px;
  }

  select {
    background: #1a1a2e;
    border: 1px solid #344267;
    color: #dce4ff;
    border-radius: 6px;
    padding: 4px 6px;
  }

  .run-meta {
    display: grid;
    gap: 4px;
    font-size: 11px;
    color: #a8b1cf;
  }

  .output {
    margin: 0;
    min-height: 160px;
    max-height: 280px;
    overflow: auto;
    background: #060a12;
    border: 1px solid #273250;
    border-radius: 6px;
    padding: 8px;
    color: #deedff;
    font-size: 11px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .hint {
    margin: 0;
    color: #8a94b8;
    font-size: 12px;
  }

  .error {
    margin: 0;
    color: #ff8d8d;
    font-size: 12px;
  }
</style>
