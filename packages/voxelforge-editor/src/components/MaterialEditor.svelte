<script lang="ts">
  import { onMount } from 'svelte';
  import { Plus, Trash, FloppyDisk } from 'phosphor-svelte';
  import {
    createProceduralTextureSheet,
    generateTextureForMaterial,
    PresetCustomMaterials,
    type TextureSheet,
  } from '@voxelyn/core';
  import type { Material } from '@voxelyn/core';

  interface Props {
    palette: Material[];
    onPaletteChange?: (palette: Material[]) => void;
    orientation?: 'horizontal' | 'vertical';
  }
  
  let { palette = [], onPaletteChange = () => {}, orientation = 'horizontal' }: Props = $props();

  let selectedMaterialIndex = $state(0);
  let showTexturePreview = $state(true);
  let textureCanvas: HTMLCanvasElement | null = $state(null);
  let textureSheet: TextureSheet | null = $state(null);

  const presetMaterials = [
    PresetCustomMaterials.lava,
    PresetCustomMaterials.plant,
    PresetCustomMaterials.ice,
    PresetCustomMaterials.steam,
    PresetCustomMaterials.crystal,
    PresetCustomMaterials.acid,
    PresetCustomMaterials.magma,
  ];

  onMount(() => {
    // Generate initial texture sheet
    if (palette.length > 0) {
      textureSheet = createProceduralTextureSheet(palette, 32, 32);
      renderTexturePreview();
    }
  });

  function renderTexturePreview() {
    if (!textureCanvas || !textureSheet) return;

    const ctx = textureCanvas.getContext('2d');
    if (!ctx) return;

    const material = palette[selectedMaterialIndex];
    const texture = generateTextureForMaterial(material, {
      width: 128,
      height: 128,
      seed: material.id * 1000,
    });

    const imageData = ctx.createImageData(128, 128);
    const data = imageData.data;

    for (let i = 0; i < texture.length; i++) {
      const color = texture[i];
      data[i * 4 + 0] = color & 0xff;
      data[i * 4 + 1] = (color >> 8) & 0xff;
      data[i * 4 + 2] = (color >> 16) & 0xff;
      data[i * 4 + 3] = (color >> 24) & 0xff;
    }

    ctx.putImageData(imageData, 0, 0);
  }

  function addPresetMaterial() {
    const nextId = Math.max(0, ...palette.map(m => m.id)) + 1;
    const randomPreset = presetMaterials[Math.floor(Math.random() * presetMaterials.length)];
    const newMaterial = randomPreset(nextId);
    palette = [...palette, newMaterial];
    selectedMaterialIndex = palette.length - 1;
    onPaletteChange(palette);
    setTimeout(() => renderTexturePreview(), 0);
  }

  function removeMaterial(index: number) {
    if (palette.length <= 1) return;
    palette = palette.filter((_, i) => i !== index);
    selectedMaterialIndex = Math.min(selectedMaterialIndex, palette.length - 1);
    onPaletteChange(palette);
    setTimeout(() => renderTexturePreview(), 0);
  }

  function updateSelectedMaterial<K extends keyof Material>(key: K, value: Material[K]) {
    const material = palette[selectedMaterialIndex];
    if (material) {
      const updated = { ...material, [key]: value };
      const newPalette = palette.slice();
      newPalette[selectedMaterialIndex] = updated;
      palette = newPalette;
      onPaletteChange(palette);
      setTimeout(() => renderTexturePreview(), 0);
    }
  }

  function regenerateTextureSheet() {
    if (palette.length > 0) {
      textureSheet = createProceduralTextureSheet(palette, 32, 32);
      renderTexturePreview();
    }
  }

  $effect(() => {
    if (palette.length > 0 && textureCanvas) {
      renderTexturePreview();
    }
  });
</script>

<div class="material-editor" class:vertical={orientation === 'vertical'}>
  <div class="editor-header">
    <button class="btn-icon" title="Add preset material" onclick={addPresetMaterial}>
      <Plus size={20} />
    </button>
    <button class="btn-icon" title="Regenerate textures" onclick={regenerateTextureSheet}>
      <FloppyDisk size={20} />
    </button>
  </div>

  <div class="editor-content" class:vertical={orientation === 'vertical'}>
    <!-- Material list -->
    <div class="material-list">
      <h4>Materials ({palette.length})</h4>
      <div class="list-items">
        {#each palette as material, index}
          <div
            class="material-item {selectedMaterialIndex === index ? 'selected' : ''}"
            role="button"
            tabindex="0"
            onclick={() => {
              selectedMaterialIndex = index;
            }}
            onkeydown={(e) => {
              if (e.key === 'Enter') selectedMaterialIndex = index;
            }}
          >
            <div class="material-color" style="background-color: #{material.color.toString(16).padStart(8, '0')}"></div>
            <div class="material-name">{material.name}</div>
            <button
              class="btn-remove"
              onclick={() => {
                removeMaterial(index);
              }}
              title="Delete material"
            >
              <Trash size={16} />
            </button>
          </div>
        {/each}
      </div>
    </div>

    <!-- Material properties -->
    <div class="material-props">
      {#if palette[selectedMaterialIndex]}
        {@const material = palette[selectedMaterialIndex]}
        <h4>Properties</h4>

        <div class="prop">
          <label for="mat-name">Name</label>
          <input
            id="mat-name"
            type="text"
            value={material.name}
            onchange={(e) => updateSelectedMaterial('name', e.currentTarget.value)}
          />
        </div>

        <div class="prop">
          <label for="mat-color">Color</label>
          <input
            id="mat-color"
            type="color"
            value="#{material.color.toString(16).slice(0, 6).padStart(6, '0')}"
            onchange={(e) => {
              const hex = e.currentTarget.value.substring(1);
              const color = parseInt(hex + 'FF', 16);
              updateSelectedMaterial('color', color);
            }}
          />
        </div>

        <div class="prop">
          <label for="mat-density">Density ({material.density})</label>
          <input
            id="mat-density"
            type="range"
            min="0"
            max="100"
            value={material.density}
            onchange={(e) => updateSelectedMaterial('density', Number(e.currentTarget.value))}
          />
        </div>

        <div class="prop">
          <label for="mat-friction">Friction ({material.friction.toFixed(2)})</label>
          <input
            id="mat-friction"
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={material.friction}
            onchange={(e) => updateSelectedMaterial('friction', Number(e.currentTarget.value))}
          />
        </div>

        <div class="prop-flags">
          <label for="mat-liquid">
            <input
              id="mat-liquid"
              type="checkbox"
              checked={material.isLiquid}
              onchange={(e) => updateSelectedMaterial('isLiquid', e.currentTarget.checked)}
            />
            Liquid
          </label>
          <label for="mat-gas">
            <input
              id="mat-gas"
              type="checkbox"
              checked={material.isGaseous}
              onchange={(e) => updateSelectedMaterial('isGaseous', e.currentTarget.checked)}
            />
            Gaseous
          </label>
          <label for="mat-transparent">
            <input
              id="mat-transparent"
              type="checkbox"
              checked={material.isTransparent}
              onchange={(e) => updateSelectedMaterial('isTransparent', e.currentTarget.checked)}
            />
            Transparent
          </label>
          <label for="mat-flammable">
            <input
              id="mat-flammable"
              type="checkbox"
              checked={material.flammable}
              onchange={(e) => updateSelectedMaterial('flammable', e.currentTarget.checked)}
            />
            Flammable
          </label>
        </div>

        {#if material.isoHeight !== undefined}
          <div class="prop">
            <label for="mat-height">ISO Height ({material.isoHeight}px)</label>
            <input
              id="mat-height"
              type="range"
              min="0"
              max="32"
              value={material.isoHeight}
              onchange={(e) => updateSelectedMaterial('isoHeight', Number(e.currentTarget.value))}
            />
          </div>
        {/if}
      {/if}
    </div>

    <!-- Texture preview -->
    {#if showTexturePreview}
      <div class="texture-preview">
        <h4>Preview</h4>
        <canvas bind:this={textureCanvas} width="128" height="128"></canvas>
      </div>
    {/if}
  </div>
</div>

<style>
  .material-editor {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    background: var(--bg-secondary, #1e1e1e);
    border-radius: 4px;
    font-size: 0.875rem;
    min-width: 600px;
  }

  .material-editor.vertical {
    min-width: 300px;
  }

  .editor-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }


  .btn-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    background: var(--bg-tertiary, #2d2d2d);
    border: 1px solid var(--border-color, #404040);
    border-radius: 4px;
    cursor: pointer;
    color: var(--text-primary, #e0e0e0);
    transition: all 0.2s;
  }

  .btn-icon:hover {
    background: var(--accent-color, #0e639c);
  }

  .editor-content {
    display: grid;
    grid-template-columns: 1fr 1.5fr 1fr;
    gap: 1.5rem;
    max-height: 400px;
  }

  .editor-content.vertical {
    grid-template-columns: 1fr;
    max-height: none;
  }

  .material-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow-y: auto;
  }

  .editor-content.vertical .material-list {
    max-height: 200px;
  }

  .material-list h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .list-items {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    overflow-y: auto;
  }

  .material-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background: var(--bg-tertiary, #2d2d2d);
    border: 1px solid var(--border-color, #404040);
    border-radius: 4px;
    cursor: pointer;
    color: var(--text-primary, #e0e0e0);
    text-align: left;
    transition: all 0.2s;
  }

  .material-item:hover {
    background: var(--bg-hover, #3d3d3d);
  }

  .material-item.selected {
    background: var(--accent-color, #0e639c);
    border-color: var(--accent-color, #0e639c);
  }

  .material-color {
    width: 16px;
    height: 16px;
    border-radius: 2px;
    flex-shrink: 0;
    border: 1px solid rgba(0, 0, 0, 0.3);
  }

  .material-name {
    flex: 1;
    font-size: 0.8rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .btn-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-secondary, #999);
    opacity: 0;
    transition: opacity 0.2s;
  }

  .material-item:hover .btn-remove {
    opacity: 1;
  }

  .btn-remove:hover {
    color: var(--danger-color, #f48771);
  }

  .material-props {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .material-props h4 {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .prop {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .prop label {
    font-size: 0.75rem;
    color: var(--text-secondary, #999);
    font-weight: 500;
  }

  .prop input[type='text'],
  .prop input[type='color'],
  .prop input[type='range'] {
    padding: 0.25rem 0.5rem;
    background: var(--bg-tertiary, #2d2d2d);
    border: 1px solid var(--border-color, #404040);
    border-radius: 3px;
    color: var(--text-primary, #e0e0e0);
    font-size: 0.75rem;
  }

  .prop input[type='range'] {
    padding: 0;
    height: 20px;
  }

  .prop-flags {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .prop-flags label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    font-weight: normal;
    cursor: pointer;
    color: var(--text-primary, #e0e0e0);
  }

  .prop-flags input[type='checkbox'] {
    width: 14px;
    height: 14px;
    cursor: pointer;
  }

  .texture-preview {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
  }

  .texture-preview h4 {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    align-self: flex-start;
  }

  .texture-preview canvas {
    width: 100%;
    max-width: 128px;
    height: auto;
    border: 1px solid var(--border-color, #404040);
    border-radius: 4px;
    background: var(--bg-tertiary, #2d2d2d);
    image-rendering: pixelated;
  }

  .editor-content.vertical .texture-preview {
    align-items: flex-start;
  }
</style>
