<script lang="ts">
  import { toolStore, activeLayer, documentStore, type ToolId, type ToolSettings } from '$lib/stores';
  import { get } from 'svelte/store';
  import {
    generateTerrainFromSpec,
    type TerrainGenSpec,
    type TerrainGenResult,
  } from '@voxelyn/core';
  import {
    conditioningFromImageData,
    loadImageDataFromFile,
  } from '$lib/ai/image-conditioning';
  import {
    createDefaultTerrainGenSpec,
    validateTerrainGenSpec,
  } from '$lib/ai/scene-schema';
  import {
    PencilSimple,
    Eraser,
    PaintBucket,
    Eyedropper,
    Selection,
    MagicWand,
    Hand,
    LineSegment,
    Rectangle,
    Circle,
    Minus,
    Plus,
    Stack,
    ArrowsOutCardinal,
    PaintRoller,
    Trash
  } from 'phosphor-svelte';
  import type { VoxelLayer, GridLayer } from '$lib/document/types';
  
  let activeTool = $state<ToolId>('pencil');
  let brushSize = $state(1);
  let brushShape = $state<ToolSettings['brushShape']>('square');
  let shapeFilled = $state(false);
  let activeZ = $state(0);
  let isVoxelLayer = $state(false);
  let maxDepth = $state(32);
  let hasSelection = $state(false);
  let primaryMat = $state(1);
  
  toolStore.activeTool.subscribe((t: ToolId) => activeTool = t);
  toolStore.settings.subscribe((s: ToolSettings) => {
    brushSize = s.brushSize;
    brushShape = s.brushShape;
    shapeFilled = s.shapeFilled;
  });
  toolStore.activeZ.subscribe((z: number) => activeZ = z);
  toolStore.primaryMaterial.subscribe((m: number) => primaryMat = m);
  
  // Track if current layer is a voxel layer
  activeLayer.subscribe(layer => {
    isVoxelLayer = layer?.type === 'voxel3d';
    if (layer?.type === 'voxel3d') {
      maxDepth = (layer as VoxelLayer).depth;
    }
  });

  // Track selection state
  documentStore.subscribe(doc => {
    hasSelection = doc.selection?.active && doc.selection.width > 0 && doc.selection.height > 0;
  });
  
  const tools: Array<{ id: ToolId; icon: typeof PencilSimple; label: string; key: string }> = [
    { id: 'pencil', icon: PencilSimple, label: 'Pencil', key: 'B' },
    { id: 'eraser', icon: Eraser, label: 'Eraser', key: 'E' },
    { id: 'fill', icon: PaintBucket, label: 'Fill', key: 'G' },
    { id: 'eyedropper', icon: Eyedropper, label: 'Eyedropper', key: 'I' },
    { id: 'select', icon: Selection, label: 'Select', key: 'M' },
    { id: 'move', icon: ArrowsOutCardinal, label: 'Move', key: 'V' },
    { id: 'wand', icon: MagicWand, label: 'Magic Wand', key: 'W' },
    { id: 'pan', icon: Hand, label: 'Pan', key: 'H' },
    { id: 'line', icon: LineSegment, label: 'Line', key: 'L' },
    { id: 'rect', icon: Rectangle, label: 'Rectangle', key: 'R' },
    { id: 'ellipse', icon: Circle, label: 'Ellipse', key: 'O' },
  ];
  
  const selectTool = (id: ToolId) => {
    toolStore.activeTool.set(id);
  };
  
  const changeBrushSize = (delta: number) => {
    toolStore.setBrushSize(brushSize + delta);
  };

  const setBrushShape = (shape: ToolSettings['brushShape']) => {
    toolStore.setBrushShape(shape);
  };

  // Fill selection with current material
  const fillSelection = () => {
    const doc = get(documentStore);
    const layer = get(activeLayer);
    if (!layer || !doc.selection?.active) return;
    
    if (layer.type !== 'grid2d') {
      console.warn('Fill selection only works on 2D grid layers');
      return;
    }
    
    const gridLayer = layer as GridLayer;
    const sel = doc.selection;
    const pixels: Array<{ index: number; oldValue: number; newValue: number }> = [];
    
    for (let sy = 0; sy < sel.height; sy++) {
      for (let sx = 0; sx < sel.width; sx++) {
        // Check if pixel is in selection mask
        const inMask = sel.mask ? sel.mask[sy * sel.width + sx] > 0 : true;
        if (!inMask) continue;
        
        const x = sel.x + sx;
        const y = sel.y + sy;
        
        if (x < 0 || x >= gridLayer.width || y < 0 || y >= gridLayer.height) continue;
        
        const index = y * gridLayer.width + x;
        const oldValue = gridLayer.data[index];
        const newValue = primaryMat;
        
        if (oldValue !== newValue) {
          pixels.push({ index, oldValue, newValue });
        }
      }
    }
    
    if (pixels.length > 0) {
      documentStore.fill({ layerId: layer.id, pixels });
    }
  };

  // Clear selection (fill with air/0)
  const clearSelection = () => {
    const doc = get(documentStore);
    const layer = get(activeLayer);
    if (!layer || !doc.selection?.active) return;
    
    if (layer.type !== 'grid2d') {
      console.warn('Clear selection only works on 2D grid layers');
      return;
    }
    
    const gridLayer = layer as GridLayer;
    const sel = doc.selection;
    const pixels: Array<{ index: number; oldValue: number; newValue: number }> = [];
    
    for (let sy = 0; sy < sel.height; sy++) {
      for (let sx = 0; sx < sel.width; sx++) {
        const inMask = sel.mask ? sel.mask[sy * sel.width + sx] > 0 : true;
        if (!inMask) continue;
        
        const x = sel.x + sx;
        const y = sel.y + sy;
        
        if (x < 0 || x >= gridLayer.width || y < 0 || y >= gridLayer.height) continue;
        
        const index = y * gridLayer.width + x;
        const oldValue = gridLayer.data[index];
        
        if (oldValue !== 0) {
          pixels.push({ index, oldValue, newValue: 0 });
        }
      }
    }
    
    if (pixels.length > 0) {
      documentStore.erase({ layerId: layer.id, pixels });
    }
  };

  // Deselect all
  const deselectAll = () => {
    documentStore.select({ 
      before: get(documentStore).selection, 
      after: { active: false, x: 0, y: 0, width: 0, height: 0 } 
    });
  };
</script>

<div class="tools-panel">
  <div class="panel-header">Tools</div>
  
  <div class="tool-grid">
    {#each tools as tool}
      <button
        class="tool-btn"
        class:active={activeTool === tool.id}
        onclick={() => selectTool(tool.id)}
        title={`${tool.label} (${tool.key})`}
      >
        <tool.icon size={20} weight="fill" />
      </button>
    {/each}
  </div>
  
  <div class="divider"></div>
  
  <div class="brush-settings">
    <label>
      Size: {brushSize}
      <div class="size-controls">
        <button onclick={() => changeBrushSize(-1)} disabled={brushSize <= 1}><Minus size={14} weight="bold" /></button>
        <input 
          type="range" 
          min="1" 
          max="64" 
          value={brushSize}
          oninput={(e) => toolStore.setBrushSize(parseInt(e.currentTarget.value))}
        />
        <button onclick={() => changeBrushSize(1)} disabled={brushSize >= 64}><Plus size={14} weight="bold" /></button>
      </div>
    </label>

    <label>
      Shape
      <div class="shape-controls">
        <button
          class:active={brushShape === 'square'}
          onclick={() => setBrushShape('square')}
          title="Square"
        >□</button>
        <button
          class:active={brushShape === 'circle'}
          onclick={() => setBrushShape('circle')}
          title="Circle"
        >○</button>
        <button
          class:active={brushShape === 'diamond'}
          onclick={() => setBrushShape('diamond')}
          title="Diamond"
        >◇</button>
      </div>
    </label>

    <label class="fill-toggle">
      <input
        type="checkbox"
        checked={shapeFilled}
        onchange={() => toolStore.toggleShapeFilled()}
      />
      Filled Shapes (F)
    </label>
  </div>

  {#if hasSelection}
    <div class="divider"></div>
    
    <div class="selection-actions">
      <div class="panel-header">Selection</div>
      <div class="action-buttons">
        <button 
          class="action-btn fill-btn" 
          onclick={fillSelection}
          title="Fill selection with current material"
        >
          <PaintRoller size={14} weight="bold" />
          Fill
        </button>
        <button 
          class="action-btn clear-btn" 
          onclick={clearSelection}
          title="Clear selection (erase)"
        >
          <Trash size={14} weight="bold" />
          Clear
        </button>
        <button 
          class="action-btn" 
          onclick={deselectAll}
          title="Deselect all (Esc)"
        >
          <Selection size={14} weight="bold" />
          Deselect
        </button>
      </div>
    </div>
  {/if}

  {#if isVoxelLayer}
    <div class="divider"></div>
    
    <div class="z-level-settings">
      <label>
        <Stack size={16} weight="bold" /> Z Level: {activeZ}
        <div class="z-controls">
          <button onclick={() => toolStore.stepActiveZ(-1, maxDepth)} disabled={activeZ <= 0}>
            <Minus size={14} weight="bold" />
          </button>
          <input 
            type="range" 
            min="0" 
            max={maxDepth - 1}
            value={activeZ}
            oninput={(e) => toolStore.setActiveZ(parseInt(e.currentTarget.value), maxDepth)}
          />
          <button onclick={() => toolStore.stepActiveZ(1, maxDepth)} disabled={activeZ >= maxDepth - 1}>
            <Plus size={14} weight="bold" />
          </button>
        </div>
      </label>
      <div class="z-info">
        Editing at height {activeZ} of {maxDepth}
      </div>
    </div>
  {/if}
</div>

<style>
  .tools-panel {
    background: #252538;
    border-radius: 8px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .panel-header {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: #888;
    letter-spacing: 0.5px;
  }
  
  .tool-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
  }
  
  .tool-btn {
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 6px;
    background: #1a1a2e;
    color: #9aa0b2;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }
  
  .tool-btn:hover {
    background: #2a2a4e;
    color: #fff;
  }
  
  .tool-btn.active {
    background: #4a4a8e;
    box-shadow: 0 0 0 2px #6a6aae;
    color: #fff;
  }
  
  .divider {
    height: 1px;
    background: #333;
  }
  
  .brush-settings {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .brush-settings label {
    font-size: 12px;
    color: #aaa;
  }
  
  .size-controls {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
  }
  
  .size-controls button {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: #1a1a2e;
    color: #fff;
    cursor: pointer;
  }
  
  .size-controls button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  
  .size-controls input[type="range"] {
    flex: 1;
    accent-color: #6a6aae;
  }

  .shape-controls {
    display: flex;
    gap: 4px;
    margin-top: 4px;
  }

  .shape-controls button {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 4px;
    background: #1a1a2e;
    color: #fff;
    cursor: pointer;
    font-size: 14px;
  }

  .shape-controls button.active {
    background: #4a4a8e;
    box-shadow: 0 0 0 2px #6a6aae;
  }

  .fill-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .fill-toggle input {
    accent-color: #6a6aae;
  }

  .z-level-settings {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .z-level-settings label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: #9aa0b2;
  }

  .z-controls {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
  }
  
  .z-controls button {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: #1a1a2e;
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .z-controls button:hover:not(:disabled) {
    background: #2a2a4e;
  }
  
  .z-controls button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  
  .z-controls input[type="range"] {
    flex: 1;
    accent-color: #6a6aae;
  }

  .z-info {
    font-size: 10px;
    color: #666;
    text-align: center;
  }

  .selection-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border: none;
    border-radius: 6px;
    background: #1a1a2e;
    color: #9aa0b2;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.15s;
  }

  .action-btn:hover {
    background: #2a2a4e;
    color: #fff;
  }

  .action-btn.fill-btn {
    background: #2d4a3d;
    color: #6ee7b7;
  }

  .action-btn.fill-btn:hover {
    background: #3d6a52;
    color: #a7f3d0;
  }

  .action-btn.clear-btn {
    background: #4a2d2d;
    color: #fca5a5;
  }

  .action-btn.clear-btn:hover {
    background: #6a3d3d;
    color: #fecaca;
  }
</style>
