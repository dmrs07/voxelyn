<script lang="ts">
  import { onMount } from 'svelte';
  import { projectStore, worldStore } from '$lib/stores';
  import type { ProjectEntry } from '$lib/project/types';
  import type { ProjectStoreState } from '$lib/project/store';
  import type { WorldStoreState } from '$lib/world/store';
  import { FolderOpen, ArrowsClockwise, FloppyDisk, Play, Stop, User, Wrench, Hammer } from 'phosphor-svelte';

  let project = $state<ProjectStoreState>({
    projectRoot: null,
    projectMeta: null,
    assetsIndex: [],
    scenesIndex: [],
    aiOutputsIndex: [],
    loading: false,
    error: null,
    available: false,
  });

  let world = $state<WorldStoreState>({
    world: {
      worldVersion: 1,
      viewMode: '3d',
      items: [],
      hero: { spawn: [0, 0, 0], collision: 'aabb' },
      composer: { snapEnabled: true, snapSize: 1, snapFromMeta: true, rotationStepDeg: 15, space: 'world' },
    },
    selectedItemId: null,
    composerMode: false,
    testMode: false,
    heroPosition: [0, 0, 0],
    heroSpawnPlacementMode: false,
    loading: false,
    dirty: false,
    message: null,
    error: null,
  });

  onMount(() => {
    projectStore.initialize();
    const unsubProject = projectStore.subscribe((value) => {
      project = value;
    });
    const unsubWorld = worldStore.subscribe((value) => {
      world = value;
    });
    return () => {
      unsubProject();
      unsubWorld();
    };
  });

  const openProject = async () => {
    const opened = await projectStore.openProjectFolder();
    if (opened) {
      await worldStore.loadFromProject();
    }
  };

  const refreshProject = async () => {
    await projectStore.refresh();
    await worldStore.loadFromProject();
  };

  const startEntryDrag = (event: DragEvent, item: ProjectEntry, type: 'scene' | 'asset') => {
    if (!event.dataTransfer) return;
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(
      'application/x-voxelyn-project-item',
      JSON.stringify({
        type,
        sourceRef: item.path,
        meta: item.meta ?? {},
      }),
    );
  };

  const addEntryToWorld = (item: ProjectEntry, type: 'scene' | 'asset') => {
    worldStore.addItem({
      type,
      sourceRef: item.path,
      position: [0, 0, 0],
      meta: item.meta ?? {},
    });
  };

  const selectedItem = () => world.world.items.find((item) => item.id === world.selectedItemId) ?? null;

  const parseNumber = (value: string, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const updateSelectedPosition = (axis: 0 | 1 | 2, value: string) => {
    const item = selectedItem();
    if (!item) return;
    const next = [...item.transform.position] as [number, number, number];
    next[axis] = parseNumber(value, next[axis]);
    worldStore.updateSelectedTransform({ position: next });
  };

  const updateSelectedRotation = (axis: 0 | 1 | 2, value: string) => {
    const item = selectedItem();
    if (!item) return;
    const next = [...item.transform.rotation] as [number, number, number];
    next[axis] = parseNumber(value, next[axis]);
    worldStore.updateSelectedTransform({ rotation: next });
  };

  const updateSelectedScale = (axis: 0 | 1 | 2, value: string) => {
    const item = selectedItem();
    if (!item) return;
    const next = [...item.transform.scale] as [number, number, number];
    next[axis] = Math.max(0.1, parseNumber(value, next[axis]));
    worldStore.updateSelectedTransform({ scale: next });
  };
</script>

<div class="project-panel">
  <header class="panel-header">
    <span>Project</span>
    <div class="header-actions">
      <button type="button" onclick={openProject} title="Open Project Folder">
        <FolderOpen size={14} />
      </button>
      <button type="button" onclick={refreshProject} title="Refresh Project">
        <ArrowsClockwise size={14} />
      </button>
    </div>
  </header>

  <section class="panel-body">
    {#if !project.available}
      <p class="status">Project filesystem is available only in Electron.</p>
    {:else}
      <div class="project-meta">
        <div><strong>Name:</strong> {project.projectMeta?.name ?? '—'}</div>
        <div><strong>Root:</strong> {project.projectRoot ?? '—'}</div>
      </div>
    {/if}

    {#if project.error}
      <p class="error">{project.error}</p>
    {/if}

    <div class="lists">
      <div class="list-block">
        <h4>Scenes/Cenarios</h4>
        {#if project.scenesIndex.length === 0}
          <p class="status">No scenes found.</p>
        {:else}
          {#each project.scenesIndex as item}
            <div
              class="entry-row"
              role="button"
              tabindex="0"
              draggable="true"
              ondragstart={(event) => startEntryDrag(event, item, 'scene')}
            >
              <button type="button" onclick={() => addEntryToWorld(item, 'scene')}>{item.name}</button>
              <code>{item.path}</code>
            </div>
          {/each}
        {/if}
      </div>

      <div class="list-block">
        <h4>Assets</h4>
        {#if project.assetsIndex.length === 0}
          <p class="status">No assets found.</p>
        {:else}
          {#each project.assetsIndex as item}
            <div
              class="entry-row"
              role="button"
              tabindex="0"
              draggable="true"
              ondragstart={(event) => startEntryDrag(event, item, 'asset')}
            >
              <button type="button" onclick={() => addEntryToWorld(item, 'asset')}>{item.name}</button>
              <code>{item.path}</code>
            </div>
          {/each}
        {/if}
      </div>
    </div>

    <div class="composer-block">
      <h4>World Composer</h4>
      <div class="grid-controls">
        <label><input type="checkbox" checked={world.composerMode} onchange={(e) => worldStore.setComposerMode(e.currentTarget.checked)} /> Composer mode</label>
        <label><input type="checkbox" checked={world.world.composer.snapEnabled} onchange={(e) => worldStore.setComposerOption({ snapEnabled: e.currentTarget.checked })} /> Snap</label>
        <label>Step <input type="number" min="0.01" step="0.25" value={world.world.composer.snapSize} oninput={(e) => worldStore.setComposerOption({ snapSize: parseNumber(e.currentTarget.value, 1) })} /></label>
        <label>Rot <input type="number" min="1" step="1" value={world.world.composer.rotationStepDeg} oninput={(e) => worldStore.setComposerOption({ rotationStepDeg: parseNumber(e.currentTarget.value, 15) })} /></label>
      </div>

      <div class="composer-actions">
        <button type="button" onclick={() => worldStore.undo()}>Undo World</button>
        <button type="button" onclick={() => worldStore.redo()}>Redo World</button>
        <button type="button" onclick={() => worldStore.saveWorld()}>
          <FloppyDisk size={12} />
          Save World
        </button>
        <button type="button" onclick={() => worldStore.generateMap()}>
          <Hammer size={12} />
          Generate Map
        </button>
      </div>

      <div class="hero-row">
        <button type="button" onclick={() => worldStore.setSelectedAsHero()}>
          <User size={12} />
          Mark Hero
        </button>
        <button type="button" onclick={() => worldStore.setHeroSpawnPlacementMode(!world.heroSpawnPlacementMode)}>
          <Wrench size={12} />
          {world.heroSpawnPlacementMode ? 'Cancel Spawn' : 'Set Spawn (Click Viewport)'}
        </button>
        <button type="button" onclick={() => worldStore.toggleTestMode(!world.testMode)}>
          {#if world.testMode}<Stop size={12} /> Stop{:else}<Play size={12} /> Play/Test{/if}
        </button>
      </div>
    </div>

    <div class="items-block">
      <h4>World Items ({world.world.items.length})</h4>
      {#if world.world.items.length === 0}
        <p class="status">Drag assets/scenes here or into viewport.</p>
      {:else}
        {#each world.world.items as item}
          <div class="world-item" class:selected={item.id === world.selectedItemId}>
            <button type="button" onclick={() => worldStore.setSelectedItem(item.id)}>
              {item.type}: {item.id}
            </button>
            <code>{item.sourceRef}</code>
          </div>
        {/each}
      {/if}
    </div>

    {#if selectedItem()}
      {@const item = selectedItem()}
      <div class="transform-block">
        <h4>Transform</h4>
        <div class="axis-grid">
          <label>Pos X <input type="number" step="0.1" value={item.transform.position[0]} oninput={(e) => updateSelectedPosition(0, e.currentTarget.value)} /></label>
          <label>Pos Y <input type="number" step="0.1" value={item.transform.position[1]} oninput={(e) => updateSelectedPosition(1, e.currentTarget.value)} /></label>
          <label>Pos Z <input type="number" step="0.1" value={item.transform.position[2]} oninput={(e) => updateSelectedPosition(2, e.currentTarget.value)} /></label>
          <label>Rot X <input type="number" step="1" value={item.transform.rotation[0]} oninput={(e) => updateSelectedRotation(0, e.currentTarget.value)} /></label>
          <label>Rot Y <input type="number" step="1" value={item.transform.rotation[1]} oninput={(e) => updateSelectedRotation(1, e.currentTarget.value)} /></label>
          <label>Rot Z <input type="number" step="1" value={item.transform.rotation[2]} oninput={(e) => updateSelectedRotation(2, e.currentTarget.value)} /></label>
          <label>Scl X <input type="number" step="0.1" value={item.transform.scale[0]} oninput={(e) => updateSelectedScale(0, e.currentTarget.value)} /></label>
          <label>Scl Y <input type="number" step="0.1" value={item.transform.scale[1]} oninput={(e) => updateSelectedScale(1, e.currentTarget.value)} /></label>
          <label>Scl Z <input type="number" step="0.1" value={item.transform.scale[2]} oninput={(e) => updateSelectedScale(2, e.currentTarget.value)} /></label>
        </div>
        <div class="transform-actions">
          <button type="button" onclick={() => worldStore.rotateSelectedBy([0, world.world.composer.rotationStepDeg, 0])}>Rotate +Y</button>
          <button type="button" onclick={() => worldStore.rotateSelectedBy([0, -world.world.composer.rotationStepDeg, 0])}>Rotate -Y</button>
          <button type="button" onclick={() => worldStore.removeSelected()}>Remove Item</button>
        </div>
      </div>
    {/if}

    {#if world.message}
      <p class="status">{world.message}</p>
    {/if}
    {#if world.error}
      <p class="error">{world.error}</p>
    {/if}
  </section>
</div>

<style>
  .project-panel {
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
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: 1px solid #2a2a4e;
    background: #0b1220;
    font-size: 13px;
    font-weight: 700;
  }

  .header-actions {
    display: flex;
    gap: 6px;
  }

  .header-actions button {
    width: 26px;
    height: 26px;
    border: 1px solid #2a2a4e;
    background: #17203a;
    color: #dce4ff;
    border-radius: 6px;
    cursor: pointer;
  }

  .panel-body {
    display: grid;
    gap: 10px;
    padding: 12px;
    font-size: 12px;
  }

  .project-meta {
    display: grid;
    gap: 4px;
  }

  .lists {
    display: grid;
    gap: 10px;
  }

  .list-block h4,
  .composer-block h4,
  .items-block h4,
  .transform-block h4 {
    margin: 0 0 6px 0;
    font-size: 12px;
    color: #a9b4d0;
  }

  .entry-row,
  .world-item {
    display: grid;
    gap: 2px;
    margin-bottom: 5px;
    padding: 6px;
    border: 1px solid #2a2a4e;
    border-radius: 6px;
    background: #121b31;
  }

  .world-item.selected {
    border-color: #3b82f6;
  }

  .entry-row button,
  .world-item button {
    border: none;
    background: transparent;
    color: #e6ecff;
    text-align: left;
    cursor: pointer;
    padding: 0;
  }

  .entry-row code,
  .world-item code {
    color: #8c98b9;
    font-size: 11px;
    word-break: break-all;
  }

  .grid-controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .grid-controls label {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  input[type='number'] {
    width: 70px;
    background: #0e1628;
    color: #dce4ff;
    border: 1px solid #2a2a4e;
    border-radius: 4px;
    padding: 2px 4px;
  }

  .composer-actions,
  .hero-row,
  .transform-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
  }

  .composer-actions button,
  .hero-row button,
  .transform-actions button {
    border: 1px solid #2a2a4e;
    background: #17203a;
    color: #dce4ff;
    border-radius: 6px;
    padding: 6px 8px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    font-size: 11px;
  }

  .axis-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  .axis-grid label {
    display: grid;
    gap: 2px;
  }

  .status {
    margin: 0;
    color: #9fb0db;
  }

  .error {
    margin: 0;
    color: #fca5a5;
  }
</style>
