<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    Sparkle, 
    Key, 
    Image, 
    Cube, 
    Mountains, 
    Play, 
    ArrowsClockwise,
    Check,
    Warning,
    CircleNotch
  } from 'phosphor-svelte';
  import {
    createGeminiClient,
    generateTextureFromParams,
    buildVoxelsFromBlueprint,
    buildScenarioFromLayout,
    getScenarioPreview,
    DEFAULT_TEXTURE_PARAMS,
  } from '@voxelyn/ai';
  import type {
    GeminiClient,
    TextureParams,
    ObjectBlueprint,
    ScenarioLayout,
  } from '@voxelyn/ai';
  import type { Material } from '@voxelyn/core';

  // ============================================================================
  // Props
  // ============================================================================
  
  interface Props {
    palette?: Material[];
    onTextureGenerated?: (texture: Uint32Array, params: TextureParams, materialId?: number) => void;
    onObjectGenerated?: (data: Uint16Array, width: number, height: number, depth: number, blueprint: ObjectBlueprint) => void;
    onScenarioGenerated?: (terrain: Uint16Array, width: number, height: number, depth: number, layout: ScenarioLayout) => void;
  }

  let { 
    palette = [], 
    onTextureGenerated = () => {},
    onObjectGenerated = () => {},
    onScenarioGenerated = () => {},
  }: Props = $props();

  // ============================================================================
  // State
  // ============================================================================

  type TabId = 'texture' | 'object' | 'scenario';

  let activeTab = $state<TabId>('texture');
  let apiKey = $state('');
  let apiKeyValid = $state<boolean | null>(null);
  let showApiKey = $state(false);
  
  let prompt = $state('');
  let isGenerating = $state(false);
  let error = $state<string | null>(null);
  let lastGenerationMs = $state<number | null>(null);

  // Texture-specific state
  let textureSize = $state(32);
  let textureStyle = $state<'pixel' | 'realistic' | 'painterly'>('pixel');
  let tileable = $state(true);
  let texturePreview = $state<Uint32Array | null>(null);
  let textureParams = $state<TextureParams | null>(null);

  // Object-specific state
  let objectMaxSize = $state<[number, number, number]>([16, 16, 16]);
  let objectDetailLevel = $state<'low' | 'medium' | 'high'>('medium');
  let objectBlueprint = $state<ObjectBlueprint | null>(null);

  // Scenario-specific state
  let scenarioSize = $state<[number, number]>([64, 64]);
  let scenarioDepth = $state(32);
  let scenarioPreview = $state<Uint32Array | null>(null);
  let scenarioLayout = $state<ScenarioLayout | null>(null);

  // Target material for texture generation
  let targetMaterialId = $state<number | null>(null);

  // Canvas refs
  let textureCanvas: HTMLCanvasElement | null = $state(null);
  let scenarioCanvas: HTMLCanvasElement | null = $state(null);

  // Client instance
  let client: GeminiClient | null = null;

  // ============================================================================
  // Lifecycle
  // ============================================================================

  onMount(() => {
    // Load API key from localStorage
    const savedKey = localStorage.getItem('voxelyn-ai-api-key');
    if (savedKey) {
      apiKey = savedKey;
      initializeClient();
    }
  });

  // ============================================================================
  // Client Management
  // ============================================================================

  function initializeClient() {
    if (!apiKey.trim()) {
      client = null;
      apiKeyValid = null;
      return;
    }

    try {
      client = createGeminiClient({
        apiKey: apiKey.trim(),
        model: 'gemini-2.0-flash',
        debug: true,
      });
      testConnection();
    } catch (e) {
      client = null;
      apiKeyValid = false;
      error = e instanceof Error ? e.message : 'Failed to initialize client';
    }
  }

  async function testConnection() {
    if (!client) return;
    
    try {
      console.log('[AIPanel] Testing API key...');
      apiKeyValid = await client.testConnection();
      console.log('[AIPanel] Test result:', apiKeyValid);
      if (apiKeyValid) {
        localStorage.setItem('voxelyn-ai-api-key', apiKey);
      }
    } catch (e) {
      console.error('[AIPanel] Test error:', e);
      apiKeyValid = false;
    }
  }

  function handleApiKeyChange() {
    apiKeyValid = null;
    initializeClient();
  }

  // ============================================================================
  // Generation Functions
  // ============================================================================

  async function generateTexture() {
    if (!client || !prompt.trim()) return;
    
    isGenerating = true;
    error = null;

    try {
      const result = await client.predictTextureParams(prompt, palette, {
        targetSize: textureSize,
        style: textureStyle,
        tileable,
      });

      lastGenerationMs = result.generationTimeMs ?? null;

      if (!result.success) {
        error = result.error ?? 'Generation failed';
        return;
      }

      textureParams = result.data ?? null;
      
      if (textureParams) {
        texturePreview = generateTextureFromParams(textureParams, textureSize, textureSize);
        renderTexturePreview();
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      isGenerating = false;
    }
  }

  async function generateObject() {
    if (!client || !prompt.trim()) return;
    
    isGenerating = true;
    error = null;

    try {
      const result = await client.predictObjectBlueprint(prompt, palette, {
        maxSize: objectMaxSize,
        detailLevel: objectDetailLevel,
      });

      lastGenerationMs = result.generationTimeMs ?? null;

      if (!result.success) {
        error = result.error ?? 'Generation failed';
        return;
      }

      objectBlueprint = result.data ?? null;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      isGenerating = false;
    }
  }

  async function generateScenario() {
    if (!client || !prompt.trim()) return;
    
    isGenerating = true;
    error = null;

    try {
      const result = await client.predictScenarioLayout(prompt, palette, {
        targetSize: scenarioSize,
        depth: scenarioDepth,
      });

      lastGenerationMs = result.generationTimeMs ?? null;

      if (!result.success) {
        error = result.error ?? 'Generation failed';
        return;
      }

      scenarioLayout = result.data ?? null;

      if (scenarioLayout) {
        const builtScenario = buildScenarioFromLayout(scenarioLayout);
        scenarioPreview = getScenarioPreview(builtScenario);
        renderScenarioPreview();
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      isGenerating = false;
    }
  }

  function handleGenerate() {
    switch (activeTab) {
      case 'texture':
        generateTexture();
        break;
      case 'object':
        generateObject();
        break;
      case 'scenario':
        generateScenario();
        break;
    }
  }

  // ============================================================================
  // Apply Functions
  // ============================================================================

  function applyTexture() {
    if (!texturePreview || !textureParams) return;
    onTextureGenerated(texturePreview, textureParams, targetMaterialId ?? undefined);
  }

  function applyObject() {
    if (!objectBlueprint) return;
    
    const materialMapping: Record<string, number> = {};
    for (const mat of palette) {
      materialMapping[mat.name.toLowerCase()] = mat.id;
    }

    const result = buildVoxelsFromBlueprint(objectBlueprint, { materialMapping });
    onObjectGenerated(result.data, result.width, result.height, result.depth, objectBlueprint);
  }

  function applyScenario() {
    if (!scenarioLayout) return;
    
    const builtScenario = buildScenarioFromLayout(scenarioLayout);
    onScenarioGenerated(builtScenario.terrain, builtScenario.width, builtScenario.height, builtScenario.depth, scenarioLayout);
  }

  function handleApply() {
    switch (activeTab) {
      case 'texture':
        applyTexture();
        break;
      case 'object':
        applyObject();
        break;
      case 'scenario':
        applyScenario();
        break;
    }
  }

  // ============================================================================
  // Rendering
  // ============================================================================

  function renderTexturePreview() {
    if (!textureCanvas || !texturePreview) return;

    const ctx = textureCanvas.getContext('2d');
    if (!ctx) return;

    const size = textureSize;
    textureCanvas.width = size;
    textureCanvas.height = size;

    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;

    for (let i = 0; i < texturePreview.length; i++) {
      const color = texturePreview[i] ?? 0;
      data[i * 4 + 0] = color & 0xff;
      data[i * 4 + 1] = (color >> 8) & 0xff;
      data[i * 4 + 2] = (color >> 16) & 0xff;
      data[i * 4 + 3] = (color >> 24) & 0xff;
    }

    ctx.putImageData(imageData, 0, 0);
  }

  function renderScenarioPreview() {
    if (!scenarioCanvas || !scenarioPreview || !scenarioLayout) return;

    const ctx = scenarioCanvas.getContext('2d');
    if (!ctx) return;

    const [w, h] = scenarioLayout.size;
    scenarioCanvas.width = w;
    scenarioCanvas.height = h;

    const imageData = ctx.createImageData(w, h);
    const data = imageData.data;

    for (let i = 0; i < scenarioPreview.length; i++) {
      const color = scenarioPreview[i] ?? 0;
      data[i * 4 + 0] = color & 0xff;
      data[i * 4 + 1] = (color >> 8) & 0xff;
      data[i * 4 + 2] = (color >> 16) & 0xff;
      data[i * 4 + 3] = (color >> 24) & 0xff;
    }

    ctx.putImageData(imageData, 0, 0);
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  function regenerateWithNewSeed() {
    if (!textureParams) return;
    
    textureParams = {
      ...textureParams,
      noise: {
        ...textureParams.noise,
        seed: Math.floor(Math.random() * 1000000),
      },
    };
    texturePreview = generateTextureFromParams(textureParams, textureSize, textureSize);
    renderTexturePreview();
  }

  $effect(() => {
    if (texturePreview && textureCanvas) {
      renderTexturePreview();
    }
  });

  $effect(() => {
    if (scenarioPreview && scenarioCanvas) {
      renderScenarioPreview();
    }
  });
</script>

<div class="ai-panel">
  <header class="panel-header">
    <Sparkle size={16} weight="fill" />
    <span>AI Generator</span>
    <span class="badge">Premium</span>
  </header>

  <!-- API Key Section -->
  <section class="api-key-section">
    <label>
      <Key size={14} />
      <span>Gemini API Key</span>
      {#if apiKeyValid === true}
        <Check size={14} class="valid" />
      {:else if apiKeyValid === false}
        <Warning size={14} class="invalid" />
      {/if}
    </label>
    <div class="api-key-input">
      <input
        type={showApiKey ? 'text' : 'password'}
        bind:value={apiKey}
        onblur={handleApiKeyChange}
        placeholder="Enter your API key..."
      />
      <button class="toggle-visibility" onclick={() => showApiKey = !showApiKey}>
        {showApiKey ? 'Hide' : 'Show'}
      </button>
    </div>
    <a href="https://aistudio.google.com/app/apikey" target="_blank" class="api-link">
      Get API key →
    </a>
  </section>

  <!-- Tabs -->
  <nav class="tabs">
    <button 
      class:active={activeTab === 'texture'} 
      onclick={() => activeTab = 'texture'}
    >
      <Image size={14} />
      Texture
    </button>
    <button 
      class:active={activeTab === 'object'} 
      onclick={() => activeTab = 'object'}
    >
      <Cube size={14} />
      Object
    </button>
    <button 
      class:active={activeTab === 'scenario'} 
      onclick={() => activeTab = 'scenario'}
    >
      <Mountains size={14} />
      Scenario
    </button>
  </nav>

  <!-- Prompt Input -->
  <section class="prompt-section">
    <label>
      Describe what you want:
      <textarea
      bind:value={prompt}
      placeholder={
        activeTab === 'texture' 
          ? 'e.g., "rusty metal with scratches and orange patina"'
          : activeTab === 'object'
          ? 'e.g., "small wooden barrel with metal bands"'
          : 'e.g., "forest valley with river and small village"'
      }
      rows={3}
      ></textarea>
    </label>
  </section>

  <!-- Tab-specific Options -->
  {#if activeTab === 'texture'}
    <section class="options-section">
      <div class="option-row">
        <label>Size
        <select bind:value={textureSize}>
          <option value={16}>16×16</option>
          <option value={32}>32×32</option>
          <option value={64}>64×64</option>
        </select></label>
      </div>
      <div class="option-row">
        <label>Style
        <select bind:value={textureStyle}>
          <option value="pixel">Pixel Art</option>
          <option value="realistic">Realistic</option>
          <option value="painterly">Painterly</option>
        </select></label>
      </div>
      <div class="option-row">
        <label>Tileable
        <input type="checkbox" bind:checked={tileable} /></label>
      </div>
      {#if palette.length > 0}
        <div class="option-row">
          <label>Target Material
          <select bind:value={targetMaterialId}>
            <option value={null}>None (new)</option>
            {#each palette as mat}
              <option value={mat.id}>{mat.name}</option>
            {/each}
          </select></label>
        </div>
      {/if}
    </section>
  {:else if activeTab === 'object'}
    <section class="options-section">
      <div class="option-row">
        <span class="label-text">Max Size</span>
        <div class="size-inputs">
          <input type="number" bind:value={objectMaxSize[0]} min={1} max={64} />
          <span>×</span>
          <input type="number" bind:value={objectMaxSize[1]} min={1} max={64} />
          <span>×</span>
          <input type="number" bind:value={objectMaxSize[2]} min={1} max={64} />
        </div>
      </div>
      <div class="option-row">
        <label>Detail Level
        <select bind:value={objectDetailLevel}>
          <option value="low">Low (3-5 primitives)</option>
          <option value="medium">Medium (5-10 primitives)</option>
          <option value="high">High (10-20 primitives)</option>
        </select></label>
      </div>
    </section>
  {:else if activeTab === 'scenario'}
    <section class="options-section">
      <div class="option-row">
        <span class="label-text">World Size</span>
        <div class="size-inputs">
          <input type="number" bind:value={scenarioSize[0]} min={32} max={256} />
          <span>×</span>
          <input type="number" bind:value={scenarioSize[1]} min={32} max={256} />
        </div>
      </div>
      <div class="option-row">
        <label>Depth (Z)
        <input type="number" bind:value={scenarioDepth} min={16} max={64} /></label>
      </div>
    </section>
  {/if}

  <!-- Generate Button -->
  <button 
    class="generate-btn"
    onclick={handleGenerate}
    disabled={isGenerating || !apiKeyValid || !prompt.trim()}
  >
    {#if isGenerating}
      <CircleNotch size={16} class="spinning" />
      Generating...
    {:else}
      <Play size={16} weight="fill" />
      Generate
    {/if}
  </button>

  <!-- Error Display -->
  {#if error}
    <div class="error-message">
      <Warning size={14} />
      {error}
    </div>
  {/if}

  <!-- Preview Section -->
  {#if activeTab === 'texture' && texturePreview}
    <section class="preview-section">
      <div class="preview-header">
        <span>Preview</span>
        {#if lastGenerationMs}
          <span class="generation-time">{lastGenerationMs}ms</span>
        {/if}
      </div>
      <div class="texture-preview">
        <canvas 
          bind:this={textureCanvas}
          width={textureSize}
          height={textureSize}
        ></canvas>
      </div>
      <div class="preview-actions">
        <button onclick={regenerateWithNewSeed} title="Regenerate with new seed">
          <ArrowsClockwise size={14} />
          New Seed
        </button>
        <button class="apply-btn" onclick={handleApply}>
          <Check size={14} />
          Apply
        </button>
      </div>
    </section>
  {/if}

  {#if activeTab === 'object' && objectBlueprint}
    <section class="preview-section">
      <div class="preview-header">
        <span>{objectBlueprint.name}</span>
        {#if lastGenerationMs}
          <span class="generation-time">{lastGenerationMs}ms</span>
        {/if}
      </div>
      <div class="object-info">
        <p>{objectBlueprint.description}</p>
        <p class="dimensions">
          Bounds: {objectBlueprint.bounds[0]}×{objectBlueprint.bounds[1]}×{objectBlueprint.bounds[2]}
        </p>
        <p class="primitives">
          Primitives: {objectBlueprint.primitives.length}
        </p>
      </div>
      <div class="preview-actions">
        <button class="apply-btn" onclick={handleApply}>
          <Check size={14} />
          Create Object
        </button>
      </div>
    </section>
  {/if}

  {#if activeTab === 'scenario' && scenarioPreview && scenarioLayout}
    <section class="preview-section">
      <div class="preview-header">
        <span>{scenarioLayout.name}</span>
        {#if lastGenerationMs}
          <span class="generation-time">{lastGenerationMs}ms</span>
        {/if}
      </div>
      <div class="scenario-preview">
        <canvas 
          bind:this={scenarioCanvas}
          width={scenarioSize[0]}
          height={scenarioSize[1]}
        ></canvas>
      </div>
      <div class="scenario-info">
        <p>{scenarioLayout.description}</p>
        <p class="biomes">
          Biomes: {scenarioLayout.biomes.map((b: { type: string }) => b.type).join(', ')}
        </p>
      </div>
      <div class="preview-actions">
        <button class="apply-btn" onclick={handleApply}>
          <Check size={14} />
          Create World
        </button>
      </div>
    </section>
  {/if}
</div>

<style>
  .ai-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    background: #1a1a2e;
    border-radius: 8px;
    font-size: 12px;
    color: #ccc;
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    color: #fff;
  }

  .badge {
    padding: 2px 6px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border-radius: 4px;
    font-size: 10px;
    font-weight: 500;
    color: #fff;
  }

  .api-key-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .api-key-section label {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #888;
  }

  .api-key-section label :global(.valid) {
    color: #22c55e;
  }

  .api-key-section label :global(.invalid) {
    color: #ef4444;
  }

  .api-key-input {
    display: flex;
    gap: 6px;
  }

  .api-key-input input {
    flex: 1;
    padding: 6px 10px;
    background: #12121a;
    border: 1px solid #333;
    border-radius: 4px;
    color: #fff;
    font-size: 12px;
  }

  .toggle-visibility {
    padding: 6px 10px;
    background: #2a2a4e;
    border: none;
    border-radius: 4px;
    color: #888;
    cursor: pointer;
    font-size: 11px;
  }

  .api-link {
    font-size: 11px;
    color: #6366f1;
    text-decoration: none;
  }

  .api-link:hover {
    text-decoration: underline;
  }

  .tabs {
    display: flex;
    gap: 4px;
    padding: 4px;
    background: #12121a;
    border-radius: 6px;
  }

  .tabs button {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: #888;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.15s;
  }

  .tabs button:hover {
    background: #1a1a2e;
    color: #ccc;
  }

  .tabs button.active {
    background: #2a2a4e;
    color: #fff;
  }

  .prompt-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .prompt-section label {
    color: #888;
  }

  .prompt-section textarea {
    padding: 10px;
    background: #12121a;
    border: 1px solid #333;
    border-radius: 6px;
    color: #fff;
    font-size: 12px;
    resize: vertical;
    min-height: 60px;
  }

  .prompt-section textarea::placeholder {
    color: #555;
  }

  .options-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    background: #12121a;
    border-radius: 6px;
  }

  .option-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .option-row label {
    color: #888;
    white-space: nowrap;
  }

  .option-row select,
  .option-row input[type="number"] {
    padding: 4px 8px;
    background: #1a1a2e;
    border: 1px solid #333;
    border-radius: 4px;
    color: #fff;
    font-size: 12px;
  }

  .option-row input[type="checkbox"] {
    accent-color: #6366f1;
  }

  .size-inputs {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .size-inputs input {
    width: 50px;
    text-align: center;
  }

  .size-inputs span {
    color: #555;
  }

  .generate-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border: none;
    border-radius: 6px;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .generate-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .generate-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .generate-btn :global(.spinning) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    background: #ef44441a;
    border: 1px solid #ef444433;
    border-radius: 6px;
    color: #ef4444;
    font-size: 11px;
  }

  .preview-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    background: #12121a;
    border-radius: 6px;
  }

  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #888;
  }

  .generation-time {
    font-size: 10px;
    color: #555;
  }

  .texture-preview,
  .scenario-preview {
    display: flex;
    justify-content: center;
    padding: 10px;
    background: repeating-conic-gradient(#222 0% 25%, #1a1a1a 0% 50%) 50% / 16px 16px;
    border-radius: 4px;
  }

  .texture-preview canvas {
    image-rendering: pixelated;
    width: 128px;
    height: 128px;
  }

  .scenario-preview canvas {
    image-rendering: pixelated;
    max-width: 100%;
    height: auto;
  }

  .object-info,
  .scenario-info {
    color: #888;
    font-size: 11px;
  }

  .object-info p,
  .scenario-info p {
    margin: 4px 0;
  }

  .dimensions,
  .primitives,
  .biomes {
    color: #666;
  }

  .preview-actions {
    display: flex;
    gap: 8px;
  }

  .preview-actions button {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px;
    background: #2a2a4e;
    border: none;
    border-radius: 4px;
    color: #ccc;
    cursor: pointer;
    font-size: 12px;
  }

  .preview-actions button:hover {
    background: #3a3a5e;
  }

  .preview-actions .apply-btn {
    background: #22c55e33;
    color: #22c55e;
  }

  .preview-actions .apply-btn:hover {
    background: #22c55e44;
  }
</style>
