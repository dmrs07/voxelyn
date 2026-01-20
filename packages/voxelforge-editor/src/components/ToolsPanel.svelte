<script lang="ts">
  import { toolStore, type ToolId, type ToolSettings } from '$lib/stores';
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
    Plus
  } from 'phosphor-svelte';
  
  let activeTool = $state<ToolId>('pencil');
  let brushSize = $state(1);
  
  toolStore.activeTool.subscribe((t: ToolId) => activeTool = t);
  toolStore.settings.subscribe((s: ToolSettings) => brushSize = s.brushSize);
  
  const tools: Array<{ id: ToolId; icon: typeof PencilSimple; label: string; key: string }> = [
    { id: 'pencil', icon: PencilSimple, label: 'Pencil', key: 'B' },
    { id: 'eraser', icon: Eraser, label: 'Eraser', key: 'E' },
    { id: 'fill', icon: PaintBucket, label: 'Fill', key: 'G' },
    { id: 'eyedropper', icon: Eyedropper, label: 'Eyedropper', key: 'I' },
    { id: 'select', icon: Selection, label: 'Select', key: 'M' },
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
          max="32" 
          value={brushSize}
          oninput={(e) => toolStore.setBrushSize(parseInt(e.currentTarget.value))}
        />
        <button onclick={() => changeBrushSize(1)} disabled={brushSize >= 32}><Plus size={14} weight="bold" /></button>
      </div>
    </label>
  </div>
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
</style>
