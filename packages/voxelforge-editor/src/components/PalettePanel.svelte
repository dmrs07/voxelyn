<script lang="ts">
  import { documentStore, toolStore, palette } from '$lib/stores';
  import type { Material } from '@voxelyn/core';
  import { ArrowsLeftRight, Swatches } from 'phosphor-svelte';
  import MaterialEditor from './MaterialEditor.svelte';
  
  let materials = $state<Material[]>([]);
  let primaryMat = $state(1);
  let secondaryMat = $state(0);
  
  palette.subscribe((p: Material[]) => materials = p);
  toolStore.primaryMaterial.subscribe((m: number) => primaryMat = m);
  toolStore.secondaryMaterial.subscribe((m: number) => secondaryMat = m);
  
  const selectPrimary = (id: number) => {
    toolStore.primaryMaterial.set(id);
  };
  
  const selectSecondary = (id: number, e: MouseEvent) => {
    e.preventDefault();
    toolStore.secondaryMaterial.set(id);
  };
  
  const swapColors = () => {
    toolStore.swapMaterials();
  };

  const handlePaletteChange = (newPalette: Material[]) => {
    materials = newPalette;
    const doc = $documentStore;
    documentStore.set({
      ...doc,
      palette: newPalette,
    });
  };
  
  const unpackColor = (color: number): string => {
    const r = color & 0xff;
    const g = (color >> 8) & 0xff;
    const b = (color >> 16) & 0xff;
    const a = (color >> 24) & 0xff;
    return `rgba(${r},${g},${b},${a / 255})`;
  };
</script>

<div class="palette-panel">
  <div class="panel-header">Palette</div>
  
  <details class="material-editor-details" open>
    <summary class="material-editor-summary"><Swatches size={16} weight="bold" /> Material Editor</summary>
    <div class="material-editor-content" style="margin-top: 8px;">
      <MaterialEditor palette={materials} onPaletteChange={handlePaletteChange} orientation="vertical" />
    </div>
  </details>
  
  <div class="current-colors">
    <div class="color-stack">
      <div 
        class="secondary-color"
        style="background: {unpackColor(materials[secondaryMat]?.color ?? 0)}"
        title="Secondary ({materials[secondaryMat]?.name})"
      ></div>
      <div 
        class="primary-color"
        style="background: {unpackColor(materials[primaryMat]?.color ?? 0)}"
        title="Primary ({materials[primaryMat]?.name})"
      ></div>
    </div>
    <button class="swap-btn" onclick={swapColors} title="Swap (X)"><ArrowsLeftRight size={14} weight="bold" /></button>
    <div class="color-labels">
      <span>{materials[primaryMat]?.name ?? 'None'}</span>
    </div>
  </div>
  
  <div class="palette-grid">
    {#each materials.filter(m => m) as mat}
      <button
        class="swatch"
        class:primary={mat.id === primaryMat}
        class:secondary={mat.id === secondaryMat}
        style="background: {unpackColor(mat.color)}"
        onclick={() => selectPrimary(mat.id)}
        oncontextmenu={(e) => selectSecondary(mat.id, e)}
        title={mat.name}
      ></button>
    {/each}
  </div>
</div>

<style>
  .palette-panel {
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
  
  .current-colors {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .color-stack {
    position: relative;
    width: 48px;
    height: 48px;
  }
  
  .primary-color {
    position: absolute;
    top: 0;
    left: 0;
    width: 32px;
    height: 32px;
    border-radius: 4px;
    border: 2px solid #fff;
    z-index: 2;
  }
  
  .secondary-color {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: 2px solid #888;
    z-index: 1;
  }
  
  .swap-btn {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 4px;
    background: #1a1a2e;
    color: #fff;
    cursor: pointer;
    font-size: 14px;
  }
  
  .swap-btn:hover {
    background: #2a2a4e;
  }
  
  .color-labels {
    flex: 1;
    font-size: 12px;
    color: #aaa;
  }
  
  .palette-grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 2px;
  }
  
  .swatch {
    width: 100%;
    aspect-ratio: 1;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    position: relative;
  }
  
  .swatch:hover {
    transform: scale(1.1);
    z-index: 1;
  }
  
  .swatch.primary {
    box-shadow: 0 0 0 2px #fff;
    z-index: 2;
  }
  
  .swatch.secondary {
    box-shadow: 0 0 0 2px #888;
  }
  
  .swatch.primary.secondary {
    box-shadow: 0 0 0 2px #fff, 0 0 0 4px #888;
  }
</style>
