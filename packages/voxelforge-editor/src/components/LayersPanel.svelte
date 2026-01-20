<script lang="ts">
  import { get } from 'svelte/store';
  import { documentStore, activeLayer } from '$lib/stores';
  import type { Layer, EditorDocument } from '$lib/document/types';
  import {
    Eye,
    EyeSlash,
    Trash,
    Plus,
    GearSix,
    ArrowUp,
    ArrowDown
  } from 'phosphor-svelte';
  
  let doc = $state<EditorDocument>(get(documentStore));
  let currentLayer = $state<Layer | null>(null);
  let showLayerSettings = $state(false);
  
  documentStore.subscribe((d: EditorDocument) => doc = d);
  activeLayer.subscribe((l: Layer | null) => currentLayer = l);
  
  const selectLayer = (id: string) => {
    documentStore.setActiveLayer(id);
  };
  
  const toggleVisibility = (id: string, e: MouseEvent | KeyboardEvent) => {
    e.stopPropagation();
    documentStore.toggleLayerVisibility(id);
  };
  
  const addLayer = () => {
    documentStore.addLayer();
  };
  
  const deleteLayer = (id: string, e: Event) => {
    e.stopPropagation();
    if (doc.layers.length > 1) {
      documentStore.deleteLayer(id);
    }
  };
  
  const changeZIndex = (id: string, delta: number, e: Event) => {
    e.stopPropagation();
    const layer = doc.layers.find((l: Layer) => l.id === id);
    if (layer) {
      documentStore.setLayerZIndex(id, layer.zIndex + delta);
    }
  };
  
  const setZIndex = (id: string, value: number) => {
    documentStore.setLayerZIndex(id, value);
  };
  
  const setIsoHeight = (id: string, value: number) => {
    documentStore.setLayerIsoHeight(id, value);
  };
</script>

<div class="layers-panel">
  <div class="panel-header">
    <span>Layers</span>
    <div class="header-actions">
      <button 
        class="settings-btn" 
        onclick={() => showLayerSettings = !showLayerSettings}
        title="Layer Settings"
        class:active={showLayerSettings}
      ><GearSix size={14} weight="fill" /></button>
      <button class="add-btn" onclick={addLayer} title="Add Layer"><Plus size={14} weight="bold" /></button>
    </div>
  </div>
  
  <div class="layers-list">
    {#each [...doc.layers].sort((a, b) => b.zIndex - a.zIndex) as layer}
      <div class="layer-wrapper">
        <button 
          class="layer-item"
          class:active={layer.id === doc.activeLayerId}
          onclick={() => selectLayer(layer.id)}
          type="button"
        >
          <span 
            class="visibility-btn"
            class:hidden={!layer.visible}
            role="button"
            tabindex="0"
            onclick={(e) => toggleVisibility(layer.id, e)}
            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleVisibility(layer.id, e); }}
          >
            {#if layer.visible}
              <Eye size={14} weight="fill" />
            {:else}
              <EyeSlash size={14} weight="fill" />
            {/if}
          </span>
          
          <span class="layer-name">{layer.name}</span>
          
          <span class="z-badge" title="Z-Index">{layer.zIndex}</span>
          
          <span 
            class="delete-btn"
            role="button"
            tabindex="0"
            onclick={(e) => deleteLayer(layer.id, e)}
            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') deleteLayer(layer.id, e); }}
            class:disabled={doc.layers.length <= 1}
            title="Delete Layer"
          >
            <Trash size={14} weight="fill" />
          </span>
        </button>
        
        {#if showLayerSettings && layer.id === doc.activeLayerId}
          <div class="layer-settings">
            <label>
              <span>Z-Index:</span>
              <div class="z-controls">
                <button onclick={(e) => changeZIndex(layer.id, -1, e)}><ArrowDown size={12} weight="bold" /></button>
                <input 
                  type="number" 
                  value={layer.zIndex}
                  onchange={(e) => setZIndex(layer.id, parseInt(e.currentTarget.value) || 0)}
                />
                <button onclick={(e) => changeZIndex(layer.id, 1, e)}><ArrowUp size={12} weight="bold" /></button>
              </div>
            </label>
            <label>
              <span>Iso Height:</span>
              <input 
                type="number" 
                value={layer.isoHeight}
                onchange={(e) => setIsoHeight(layer.id, parseInt(e.currentTarget.value) || 0)}
              />
            </label>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .layers-panel {
    background: #252538;
    border-radius: 8px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 150px;
  }
  
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: #888;
    letter-spacing: 0.5px;
  }
  
  .header-actions {
    display: flex;
    gap: 4px;
  }
  
  .add-btn, .settings-btn {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: #4a4a8e;
    color: #fff;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .settings-btn {
    background: #3a3a5e;
    font-size: 12px;
  }
  
  .settings-btn.active {
    background: #5a5a9e;
  }
  
  .add-btn:hover, .settings-btn:hover {
    background: #5a5a9e;
  }
  
  .layers-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    overflow-y: auto;
  }
  
  .layer-wrapper {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .layer-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border-radius: 6px;
    background: #1a1a2e;
    cursor: pointer;
    transition: all 0.15s;
    border: none;
    color: inherit;
    font-family: inherit;
    text-align: left;
    width: 100%;
  }
  
  .layer-item:hover {
    background: #2a2a4e;
  }
  
  .layer-item.active {
    background: #3a3a6e;
    box-shadow: 0 0 0 1px #5a5a9e;
  }
  
  .visibility-btn,
  .delete-btn {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
    font-size: 12px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .visibility-btn.hidden {
    opacity: 0.4;
  }
  
  .delete-btn.disabled {
    opacity: 0.2;
    cursor: not-allowed;
    pointer-events: none;
  }
  
  .layer-name {
    flex: 1;
    font-size: 13px;
    color: #ddd;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .z-badge {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 3px;
    background: #2a2a4e;
    color: #aaa;
    font-family: monospace;
  }
  
  .layer-settings {
    background: #1a1a2e;
    border-radius: 6px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-left: 32px;
    border: 1px solid #3a3a5e;
  }
  
  .layer-settings label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 11px;
    color: #888;
  }
  
  .layer-settings input {
    width: 60px;
    padding: 4px;
    border-radius: 4px;
    border: 1px solid #3a3a5e;
    background: #252538;
    color: #ddd;
    font-size: 11px;
    text-align: center;
  }
  
  .z-controls {
    display: flex;
    gap: 2px;
  }
  
  .z-controls button {
    width: 20px;
    height: 22px;
    border: none;
    border-radius: 3px;
    background: #3a3a5e;
    color: #ddd;
    cursor: pointer;
    font-size: 12px;
  }
  
  .z-controls button:hover {
    background: #4a4a7e;
  }
  
  .z-controls input {
    width: 40px;
  }
</style>
