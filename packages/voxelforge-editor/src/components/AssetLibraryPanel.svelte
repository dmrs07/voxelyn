<script lang="ts">
  import { onMount } from 'svelte';
  import { Archive, ArrowsClockwise, DownloadSimple } from 'phosphor-svelte';
  import {
    decodePpm,
    parseViewSettings,
    validateViewSettingsForManifest,
    type BundleViewSettings,
  } from '@voxelyn/core';

  type BundleListEntry = {
    id: string;
    type: string;
    prompt?: string;
    mode?: string;
  };

  type BundleManifest = {
    version: number;
    type: string;
    mode?: string;
    prompt?: string;
    provider?: string;
    model?: string;
    files?: string[];
  };

  type ObjectQualitySummary = {
    qualityProfile?: string;
    qualityTarget?: number;
    selectedModel?: string;
    selectedTemperature?: number;
    selectedAttempt?: number;
    attempts?: unknown[];
  };

  interface Props {
    onObjectImported?: (data: Uint16Array, width: number, height: number, depth: number, meta?: unknown) => void;
    onScenarioImported?: (terrain: Uint16Array, width: number, height: number, depth: number, meta?: unknown) => void;
    onTextureImported?: (pixels: Uint32Array, width: number, height: number, meta?: unknown) => void;
    onApplyViewSettings?: (view: BundleViewSettings) => void;
  }

  let {
    onObjectImported = () => {},
    onScenarioImported = () => {},
    onTextureImported = () => {},
    onApplyViewSettings = () => {},
  }: Props = $props();

  let bundles = $state<BundleListEntry[]>([]);
  let selectedId = $state<string>('');
  let selectedManifest = $state<BundleManifest | null>(null);
  let selectedQuality = $state<ObjectQualitySummary | null>(null);
  let selectedViewSettings = $state<BundleViewSettings | null>(null);
  let isLoading = $state(false);
  let isImporting = $state(false);
  let error = $state<string | null>(null);

  const bundlePath = (id: string, file: string) => `/assets/generated/${id}/${file}`;

  async function readJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as T;
  }

  async function readBinary(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
    }
    return await response.arrayBuffer();
  }

  async function loadBundleList() {
    isLoading = true;
    error = null;

    try {
      const response = await fetch('/api/bundles');
      if (!response.ok) {
        throw new Error(`Failed to fetch /api/bundles: ${response.status}`);
      }
      const list = (await response.json()) as BundleListEntry[];
      bundles = list;
      if (!selectedId && list.length > 0) {
        selectedId = list[0]?.id ?? '';
        await loadSelectedBundle();
      }
    } catch (e) {
      bundles = [];
      error = e instanceof Error ? e.message : String(e);
    } finally {
      isLoading = false;
    }
  }

  async function loadSelectedBundle() {
    if (!selectedId) {
      selectedManifest = null;
      selectedQuality = null;
      return;
    }

    try {
      selectedManifest = await readJson<BundleManifest>(bundlePath(selectedId, 'manifest.json'));
      selectedQuality = null;
      selectedViewSettings = null;

      if (selectedManifest.type === 'object') {
        try {
          selectedQuality = await readJson<ObjectQualitySummary>(bundlePath(selectedId, 'object.quality.json'));
        } catch {
          selectedQuality = null;
        }
      }

      if (selectedManifest.files?.includes('view.settings.json')) {
        try {
          const viewRaw = await readJson<unknown>(bundlePath(selectedId, 'view.settings.json'));
          const parsed = parseViewSettings(viewRaw);
          validateViewSettingsForManifest(parsed, selectedManifest.type);
          selectedViewSettings = parsed;
        } catch {
          selectedViewSettings = null;
        }
      }
    } catch (e) {
      selectedManifest = null;
      selectedQuality = null;
      selectedViewSettings = null;
      error = e instanceof Error ? e.message : String(e);
    }
  }

  async function importSelectedBundle() {
    if (!selectedId || !selectedManifest) return;

    isImporting = true;
    error = null;

    try {
      if (selectedManifest.type === 'object') {
        const [meta, voxelsBuffer] = await Promise.all([
          readJson<{ width: number; height: number; depth: number }>(bundlePath(selectedId, 'object.meta.json')),
          readBinary(bundlePath(selectedId, 'object.voxels.u16')),
        ]);

        onObjectImported(
          new Uint16Array(voxelsBuffer),
          meta.width,
          meta.height,
          meta.depth,
          { id: selectedId, manifest: selectedManifest, quality: selectedQuality, viewSettings: selectedViewSettings },
        );
      } else if (selectedManifest.type === 'scenario') {
        const [scale, terrainBuffer] = await Promise.all([
          readJson<{ width: number; height: number; depth: number }>(bundlePath(selectedId, 'scenario.scale.json')),
          readBinary(bundlePath(selectedId, 'scenario.terrain.u16')),
        ]);

        onScenarioImported(
          new Uint16Array(terrainBuffer),
          scale.width,
          scale.height,
          scale.depth,
          { id: selectedId, manifest: selectedManifest, viewSettings: selectedViewSettings },
        );
      } else if (selectedManifest.type === 'texture') {
        const ppmBuffer = await readBinary(bundlePath(selectedId, 'texture.ppm'));
        const decoded = decodePpm(ppmBuffer);
        onTextureImported(decoded.pixels, decoded.width, decoded.height, {
          id: selectedId,
          manifest: selectedManifest,
          viewSettings: selectedViewSettings,
        });
      }

      if (selectedViewSettings) {
        onApplyViewSettings(selectedViewSettings);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      isImporting = false;
    }
  }

  function formatEntry(entry: BundleListEntry): string {
    const prompt = entry.prompt?.trim() || entry.id;
    const mode = entry.mode ? ` [${entry.mode}]` : '';
    return `${entry.type}: ${prompt}${mode}`;
  }

  onMount(() => {
    loadBundleList();
  });
</script>

<div class="asset-panel">
  <header class="panel-header">
    <Archive size={16} weight="fill" />
    <span>Asset Library</span>
    <button class="icon-btn" onclick={loadBundleList} title="Refresh bundles">
      <ArrowsClockwise size={14} />
    </button>
  </header>

  <section class="panel-body">
    {#if isLoading}
      <p class="status">Loading bundles...</p>
    {:else if bundles.length === 0}
      <p class="status">No bundles found at <code>/api/bundles</code>.</p>
    {:else}
      <label>
        Bundle
        <select bind:value={selectedId} onchange={loadSelectedBundle}>
          {#each bundles as entry}
            <option value={entry.id}>{formatEntry(entry)}</option>
          {/each}
        </select>
      </label>

      {#if selectedManifest}
        <div class="manifest-summary">
          <div><strong>Type:</strong> {selectedManifest.type}</div>
          <div><strong>Mode:</strong> {selectedManifest.mode ?? 'unknown'}</div>
          <div><strong>Provider:</strong> {selectedManifest.provider ?? 'unknown'}</div>
          <div><strong>Model:</strong> {selectedManifest.model ?? 'unknown'}</div>
        </div>

        {#if selectedManifest.type === 'object' && selectedQuality}
          <div class="quality-summary">
            <h4>Quality</h4>
            <div><strong>Profile:</strong> {selectedQuality.qualityProfile ?? 'n/a'}</div>
            <div><strong>Target:</strong> {selectedQuality.qualityTarget ?? 'n/a'}</div>
            <div><strong>Model:</strong> {selectedQuality.selectedModel ?? 'n/a'}</div>
            <div><strong>Temp:</strong> {selectedQuality.selectedTemperature ?? 'n/a'}</div>
            <div><strong>Attempt:</strong> {selectedQuality.selectedAttempt ?? 'n/a'}</div>
          </div>
        {/if}

        <button class="import-btn" onclick={importSelectedBundle} disabled={isImporting}>
          <DownloadSimple size={14} />
          {isImporting ? 'Importing...' : 'Import Selected Bundle'}
        </button>

        {#if selectedViewSettings}
          <button
            class="import-btn secondary"
            type="button"
            onclick={() => onApplyViewSettings(selectedViewSettings!)}
          >
            Reset to Auto View
          </button>
        {/if}
      {/if}
    {/if}

    {#if error}
      <p class="error">{error}</p>
    {/if}
  </section>
</div>

<style>
  .asset-panel {
    display: flex;
    flex-direction: column;
    border: 1px solid #2a2a4e;
    border-radius: 8px;
    background: #101827;
    color: #dce4ff;
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: #0b1220;
    border-bottom: 1px solid #2a2a4e;
    font-size: 13px;
    font-weight: 700;
  }

  .panel-body {
    display: grid;
    gap: 10px;
    padding: 12px;
    font-size: 12px;
  }

  .icon-btn {
    margin-left: auto;
    border: 1px solid #2a2a4e;
    background: #17203a;
    color: #dce4ff;
    border-radius: 6px;
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    cursor: pointer;
  }

  label {
    display: grid;
    gap: 6px;
    font-weight: 600;
  }

  select {
    background: #0e1628;
    color: #dce4ff;
    border: 1px solid #2a2a4e;
    border-radius: 6px;
    padding: 6px 8px;
    font-size: 12px;
  }

  .manifest-summary,
  .quality-summary {
    display: grid;
    gap: 4px;
    background: #0e1628;
    border: 1px solid #2a2a4e;
    border-radius: 6px;
    padding: 8px;
  }

  .quality-summary h4 {
    margin: 0 0 4px;
    font-size: 12px;
    color: #93a0ff;
  }

  .import-btn {
    border: 1px solid #3765ff;
    background: #1a3fbc;
    color: #fff;
    border-radius: 6px;
    padding: 8px 10px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    justify-content: center;
  }

  .import-btn.secondary {
    background: #1b263f;
    border-color: #4a5b86;
  }

  .import-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .status {
    margin: 0;
    color: #9fb0d8;
  }

  .error {
    margin: 0;
    color: #ff8f8f;
  }

  code {
    color: #cdd6ff;
  }
</style>
