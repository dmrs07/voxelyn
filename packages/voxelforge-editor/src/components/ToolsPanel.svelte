<script lang="ts">
  import { get } from 'svelte/store';
  import { toolStore, documentStore, type ToolId, type ToolSettings } from '$lib/stores';
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
    Plus
  } from 'phosphor-svelte';
  
  let activeTool = $state<ToolId>('pencil');
  let brushSize = $state(1);
  let brushShape = $state<ToolSettings['brushShape']>('square');
  let shapeFilled = $state(false);
  let isGenerating = $state(false);
  let lastMetrics = $state<{ durationMs: number; pixels: number; usedImage: boolean } | null>(null);
  
  toolStore.activeTool.subscribe((t: ToolId) => activeTool = t);
  toolStore.settings.subscribe((s: ToolSettings) => {
    brushSize = s.brushSize;
    brushShape = s.brushShape;
    shapeFilled = s.shapeFilled;
  });
  
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

  const setBrushShape = (shape: ToolSettings['brushShape']) => {
    toolStore.setBrushShape(shape);
  };

  const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

  const pickConditioningImage = (): Promise<File | null> => {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (event) => {
        const file = (event.target as HTMLInputElement).files?.[0] ?? null;
        resolve(file);
      };
      input.oncancel = () => resolve(null);
      input.click();
    });
  };

  const resolvePaletteIndex = (palette: Array<{ name: string }>, name: string): number => {
    const index = palette.findIndex((mat) => mat.name.toLowerCase() === name.toLowerCase());
    return index >= 0 ? index : 1;
  };

  const resolveMaterialIndex = (
    spec: TerrainGenSpec,
    palette: Array<{ name: string }>,
    height: number,
    biomeIndex: number
  ): number => {
    const biome = spec.biomes[biomeIndex];
    const layers = spec.layers.filter((layer) => layer.biomeId === biome?.id);
    const matchingLayer = layers.find(
      (layer) => height >= layer.minHeight && height <= layer.maxHeight
    );
    if (matchingLayer) {
      return resolvePaletteIndex(palette, matchingLayer.materialId);
    }
    if (biome?.materialIds?.length) {
      return resolvePaletteIndex(palette, biome.materialIds[0]);
    }
    return 1;
  };

  const applyTerrainResult = (
    spec: TerrainGenSpec,
    result: TerrainGenResult
  ) => {
    const doc = get(documentStore);
    const layer = doc.layers.find((entry) => entry.id === doc.activeLayerId);
    if (!layer || layer.type !== 'grid2d' || layer.locked) {
      throw new Error('Active layer must be an unlocked 2D grid layer.');
    }

    const pixels = new Array(layer.data.length);
    for (let i = 0; i < layer.data.length; i += 1) {
      const oldValue = layer.data[i] ?? 0;
      const height = clamp01((result.heightMap[i] ?? 0) + (result.detailNoise[i] ?? 0));
      const biomeIndex = result.biomeMask[i] ?? 0;
      const newValue = resolveMaterialIndex(spec, doc.palette, height, biomeIndex);
      pixels[i] = { index: i, oldValue, newValue };
    }

    documentStore.paint({ layerId: layer.id, pixels });
  };

  const generateTerrain = async () => {
    if (isGenerating) return;
    isGenerating = true;
    const start = performance.now();

    try {
      const doc = get(documentStore);
      const baseSpec = createDefaultTerrainGenSpec(doc.width, doc.height);
      const imageFile = await pickConditioningImage();
      const spec: TerrainGenSpec = imageFile
        ? { ...baseSpec, images: { heightmap: imageFile.name } }
        : baseSpec;

      const validation = validateTerrainGenSpec(spec);
      if (!validation.ok) {
        console.error('[AI Terrain] Spec validation failed', validation.errors);
        return;
      }

      let conditioning;
      if (imageFile) {
        const conditioningStart = performance.now();
        const imageData = await loadImageDataFromFile(imageFile);
        conditioning = conditioningFromImageData(imageData, {
          biomeBins: spec.biomes.length,
          detailStrength: spec.noise.detailStrength,
        });
        const conditioningMs = performance.now() - conditioningStart;
        console.info('[AI Terrain] Conditioning ready', { conditioningMs });
      }

      const generationStart = performance.now();
      const result = generateTerrainFromSpec(spec, conditioning);
      const generationMs = performance.now() - generationStart;

      applyTerrainResult(spec, result);

      const totalMs = performance.now() - start;
      const pixels = doc.width * doc.height;
      const usedImage = Boolean(conditioning);
      lastMetrics = { durationMs: Math.round(totalMs), pixels, usedImage };
      console.info('[AI Terrain] Generation metrics', {
        totalMs,
        generationMs,
        pixels,
        usedImage,
        memoryKb: Math.round(
          (result.heightMap.byteLength + result.biomeMask.byteLength + result.detailNoise.byteLength) /
            1024
        ),
      });
    } catch (err) {
      console.error('[AI Terrain] Generation failed', err);
    } finally {
      isGenerating = false;
    }
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

  <div class="divider"></div>

  <div class="ai-terrain">
    <div class="panel-header">AI Terrain</div>
    <p class="ai-terrain__help">
      Click to generate from noise, or choose an optional heightmap/biome mask when prompted.
    </p>
    <button class="ai-terrain__btn" onclick={generateTerrain} disabled={isGenerating}>
      {isGenerating ? 'Generating...' : 'Generate Terrain'}
    </button>
    {#if lastMetrics}
      <div class="ai-terrain__metrics">
        Last run: {lastMetrics.durationMs}ms · {lastMetrics.pixels.toLocaleString()} px
        {lastMetrics.usedImage ? ' · image conditioned' : ''}
      </div>
    {/if}
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

  .ai-terrain {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ai-terrain__help {
    margin: 0;
    font-size: 11px;
    color: #8f95b2;
    line-height: 1.4;
  }

  .ai-terrain__btn {
    padding: 8px 10px;
    border: none;
    border-radius: 6px;
    background: #3a3f6b;
    color: #fff;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .ai-terrain__btn:hover {
    background: #4a4f86;
  }

  .ai-terrain__btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .ai-terrain__metrics {
    font-size: 11px;
    color: #7d83a3;
  }
</style>
