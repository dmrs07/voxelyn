<script module lang="ts">
  declare const __APP_VERSION__: string;
</script>

<script lang="ts">
  import Canvas from './components/Canvas.svelte';
  import ToolsPanel from './components/ToolsPanel.svelte';
  import LayersPanel from './components/LayersPanel.svelte';
  import PalettePanel from './components/PalettePanel.svelte';
  import StatusBar from './components/StatusBar.svelte';
  import { uiStore } from '$lib/stores';
  import { Cube } from 'phosphor-svelte';

  const VERSION = __APP_VERSION__;
  
  let panels = $state({ tools: true, layers: true, palette: true, simulation: false });
  uiStore.panels.subscribe((value) => (panels = value));

  const togglePanel = (id: keyof typeof panels) => {
    uiStore.panels.toggle(id);
  };
</script>

<div class="app">
  <header class="menu-bar">
    <div class="logo"><Cube size={20} weight="fill" /> VoxelForge <span class="version">v{VERSION}</span></div>
    <nav class="menu">
      <button>File</button>
      <button>Edit</button>
      <button>View</button>
      <button>Layer</button>
      <button>Help</button>
    </nav>
    <div class="panel-toggles">
      <button class:active={panels.tools} onclick={() => togglePanel('tools')}>Tools</button>
      <button class:active={panels.layers} onclick={() => togglePanel('layers')}>Layers</button>
      <button class:active={panels.palette} onclick={() => togglePanel('palette')}>Palette</button>
    </div>
  </header>
  
  <main
    class="workspace"
    style={`grid-template-columns: ${panels.tools ? '200px' : '0px'} 1fr ${(panels.layers || panels.palette) ? '240px' : '0px'}`}
  >
    <aside class="left-sidebar" class:collapsed={!panels.tools}>
      {#if panels.tools}
        <ToolsPanel />
      {/if}
    </aside>
    
    <section class="canvas-area">
      <Canvas />
    </section>
    
    <aside class="right-sidebar" class:collapsed={!panels.layers && !panels.palette}>
      {#if panels.layers}
        <LayersPanel />
      {/if}
      {#if panels.palette}
        <PalettePanel />
      {/if}
    </aside>
  </main>
  
  <StatusBar />
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
