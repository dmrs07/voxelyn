<script module lang="ts">
  declare const __APP_VERSION__: string;
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import Canvas from './components/Canvas.svelte';
  import ToolsPanel from './components/ToolsPanel.svelte';
  import LayersPanel from './components/LayersPanel.svelte';
  import PalettePanel from './components/PalettePanel.svelte';
  import StatusBar from './components/StatusBar.svelte';
  import AIGeneratorPanel from './components/AIGeneratorPanel.svelte';
  import AssetLibraryPanel from './components/AssetLibraryPanel.svelte';
  import ProjectBrowserPanel from './components/ProjectBrowserPanel.svelte';
  import ConsolePanel from './components/ConsolePanel.svelte';
  import DesktopCommandModal from './components/DesktopCommandModal.svelte';
  import { uiStore, documentStore, palette, projectStore, worldStore } from '$lib/stores';
  import { applyIsoViewDefaults, resetIsoViewDefaults } from '$lib/render/render-iso';
  import { Archive, Cube, Sparkle, Terminal } from 'phosphor-svelte';
  import type { BundleViewSettings } from '@voxelyn/core';
  import { uiCommandStore, type UiCommandState } from '$lib/desktop/ui-command-store';
  import { cliConsoleStore } from '$lib/cli-console/store';

  const VERSION = __APP_VERSION__;
  
  let panels = $state({ tools: true, layers: true, palette: true, simulation: false, ai: false, assets: false, project: true, console: false });
  uiStore.panels.subscribe((value) => (panels = value));
  let isDesktopShell = $state(false);
  let uiCommandState = $state<UiCommandState>({
    available: false,
    activeModal: null,
    latestEvent: null,
  });
  let lastHandledCommandId = 0;

  let currentPalette = $state<import('@voxelyn/core').Material[]>([]);
  palette.subscribe((value) => (currentPalette = value));

  const togglePanel = (id: keyof typeof panels) => {
    uiStore.panels.toggle(id);
  };

  const applyAutoViewSettings = (viewSettings: BundleViewSettings | null | undefined): void => {
    if (!viewSettings) return;
    resetIsoViewDefaults();
    applyIsoViewDefaults({
      tileW: viewSettings.iso.tileW,
      tileH: viewSettings.iso.tileH,
      zStep: viewSettings.iso.zStep,
      defaultHeight: viewSettings.iso.defaultHeight,
      baselineZ: viewSettings.iso.baselineZ,
      axisScale: viewSettings.iso.axisScale,
      centerBiasY: viewSettings.iso.centerBiasY,
    });
    documentStore.setCamera({
      x: viewSettings.camera.x,
      y: viewSettings.camera.y,
      zoom: viewSettings.camera.zoom,
      rotation: viewSettings.camera.rotation,
    });
  };

  const readMetaViewSettings = (meta: unknown): BundleViewSettings | null => {
    if (!meta || typeof meta !== 'object') return null;
    const candidate = (meta as { viewSettings?: unknown }).viewSettings;
    if (!candidate || typeof candidate !== 'object') return null;
    return candidate as BundleViewSettings;
  };

  // AI Generation handlers
  function handleTextureGenerated(texture: Uint32Array, params: unknown, materialId?: number) {
    console.log('Texture generated:', { texture, params, materialId });
    
    if (materialId !== undefined && materialId !== null) {
      // Apply texture to existing material
      const materialIndex = currentPalette.findIndex(m => m.id === materialId);
      if (materialIndex >= 0) {
        const material = currentPalette[materialIndex];
        // Update the material's texture/color based on average color from generated texture
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < texture.length; i++) {
          const color = texture[i];
          r += color & 0xff;
          g += (color >> 8) & 0xff;
          b += (color >> 16) & 0xff;
        }
        const count = texture.length || 1;
        const avgColor = 
          (Math.round(r / count) & 0xff) |
          ((Math.round(g / count) & 0xff) << 8) |
          ((Math.round(b / count) & 0xff) << 16) |
          0xff000000;
        
        // Update palette with new color
        const newPalette = [...currentPalette];
        newPalette[materialIndex] = { ...material, color: avgColor };
        
        documentStore.set({
          ...$documentStore,
          palette: newPalette,
        });
        
        console.log(`Applied texture to material: ${material.name}`);
      }
    } else {
      console.log('Texture generated (no target material). Size:', Math.sqrt(texture.length));
    }
  }

  function handleObjectGenerated(data: Uint16Array, width: number, height: number, depth: number, blueprint: unknown) {
    console.log('Object generated:', { data, width, height, depth, blueprint });
    
    // Create a new voxel layer with the generated object
    const blueprintObj = blueprint as { name?: string };
    const layerId = documentStore.addVoxelLayerWithData(
      data,
      width,
      height,
      depth,
      blueprintObj?.name ?? 'AI Object'
    );
    
    // Switch to 3D view mode to see the result
    documentStore.setViewMode('3d');
    console.log('Created voxel layer:', layerId);
  }

  function handleScenarioGenerated(terrain: Uint16Array, width: number, height: number, depth: number, layout: unknown) {
    console.log('Scenario generated:', { terrain, width, height, depth, layout });
    
    // Create a new document with the scenario dimensions
    const layoutObj = layout as { name?: string };
    documentStore.newDocument(width, height, depth, layoutObj?.name ?? 'AI Scenario');
    
    // Add the terrain as a voxel layer
    documentStore.addVoxelLayerWithData(
      terrain,
      width,
      height,
      depth,
      'Terrain'
    );
    
    // Switch to 3D view mode
    documentStore.setViewMode('3d');
    console.log('Created scenario with terrain layer');
  }

  function handleObjectImported(data: Uint16Array, width: number, height: number, depth: number, meta?: unknown) {
    const name =
      typeof meta === 'object' && meta !== null && 'id' in meta
        ? `Bundle Object ${(meta as { id?: string }).id ?? ''}`.trim()
        : 'Bundle Object';
    const layerId = documentStore.addVoxelLayerWithData(data, width, height, depth, name);
    documentStore.setViewMode('3d');
    applyAutoViewSettings(readMetaViewSettings(meta));
    console.log('Imported object bundle as layer', { layerId, meta });
  }

  function handleScenarioImported(
    terrain: Uint16Array,
    width: number,
    height: number,
    depth: number,
    meta?: unknown,
  ) {
    const title =
      typeof meta === 'object' && meta !== null && 'id' in meta
        ? `Bundle Scenario ${(meta as { id?: string }).id ?? ''}`.trim()
        : 'Bundle Scenario';
    documentStore.newDocument(width, height, depth, title);
    documentStore.addVoxelLayerWithData(terrain, width, height, depth, 'Terrain');
    documentStore.setViewMode('3d');
    applyAutoViewSettings(readMetaViewSettings(meta));
    console.log('Imported scenario bundle', { meta });
  }

  function handleTextureImported(texture: Uint32Array, _width: number, _height: number, meta?: unknown) {
    handleTextureGenerated(texture, { source: 'bundle', meta }, undefined);
    applyAutoViewSettings(readMetaViewSettings(meta));
    console.log('Imported texture bundle', { meta });
  }

  function handleApplyViewSettings(viewSettings: BundleViewSettings): void {
    applyAutoViewSettings(viewSettings);
  }

  const handleDesktopEvent = async (type: string): Promise<void> => {
    if (type === 'refresh-project') {
      await projectStore.refresh();
      await worldStore.loadFromProject();
      return;
    }

    if (type === 'cli-help') {
      const projectRoot = get(projectStore).projectRoot ?? undefined;
      await cliConsoleStore.runCommand({
        cwd: projectRoot,
        args: ['--help'],
        label: 'voxelyn --help',
      });
      uiStore.panels.show('console');
      return;
    }

    if (type === 'close-project') {
      projectStore.clear();
      await worldStore.loadFromProject();
    }
  };

  onMount(() => {
    isDesktopShell = Boolean(window?.voxelynDesktop?.isDesktop);
    projectStore.initialize();
    cliConsoleStore.initialize();
    uiCommandStore.initialize();

    const unsubscribeUiCommands = uiCommandStore.subscribe((next) => {
      uiCommandState = next;
      if (!next.latestEvent || next.latestEvent.id === lastHandledCommandId) return;
      lastHandledCommandId = next.latestEvent.id;
      void handleDesktopEvent(next.latestEvent.type);
      uiCommandStore.clearLatestEvent();
    });

    return () => {
      unsubscribeUiCommands();
    };
  });
</script>

<div class="app">
  <header class="menu-bar">
    <div class="logo"><Cube size={20} weight="fill" /> VoxelForge <span class="version">v{VERSION}</span></div>
    {#if !isDesktopShell}
      <nav class="menu">
        <button>File</button>
        <button>Edit</button>
        <button>View</button>
        <button>Layer</button>
        <button>Help</button>
      </nav>
    {/if}
    <div class="panel-toggles">
      <button class:active={panels.tools} onclick={() => togglePanel('tools')}>Tools</button>
      <button class:active={panels.layers} onclick={() => togglePanel('layers')}>Layers</button>
      <button class:active={panels.palette} onclick={() => togglePanel('palette')}>Palette</button>
      <button class="ai-toggle" class:active={panels.ai} onclick={() => togglePanel('ai')}>
        <Sparkle size={12} weight="fill" />
        AI
      </button>
      <button class:active={panels.assets} onclick={() => togglePanel('assets')}>
        <Archive size={12} weight="fill" />
        Assets
      </button>
      <button class:active={panels.project} onclick={() => togglePanel('project')}>Project</button>
      <button class:active={panels.console} onclick={() => togglePanel('console')}>
        <Terminal size={12} weight="fill" />
        Console
      </button>
    </div>
  </header>
  
  <main
    class="workspace"
    style={`grid-template-columns: ${panels.tools ? '200px' : '0px'} 1fr ${(panels.layers || panels.palette || panels.ai || panels.assets || panels.project || panels.console) ? '420px' : '0px'}`}
  >
    <aside class="left-sidebar" class:collapsed={!panels.tools}>
      {#if panels.tools}
        <ToolsPanel />
      {/if}
    </aside>
    
    <section class="canvas-area">
      <Canvas />
    </section>
    
    <aside class="right-sidebar" class:collapsed={!panels.layers && !panels.palette && !panels.ai && !panels.assets && !panels.project && !panels.console}>
      {#if panels.project}
        <ProjectBrowserPanel />
      {/if}
      {#if panels.console}
        <ConsolePanel />
      {/if}
      {#if panels.assets}
        <AssetLibraryPanel
          onObjectImported={handleObjectImported}
          onScenarioImported={handleScenarioImported}
          onTextureImported={handleTextureImported}
          onApplyViewSettings={handleApplyViewSettings}
        />
      {/if}
      {#if panels.ai}
        <AIGeneratorPanel 
          palette={currentPalette}
          onTextureGenerated={handleTextureGenerated}
          onObjectGenerated={handleObjectGenerated}
          onScenarioGenerated={handleScenarioGenerated}
        />
      {/if}
      {#if panels.layers}
        <LayersPanel />
      {/if}
      {#if panels.palette}
        <PalettePanel />
      {/if}
    </aside>
  </main>
  
  <StatusBar />
  <DesktopCommandModal modal={uiCommandState.activeModal} on:close={() => uiCommandStore.closeModal()} />
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
  
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #12121a;
  }
  
  .menu-bar {
    display: flex;
    align-items: center;
    padding: 0 16px;
    height: 40px;
    background: #1a1a2e;
    border-bottom: 1px solid #333;
  }
  
  .logo {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 700;
    color: #fff;
    margin-right: 24px;
  }

  .logo .version {
    font-size: 10px;
    font-weight: 400;
    color: #666;
    padding: 2px 6px;
    background: #2a2a4e;
    border-radius: 4px;
  }
  
  .menu {
    display: flex;
    gap: 4px;
  }
  
  .menu button {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: #aaa;
    cursor: pointer;
    font-size: 13px;
  }
  
  .menu button:hover {
    background: #2a2a4e;
    color: #fff;
  }

  .panel-toggles {
    margin-left: auto;
    display: flex;
    gap: 6px;
  }

  .panel-toggles button {
    padding: 4px 10px;
    border: 1px solid #2a2a4e;
    border-radius: 999px;
    background: #1a1a2e;
    color: #9aa0b2;
    font-size: 12px;
    cursor: pointer;
  }

  .panel-toggles button.active {
    background: #2b2b54;
    color: #fff;
    border-color: #4a4a8e;
  }

  .panel-toggles .ai-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    background: linear-gradient(135deg, #1a1a2e, #2a2a4e);
    border-color: #6366f1;
  }

  .panel-toggles .ai-toggle.active {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #fff;
    border-color: #8b5cf6;
  }
  
  .workspace {
    display: grid;
    grid-template-rows: 1fr;
    flex: 1;
    overflow: hidden;
    transition: grid-template-columns 0.15s ease;
  }
  
  .left-sidebar {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
    border-right: 1px solid #1f1f2f;
  }
  
  .canvas-area {
    flex: 1;
    background: #0a0a12;
    position: relative;
  }
  
  .right-sidebar {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
    border-left: 1px solid #1f1f2f;
  }

  .left-sidebar.collapsed,
  .right-sidebar.collapsed {
    padding: 0;
    overflow: hidden;
    border: none;
  }
</style>
