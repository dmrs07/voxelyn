<script lang="ts">
  import { get } from 'svelte/store';
  import { documentStore, activeLayer, toolStore, type ToolSettings } from '$lib/stores';
  import type { Layer, EditorDocument } from '$lib/document/types';
  import {
    Eye,
    EyeSlash,
    Trash,
    Plus,
    GearSix,
    ArrowUp,
    ArrowDown,
    Lock,
    LockOpen,
    CopySimple,
    ImageSquare,
    Cube
  } from 'phosphor-svelte';
  
  let doc = $state<EditorDocument>(get(documentStore));
  let currentLayer = $state<Layer | null>(null);
  let showLayerSettings = $state(false);
  let showAddMenu = $state(false);
  let draggedLayerId = $state<string | null>(null);
  let editingLayerId = $state<string | null>(null);
  let editingName = $state('');
  let referenceInput: HTMLInputElement | null = null;
  let contextMenu = $state<{ x: number; y: number; layerId: string } | null>(null);
  let thumbnailVersion = $state(0);
  let autoLayerStep = $state(false);
  let autoLayerStepDirection = $state<ToolSettings['autoLayerStepDirection']>('up');
  let autoLayerStepCreate = $state(true);
  
  documentStore.subscribe((d: EditorDocument) => {
    doc = d;
    thumbnailVersion += 1;
  });
  toolStore.settings.subscribe((s: ToolSettings) => {
    autoLayerStep = s.autoLayerStep;
    autoLayerStepDirection = s.autoLayerStepDirection;
    autoLayerStepCreate = s.autoLayerStepCreate;
  });
  activeLayer.subscribe((l: Layer | null) => currentLayer = l);
  
  const selectLayer = (id: string) => {
    documentStore.setActiveLayer(id);
  };
  
  const toggleVisibility = (id: string, e?: MouseEvent | KeyboardEvent) => {
    e?.stopPropagation();
    documentStore.toggleLayerVisibility(id);
  };

  const toggleLock = (id: string, e?: MouseEvent | KeyboardEvent) => {
    e?.stopPropagation();
    documentStore.toggleLayerLock(id);
  };
  
  const addLayer = () => {
    documentStore.addLayer();
    showAddMenu = false;
  };

  const addVoxelLayer = () => {
    documentStore.addVoxelLayer();
    showAddMenu = false;
  };

  const addReferenceLayer = () => {
    referenceInput?.click();
  };

  const handleReferenceSelected = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const name = file.name.replace(/\.[^/.]+$/, '');
    documentStore.addReferenceLayer(url, name);
    input.value = '';
    showAddMenu = false;
  };
  
  const deleteLayer = (id: string, e?: Event) => {
    e?.stopPropagation();
    if (doc.layers.length > 1) {
      documentStore.deleteLayer(id);
    }
  };

  const duplicateLayer = (id: string, e?: Event) => {
    e?.stopPropagation();
    documentStore.duplicateLayer(id);
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

  const setOpacity = (id: string, value: number) => {
    documentStore.setLayerOpacity(id, Math.max(0, Math.min(1, value)));
  };

  const setBlendMode = (id: string, value: 'normal' | 'multiply' | 'screen' | 'overlay') => {
    documentStore.setLayerBlendMode(id, value);
  };

  const toggleAutoLayerStep = () => {
    toolStore.toggleAutoLayerStep();
  };

  const setAutoLayerStepDirection = (direction: ToolSettings['autoLayerStepDirection']) => {
    toolStore.setAutoLayerStepDirection(direction);
  };

  const toggleAutoLayerStepCreate = () => {
    toolStore.toggleAutoLayerStepCreate();
  };

  const startRename = (layer: Layer, e?: Event) => {
    e?.stopPropagation();
    editingLayerId = layer.id;
    editingName = layer.name;
  };

  const commitRename = () => {
    if (!editingLayerId) return;
    const layer = doc.layers.find(l => l.id === editingLayerId);
    const nextName = editingName.trim();
    if (layer && nextName && nextName !== layer.name) {
      documentStore.renameLayer(editingLayerId, nextName);
    }
    editingLayerId = null;
  };

  const cancelRename = () => {
    editingLayerId = null;
  };

  const getSortedLayers = () => [...doc.layers].sort((a, b) => b.zIndex - a.zIndex);

  const getLowerLayerId = (layerId: string) => {
    const ordered = getSortedLayers().map(layer => layer.id);
    const index = ordered.indexOf(layerId);
    return index === -1 ? null : ordered[index + 1] ?? null;
  };

  const mergeDown = (layerId: string) => {
    const lower = getLowerLayerId(layerId);
    if (!lower) return;
    documentStore.mergeLayerDown(layerId, lower);
    contextMenu = null;
  };

  const flattenGridLayers = () => {
    documentStore.flattenGridLayers();
    contextMenu = null;
  };

  const openContextMenu = (layerId: string, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    contextMenu = { x: e.clientX, y: e.clientY, layerId };
  };

  const closeContextMenu = () => {
    contextMenu = null;
  };

  const drawThumbnail = (canvas: HTMLCanvasElement, layer: Layer) => {
    const size = 36;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#151527';
    ctx.fillRect(0, 0, size, size);

    if (layer.type === 'reference') {
      const image = new Image();
      image.src = layer.imageUrl;
      image.onload = () => {
        ctx.drawImage(image, 0, 0, size, size);
      };
      return;
    }

    if (layer.type === 'grid2d') {
      const scaleX = layer.width / size;
      const scaleY = layer.height / size;
      const imageData = ctx.createImageData(size, size);
      const data = imageData.data;

      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const srcX = Math.min(layer.width - 1, Math.floor(x * scaleX));
          const srcY = Math.min(layer.height - 1, Math.floor(y * scaleY));
          const index = srcY * layer.width + srcX;
          const cell = layer.data[index] ?? 0;
          const mat = cell & 0xff;
          const material = doc.palette[mat];
          const color = material?.color ?? 0;
          const offset = (y * size + x) * 4;
          data[offset] = color & 0xff;
          data[offset + 1] = (color >> 8) & 0xff;
          data[offset + 2] = (color >> 16) & 0xff;
          data[offset + 3] = (color >> 24) & 0xff;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      return;
    }

    if (layer.type === 'voxel3d') {
      const sizeX = layer.width;
      const sizeY = layer.height;
      const z = Math.min(layer.depth - 1, Math.floor(layer.depth / 2));
      const scaleX = sizeX / size;
      const scaleY = sizeY / size;
      const imageData = ctx.createImageData(size, size);
      const data = imageData.data;

      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const srcX = Math.min(sizeX - 1, Math.floor(x * scaleX));
          const srcY = Math.min(sizeY - 1, Math.floor(y * scaleY));
          const index = z * sizeX * sizeY + srcY * sizeX + srcX;
          const cell = layer.data[index] ?? 0;
          const mat = cell & 0xff;
          const material = doc.palette[mat];
          const color = material?.color ?? 0;
          const offset = (y * size + x) * 4;
          data[offset] = color & 0xff;
          data[offset + 1] = (color >> 8) & 0xff;
          data[offset + 2] = (color >> 16) & 0xff;
          data[offset + 3] = (color >> 24) & 0xff;
        }
      }

      ctx.putImageData(imageData, 0, 0);
    }
  };

  const layerThumbnail = (node: HTMLCanvasElement, params: { layer: Layer; version: number }) => {
    drawThumbnail(node, params.layer);
    return {
      update(next: { layer: Layer; version: number }) {
        drawThumbnail(node, next.layer);
      },
    };
  };

  const handleDragStart = (id: string, e: DragEvent) => {
    draggedLayerId = id;
    e.dataTransfer?.setData('text/plain', id);
    e.dataTransfer?.setDragImage(e.currentTarget as HTMLElement, 0, 0);
  };

  const handleDrop = (targetId: string) => {
    if (!draggedLayerId || draggedLayerId === targetId) return;
    const ordered = getSortedLayers().map(layer => layer.id);
    const fromIndex = ordered.indexOf(draggedLayerId);
    const toIndex = ordered.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    ordered.splice(fromIndex, 1);
    ordered.splice(toIndex, 0, draggedLayerId);
    documentStore.reorderLayers(ordered);
    draggedLayerId = null;
  };
</script>

<div
  class="layers-panel"
  role="presentation"
  tabindex="-1"
  onclick={closeContextMenu}
  onkeydown={(e) => { if (e.key === 'Escape') closeContextMenu(); }}
>
  <div class="panel-header">
    <span>Layers</span>
    <div class="header-actions">
      <button 
        class="settings-btn" 
        onclick={() => showLayerSettings = !showLayerSettings}
        title="Layer Settings"
        class:active={showLayerSettings}
      ><GearSix size={14} weight="fill" /></button>
      <div class="add-menu">
        <button class="add-btn" onclick={() => showAddMenu = !showAddMenu} title="Add Layer">
          <Plus size={14} weight="bold" />
        </button>
        {#if showAddMenu}
          <div class="add-menu-popover">
            <button onclick={addLayer}><Plus size={14} weight="bold" /> Grid Layer</button>
            <button onclick={addVoxelLayer}><Cube size={14} weight="bold" /> Voxel Layer</button>
            <button onclick={addReferenceLayer}><ImageSquare size={14} weight="bold" /> Reference</button>
          </div>
        {/if}
      </div>
      <input
        bind:this={referenceInput}
        type="file"
        accept="image/*"
        class="reference-input"
        onchange={handleReferenceSelected}
      />
    </div>
  </div>
  
  <div class="layers-list">
    {#each getSortedLayers() as layer}
      <div
        class="layer-wrapper"
        draggable="true"
        role="listitem"
        ondragstart={(e) => handleDragStart(layer.id, e)}
        ondragover={(e) => e.preventDefault()}
        ondrop={() => handleDrop(layer.id)}
      >
        <button 
          class="layer-item"
          class:active={layer.id === doc.activeLayerId}
          class:locked={layer.locked}
          onclick={() => selectLayer(layer.id)}
          oncontextmenu={(e) => openContextMenu(layer.id, e)}
          type="button"
        >
          <canvas
            class="layer-thumb"
            use:layerThumbnail={{ layer, version: thumbnailVersion }}
          ></canvas>
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

          <span
            class="lock-btn"
            class:locked={layer.locked}
            role="button"
            tabindex="0"
            onclick={(e) => toggleLock(layer.id, e)}
            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleLock(layer.id, e); }}
            title={layer.locked ? 'Unlock Layer' : 'Lock Layer'}
          >
            {#if layer.locked}
              <Lock size={14} weight="fill" />
            {:else}
              <LockOpen size={14} weight="fill" />
            {/if}
          </span>
          
          {#if editingLayerId === layer.id}
            <input
              class="layer-name-input"
              value={editingName}
              oninput={(e) => editingName = e.currentTarget.value}
              onblur={commitRename}
              onkeydown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') cancelRename();
              }}
            />
          {:else}
            <span
              class="layer-name"
              role="button"
              tabindex="0"
              ondblclick={(e) => startRename(layer, e)}
              onkeydown={(e) => { if (e.key === 'Enter') startRename(layer, e); }}
            >{layer.name}</span>
          {/if}
          
          <span class="z-badge" title="Z-Index">{layer.zIndex}</span>

          <span
            class="duplicate-btn"
            role="button"
            tabindex="0"
            onclick={(e) => duplicateLayer(layer.id, e)}
            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') duplicateLayer(layer.id, e); }}
            title="Duplicate Layer"
          >
            <CopySimple size={14} weight="fill" />
          </span>
          
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
              <span>Opacity:</span>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(layer.opacity * 100)}
                oninput={(e) => setOpacity(layer.id, parseInt(e.currentTarget.value) / 100)}
              />
              <span class="opacity-value">{Math.round(layer.opacity * 100)}%</span>
            </label>
            <label>
              <span>Blend:</span>
              <select
                value={layer.blendMode ?? 'normal'}
                onchange={(e) => setBlendMode(layer.id, e.currentTarget.value as 'normal' | 'multiply' | 'screen' | 'overlay')}
              >
                <option value="normal">Normal</option>
                <option value="multiply">Multiply</option>
                <option value="screen">Screen</option>
                <option value="overlay">Overlay</option>
              </select>
            </label>
            <label class="assist-toggle">
              <span>Auto-step:</span>
              <input
                type="checkbox"
                checked={autoLayerStep}
                onchange={toggleAutoLayerStep}
              />
            </label>
            {#if autoLayerStep}
              <label>
                <span>Direction:</span>
                <select
                  value={autoLayerStepDirection}
                  onchange={(e) => setAutoLayerStepDirection(e.currentTarget.value as 'up' | 'down')}
                >
                  <option value="up">Up</option>
                  <option value="down">Down</option>
                </select>
              </label>
              <label class="assist-toggle">
                <span>Create:</span>
                <input
                  type="checkbox"
                  checked={autoLayerStepCreate}
                  onchange={toggleAutoLayerStepCreate}
                />
              </label>
            {/if}
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

  {#if contextMenu}
    {@const menu = contextMenu}
    <div
      class="context-menu"
      style={`left: ${menu.x}px; top: ${menu.y}px;`}
    >
      {#if doc.layers.length > 1}
        <button onclick={() => mergeDown(menu.layerId)}>Merge Down</button>
        <button onclick={flattenGridLayers}>Flatten Grid Layers</button>
      {/if}
      <button onclick={() => duplicateLayer(menu.layerId)}>Duplicate</button>
      <button onclick={() => startRename(doc.layers.find(l => l.id === menu.layerId)!)}>Rename</button>
      <button onclick={() => toggleVisibility(menu.layerId)}>Toggle Visibility</button>
      <button onclick={() => toggleLock(menu.layerId)}>Toggle Lock</button>
      <button onclick={() => deleteLayer(menu.layerId)} class:danger={doc.layers.length <= 1}>Delete</button>
    </div>
  {/if}
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
    position: relative;
  }

  .add-menu {
    position: relative;
  }

  .add-menu-popover {
    position: absolute;
    top: 28px;
    right: 0;
    background: #1a1a2e;
    border: 1px solid #3a3a5e;
    border-radius: 6px;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    z-index: 10;
    min-width: 160px;
  }

  .add-menu-popover button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border: none;
    border-radius: 4px;
    background: #252538;
    color: #ddd;
    cursor: pointer;
    font-size: 12px;
    text-align: left;
  }

  .add-menu-popover button:hover {
    background: #3a3a6e;
  }

  .reference-input {
    display: none;
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

  .layer-thumb {
    width: 36px;
    height: 36px;
    border-radius: 4px;
    border: 1px solid #2a2a4e;
    background: #151527;
    flex-shrink: 0;
  }
  
  .layer-item:hover {
    background: #2a2a4e;
  }
  
  .layer-item.active {
    background: #3a3a6e;
    box-shadow: 0 0 0 1px #5a5a9e;
  }

  .layer-item.locked {
    opacity: 0.8;
  }
  
  .visibility-btn,
  .lock-btn,
  .duplicate-btn,
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

  .lock-btn.locked {
    color: #e0b463;
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

  .layer-name-input {
    flex: 1;
    font-size: 13px;
    color: #ddd;
    border-radius: 4px;
    border: 1px solid #3a3a5e;
    background: #252538;
    padding: 4px 6px;
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

  .layer-settings input[type="range"] {
    flex: 1;
  }

  .layer-settings select {
    padding: 4px;
    border-radius: 4px;
    border: 1px solid #3a3a5e;
    background: #252538;
    color: #ddd;
    font-size: 11px;
  }

  .assist-toggle {
    align-items: center;
  }

  .assist-toggle input {
    accent-color: #6a6aae;
  }

  .opacity-value {
    width: 32px;
    text-align: right;
  }

  .context-menu {
    position: fixed;
    background: #1a1a2e;
    border: 1px solid #3a3a5e;
    border-radius: 6px;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    z-index: 100;
    min-width: 160px;
  }

  .context-menu button {
    border: none;
    border-radius: 4px;
    background: #252538;
    color: #ddd;
    padding: 6px 8px;
    text-align: left;
    cursor: pointer;
    font-size: 12px;
  }

  .context-menu button:hover {
    background: #3a3a6e;
  }

  .context-menu button.danger {
    color: #f2a3a3;
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
