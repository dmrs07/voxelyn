<script lang="ts">
  import { get } from 'svelte/store';
  import { documentStore, uiStore, type HistoryInfo } from '$lib/stores';
  import type { EditorDocument } from '$lib/document/types';
  import {
    Folder,
    FilePlus,
    FolderOpen,
    FloppyDisk,
    FileImage,
    ArrowCounterClockwise,
    ArrowClockwise,
    MagnifyingGlassMinus,
    MagnifyingGlassPlus,
    GridFour
  } from 'phosphor-svelte';
  
  let doc = $state<EditorDocument>(get(documentStore));
  let cursorPos = $state<{ x: number; y: number } | null>(null);
  let canUndo = $state(false);
  let canRedo = $state(false);
  let showFileMenu = $state(false);
  let showGrid = $state(true);
  let gridStep = $state(1);
  
  documentStore.subscribe((d: EditorDocument) => doc = d);
  documentStore.history.subscribe((h: HistoryInfo) => {
    canUndo = h.canUndo;
    canRedo = h.canRedo;
  });
  uiStore.cursorPosition.subscribe(p => cursorPos = p);
  uiStore.showGrid.subscribe(v => showGrid = v);
  uiStore.gridStep.subscribe(v => gridStep = v);
  
  const zoomLevels = [12.5, 25, 50, 100, 200, 400, 800];
  
  const zoomIn = () => {
    const currentIdx = zoomLevels.findIndex(z => z >= doc.camera.zoom * 100);
    const nextIdx = Math.min(zoomLevels.length - 1, currentIdx + 1);
    documentStore.setCamera({ zoom: zoomLevels[nextIdx] / 100 });
  };
  
  const zoomOut = () => {
    const currentIdx = zoomLevels.findIndex(z => z >= doc.camera.zoom * 100);
    const prevIdx = Math.max(0, currentIdx - 1);
    documentStore.setCamera({ zoom: zoomLevels[prevIdx] / 100 });
  };
  
  const setViewMode = (mode: typeof doc.viewMode) => {
    documentStore.setViewMode(mode);
  };

  const gridSteps = [1, 2, 4, 8, 16];
  const cycleGridStep = () => {
    const idx = gridSteps.indexOf(gridStep);
    const next = gridSteps[(idx + 1) % gridSteps.length];
    uiStore.gridStep.set(next);
  };
  
  const handleNew = () => {
    showFileMenu = false;
    documentStore.newDocument(128, 128, 32, 'Untitled');
  };
  
  const handleSave = () => {
    showFileMenu = false;
    documentStore.saveToFile();
  };
  
  const handleLoad = async () => {
    showFileMenu = false;
    await documentStore.loadFromFile();
  };
  
  const handleExport = () => {
    showFileMenu = false;
    documentStore.exportLayerPNG();
  };
</script>

<div class="status-bar">
  <div class="left">
    <div class="file-menu-container">
      <button 
        class="file-btn"
        onclick={() => showFileMenu = !showFileMenu}
      ><Folder size={14} weight="fill" /> File</button>
      {#if showFileMenu}
        <div class="file-menu">
          <button onclick={handleNew}><FilePlus size={14} weight="fill" /> New</button>
          <button onclick={handleLoad}><FolderOpen size={14} weight="fill" /> Open...</button>
          <button onclick={handleSave}><FloppyDisk size={14} weight="fill" /> Save</button>
          <div class="menu-divider"></div>
          <button onclick={handleExport}><FileImage size={14} weight="fill" /> Export PNG</button>
        </div>
      {/if}
    </div>
    
    <span class="divider"></span>
    
    <button 
      class="undo-btn"
      onclick={() => documentStore.undo()}
      disabled={!canUndo}
      title="Undo (Ctrl+Z)"
    ><ArrowCounterClockwise size={14} weight="bold" /></button>
    <button 
      class="redo-btn"
      onclick={() => documentStore.redo()}
      disabled={!canRedo}
      title="Redo (Ctrl+Y)"
    ><ArrowClockwise size={14} weight="bold" /></button>
    
    <span class="divider"></span>
    
    <span class="doc-name">{doc.meta.name}</span>
    <span class="doc-size">{doc.width}×{doc.height}</span>
  </div>
  
  <div class="center">
    <div class="view-modes">
      <button 
        class:active={doc.viewMode === '2d'}
        onclick={() => setViewMode('2d')}
      >2D</button>
      <button 
        class:active={doc.viewMode === 'iso'}
        onclick={() => setViewMode('iso')}
      >ISO</button>
      <button 
        class:active={doc.viewMode === '3d'}
        onclick={() => setViewMode('3d')}
      >3D</button>
    </div>
  </div>
  
  <div class="right">
    <div class="grid-controls">
      <button
        class:active={showGrid}
        onclick={() => uiStore.showGrid.toggle()}
        title="Toggle grid"
      ><GridFour size={14} weight="fill" /> Grid</button>
      <button onclick={cycleGridStep} title="Grid density">Step {gridStep}×</button>
    </div>

    <span class="divider"></span>

    {#if cursorPos}
      <span class="coords">X: {cursorPos.x} Y: {cursorPos.y}</span>
    {:else}
      <span class="coords">-</span>
    {/if}

    <span class="divider"></span>

    <div class="zoom-controls">
      <button onclick={zoomOut}><MagnifyingGlassMinus size={14} weight="fill" /></button>
      <span class="zoom-value">{Math.round(doc.camera.zoom * 100)}%</span>
      <button onclick={zoomIn}><MagnifyingGlassPlus size={14} weight="fill" /></button>
    </div>
  </div>
</div>

<style>
  .status-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 12px;
    background: #1a1a2e;
    border-top: 1px solid #333;
    font-size: 12px;
    color: #888;
  }
  
  .left, .center, .right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .right {
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  
  .undo-btn, .redo-btn {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: #252538;
    color: #fff;
    cursor: pointer;
    font-size: 14px;
  }
  
  .undo-btn:disabled, .redo-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  
  .divider {
    width: 1px;
    height: 16px;
    background: #333;
  }
  
  .doc-name {
    color: #aaa;
    font-weight: 500;
  }
  
  .doc-size {
    color: #666;
  }
  
  .view-modes {
    display: flex;
    gap: 2px;
    background: #252538;
    padding: 2px;
    border-radius: 6px;
  }
  
  .view-modes button {
    padding: 4px 12px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: #888;
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
  }
  
  .view-modes button.active {
    background: #4a4a8e;
    color: #fff;
  }
  
  .view-modes button:hover:not(.active) {
    background: #2a2a4e;
  }
  
  .coords {
    min-width: 90px;
    text-align: right;
    font-family: monospace;
  }
  
  .zoom-controls {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .grid-controls {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .grid-controls button {
    height: 20px;
    padding: 0 6px;
    border: none;
    border-radius: 3px;
    background: #252538;
    color: #fff;
    cursor: pointer;
    font-size: 11px;
  }

  .grid-controls button.active {
    background: #4a4a8e;
  }
  
  .zoom-controls button {
    width: 20px;
    height: 20px;
    border: none;
    border-radius: 3px;
    background: #252538;
    color: #fff;
    cursor: pointer;
    font-size: 12px;
  }
  
  .zoom-value {
    min-width: 45px;
    text-align: center;
    font-family: monospace;
  }
  
  .file-menu-container {
    position: relative;
  }
  
  .file-btn {
    padding: 4px 10px;
    border: none;
    border-radius: 4px;
    background: #252538;
    color: #aaa;
    cursor: pointer;
    font-size: 12px;
  }
  
  .file-btn:hover {
    background: #2a2a4e;
  }
  
  .file-menu {
    position: absolute;
    bottom: 100%;
    left: 0;
    margin-bottom: 4px;
    background: #252538;
    border: 1px solid #333;
    border-radius: 6px;
    padding: 4px;
    min-width: 140px;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  }
  
  .file-menu button {
    display: block;
    width: 100%;
    padding: 8px 12px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: #ccc;
    cursor: pointer;
    font-size: 12px;
    text-align: left;
  }
  
  .file-menu button:hover {
    background: #3a3a5e;
  }
  
  .menu-divider {
    height: 1px;
    background: #333;
    margin: 4px 0;
  }
</style>
