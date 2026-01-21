<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { documentStore, toolStore, uiStore, activeLayer } from '$lib/stores';
  import { toolRegistry, getToolByHotkey, type ToolRuntimeState, type ToolContext } from '$lib/tool-system';
  import { renderDocumentToSurface } from '$lib/render/render-surface';
  import { renderDocumentIso, screenToIso } from '$lib/render/render-iso';
  import { createWebglRenderer, type WebglRenderer } from '$lib/render/webgl-renderer';
  import type { GridLayer, EditorDocument, Selection, BlendMode } from '$lib/document/types';
  import { createRectSelection } from '$lib/document/types';
  import { mergeSelection, type SelectionOp } from '$lib/document/selection';
  import type { ToolId, ToolSettings } from '$lib/stores';

  let canvas: HTMLCanvasElement;
  let webglCanvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let webglRenderer: WebglRenderer | null = null;
  let useWebGL = false;
  let dpr = 1;
  const referenceImages = new Map<string, HTMLImageElement>();
  
  // Local state from stores
  let doc: EditorDocument = get(documentStore);
  let tool: ToolId = get(toolStore.activeTool);
  let settings: ToolSettings = get(toolStore.settings);
  let primaryMat: number = get(toolStore.primaryMaterial);
  let secondaryMat: number = get(toolStore.secondaryMaterial);
  let layer: GridLayer | null = get(activeLayer) as GridLayer | null;
  let showGrid: boolean = get(uiStore.showGrid);
  let gridStep: number = get(uiStore.gridStep);
  let cursorPosition: { x: number; y: number } | null = get(uiStore.cursorPosition);
  let isPanModifier = false;
  
  // Tool runtime state
  const toolState: ToolRuntimeState = {
    isPanning: false,
    isDrawing: false,
    isSelecting: false,
    startPoint: null,
    currentPoint: null,
    lastPoint: null,
    pendingPixels: new Map(),
    currentMaterial: 1,
    selectionPreview: null,
    selectionOp: 'replace',
    activePointerToolId: null,
  };

  const addPendingPixels = (pixels: Array<{ index: number; oldValue: number; newValue: number }>) => {
    for (const px of pixels) {
      const existing = toolState.pendingPixels.get(px.index);
      if (existing) {
        existing.newValue = px.newValue;
      } else {
        toolState.pendingPixels.set(px.index, { ...px });
      }
    }
  };

  const commitPendingPixels = (toolId: ToolId) => {
    if (!layer || toolState.pendingPixels.size === 0) return;

    const payload = {
      layerId: layer.id,
      pixels: Array.from(toolState.pendingPixels.values()),
    };

    if (toolId === 'eraser') {
      documentStore.erase(payload);
    } else if (toolId === 'fill') {
      documentStore.fill(payload);
    } else {
      documentStore.paint(payload);
    }
    toolState.pendingPixels.clear();

    const canStepTools: ToolId[] = ['pencil', 'eraser', 'line', 'rect', 'ellipse', 'fill'];
    if (settings.autoLayerStep && canStepTools.includes(toolId)) {
      documentStore.stepActiveLayer(settings.autoLayerStepDirection, settings.autoLayerStepCreate);
    }
  };
  
  // Convert screen coords to grid coords
  const screenToGrid = (screenX: number, screenY: number): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const localX = (screenX - rect.left) * scaleX;
    const localY = (screenY - rect.top) * scaleY;
    const viewX = localX / dpr;
    const viewY = localY / dpr;
    
    if (doc.viewMode === 'iso') {
      return screenToIso(
        viewX,
        viewY,
        canvas.clientWidth,
        canvas.clientHeight,
        doc.camera
      );
    }
    
    const x = (viewX - doc.camera.x) / doc.camera.zoom;
    const y = (viewY - doc.camera.y) / doc.camera.zoom;
    return { x: Math.floor(x), y: Math.floor(y) };
  };
  
  const getSelectionOp = (e: PointerEvent): SelectionOp => {
    if (e.shiftKey) return 'union';
    if (e.altKey) return 'subtract';
    if (e.ctrlKey || e.metaKey) return 'intersect';
    return 'replace';
  };

  const buildRectSelection = (a: { x: number; y: number }, b: { x: number; y: number }): Selection => {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const width = Math.abs(a.x - b.x) + 1;
    const height = Math.abs(a.y - b.y) + 1;
    return createRectSelection(x, y, width, height);
  };

  const buildToolContext = (): ToolContext => ({
    doc,
    layer,
    settings,
    primaryMaterial: primaryMat,
    secondaryMaterial: secondaryMat,
    cursorPosition,
    state: toolState,
    screenToGrid,
    getSelectionOp,
    buildRectSelection,
    mergeSelection: (incoming, op) => mergeSelection(doc.selection, incoming, op, doc.width, doc.height),
    addPendingPixels,
    commitPendingPixels,
    setSelectionPreview: (selection) => { toolState.selectionPreview = selection; },
    commitSelection: (selection) => {
      documentStore.select({ before: doc.selection, after: selection });
    },
    setPrimaryMaterial: (material) => { toolStore.primaryMaterial.set(material); },
    setCameraByDelta: (dx, dy) => {
      documentStore.setCamera({ x: doc.camera.x + dx, y: doc.camera.y + dy });
    },
    setPointerCapture: (pointerId) => canvas.setPointerCapture(pointerId),
    releasePointerCapture: (pointerId) => canvas.releasePointerCapture(pointerId),
    render,
  });

  const handlePointerDown = (e: PointerEvent) => {
    const toolCtx = buildToolContext();
    const toolOverride: ToolId = e.button === 1 || isPanModifier ? 'pan' : tool;
    const activeTool = toolRegistry[toolOverride] ?? toolRegistry.pencil;
    toolState.activePointerToolId = toolOverride;

    if (e.altKey && toolOverride !== 'eyedropper') {
      toolRegistry.eyedropper.onPointerDown(toolCtx, e);
      return;
    }

    activeTool.onPointerDown(toolCtx, e);
  };

  const handlePointerMove = (e: PointerEvent) => {
    const gridPos = screenToGrid(e.clientX, e.clientY);
    cursorPosition = gridPos;
    uiStore.cursorPosition.set(gridPos);

    const toolCtx = buildToolContext();
    const activeToolId = toolState.activePointerToolId ?? tool;
    const activeTool = toolRegistry[activeToolId] ?? toolRegistry.pencil;
    activeTool.onPointerMove(toolCtx, e);
  };

  const handlePointerUp = (e: PointerEvent) => {
    const toolCtx = buildToolContext();
    const activeToolId = toolState.activePointerToolId ?? tool;
    const activeTool = toolRegistry[activeToolId] ?? toolRegistry.pencil;
    activeTool.onPointerUp(toolCtx, e);
    toolState.activePointerToolId = null;
  };
  
  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.125, Math.min(8, doc.camera.zoom * zoomFactor));
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const localX = (e.clientX - rect.left) * scaleX;
    const localY = (e.clientY - rect.top) * scaleY;
    const viewX = localX / dpr;
    const viewY = localY / dpr;

    applyZoomAt(viewX, viewY, newZoom);
  };

  const zoomLevels = [0.125, 0.25, 0.5, 1, 2, 4, 8];

  const getNearestZoomIndex = (zoom: number) => {
    let nearestIndex = 0;
    let nearestDistance = Math.abs(zoomLevels[0] - zoom);
    for (let i = 1; i < zoomLevels.length; i++) {
      const distance = Math.abs(zoomLevels[i] - zoom);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }
    return nearestIndex;
  };

  const applyZoomAt = (viewX: number, viewY: number, newZoom: number) => {
    const worldX = (viewX - doc.camera.x) / doc.camera.zoom;
    const worldY = (viewY - doc.camera.y) / doc.camera.zoom;

    const newX = viewX - worldX * newZoom;
    const newY = viewY - worldY * newZoom;

    documentStore.setCamera({ x: newX, y: newY, zoom: newZoom });
  };

  const stepZoom = (delta: number) => {
    const currentIndex = getNearestZoomIndex(doc.camera.zoom);
    const nextIndex = Math.max(0, Math.min(zoomLevels.length - 1, currentIndex + delta));
    const nextZoom = zoomLevels[nextIndex];
    const viewX = canvas.clientWidth / 2;
    const viewY = canvas.clientHeight / 2;
    applyZoomAt(viewX, viewY, nextZoom);
  };

  const fitToWindow = () => {
    const zoomX = canvas.clientWidth / doc.width;
    const zoomY = canvas.clientHeight / doc.height;
    const newZoom = Math.max(0.125, Math.min(8, Math.min(zoomX, zoomY)));
    const newX = canvas.clientWidth / 2 - doc.width * newZoom / 2;
    const newY = canvas.clientHeight / 2 - doc.height * newZoom / 2;
    documentStore.setCamera({ x: newX, y: newY, zoom: newZoom });
  };
  
  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  const getCursorStyle = () => {
    if (toolState.isPanning || isPanModifier) return 'grabbing';
    const activeTool = toolRegistry[tool] ?? toolRegistry.pencil;
    return activeTool.cursor;
  };
  
  const renderOverlay = (clear = true) => {
    if (!ctx || !canvas) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (clear) {
      ctx.clearRect(0, 0, width, height);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(doc.camera.x, doc.camera.y);
    ctx.scale(doc.camera.zoom, doc.camera.zoom);

    // Draw grid
    if (showGrid && doc.camera.zoom >= 2) {
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1 / doc.camera.zoom;

      const startX = 0;
      const startY = 0;
      const endX = doc.width;
      const endY = doc.height;

      ctx.beginPath();
      const step = Math.max(1, Math.floor(gridStep));
      for (let x = startX; x <= endX; x += step) {
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
      }
      for (let y = startY; y <= endY; y += step) {
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
      }
      ctx.stroke();
    }

    // Draw border
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1 / doc.camera.zoom;
    ctx.strokeRect(0, 0, doc.width, doc.height);

    // Draw selection (marching ants)
    const selectionToDraw = toolState.selectionPreview ?? doc.selection;
    if (selectionToDraw.active && selectionToDraw.width > 0 && selectionToDraw.height > 0) {
      const dash = 4 / doc.camera.zoom;
      const offset = (performance.now() / 50) % (dash * 2);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1 / doc.camera.zoom;
      ctx.setLineDash([dash, dash]);
      ctx.lineDashOffset = -offset;
      ctx.strokeRect(
        selectionToDraw.x,
        selectionToDraw.y,
        selectionToDraw.width,
        selectionToDraw.height
      );
      ctx.restore();
    }

    const activeTool = toolRegistry[tool] ?? toolRegistry.pencil;
    if (activeTool.renderOverlay) {
      activeTool.renderOverlay(buildToolContext(), ctx);
    }

    ctx.restore();
  };

  const getCompositeOperation = (blendMode: BlendMode): GlobalCompositeOperation => {
    switch (blendMode) {
      case 'multiply':
      case 'screen':
      case 'overlay':
        return blendMode;
      case 'normal':
      default:
        return 'source-over';
    }
  };

  const getReferenceImage = (url: string) => {
    if (!url) return null;
    const cached = referenceImages.get(url);
    if (cached) return cached;

    const image = new Image();
    image.src = url;
    image.onload = () => render();
    referenceImages.set(url, image);
    return image;
  };

  const render2d = () => {
    if (!ctx || !canvas) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    // Apply camera transform
    ctx.translate(doc.camera.x, doc.camera.y);
    ctx.scale(doc.camera.zoom, doc.camera.zoom);

    // Draw layers sorted by zIndex (ascending - lower zIndex drawn first = behind)
    const pendingForLayer = toolState.isDrawing && layer?.id ? toolState.pendingPixels : null;
    const sortedLayers = [...doc.layers].sort((a, b) => a.zIndex - b.zIndex);
    
    for (const l of sortedLayers) {
      if (!l.visible) continue;

      ctx.globalAlpha = l.opacity;
      ctx.globalCompositeOperation = getCompositeOperation(l.blendMode ?? 'normal');

      if (l.type === 'reference') {
        const image = getReferenceImage(l.imageUrl);
        if (image && image.complete) {
          ctx.drawImage(image, 0, 0, doc.width, doc.height);
        }
        continue;
      }

      if (l.type !== 'grid2d') continue;

      // Draw each pixel
      for (let y = 0; y < l.height; y++) {
        for (let x = 0; x < l.width; x++) {
          const idx = y * l.width + x;
          let cell = l.data[idx];

          // Apply pending pixels for preview
          if (l.id === layer?.id && pendingForLayer) {
            const pending = pendingForLayer.get(idx);
            if (pending) cell = pending.newValue;
          }

          const mat = cell & 0xff;
          if (mat === 0) continue;

          const material = doc.palette[mat];
          if (!material) continue;

          // Unpack RGBA
          const color = material.color;
          const r = color & 0xff;
          const g = (color >> 8) & 0xff;
          const b = (color >> 16) & 0xff;
          const a = (color >> 24) & 0xff;

          ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // Draw grid + border + selection
    ctx.restore();
    renderOverlay(false);
  };

  const renderWebgl = () => {
    if (!webglRenderer) return;
    const surface = renderDocumentToSurface(
      doc,
      Array.from(toolState.pendingPixels.values()),
      layer?.id ?? null,
      toolState.isDrawing
    );
    webglRenderer.render(surface, doc.camera);
  };

  const renderIso = () => {
    if (!ctx || !canvas) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderDocumentIso(
      ctx,
      doc,
      canvas.clientWidth,
      canvas.clientHeight,
      doc.camera,
      {},
      showGrid,
      gridStep
    );
    // Note: selection and grid overlay not implemented for iso mode yet
  };

  const render = () => {
    // Iso mode uses its own renderer
    if (doc.viewMode === 'iso') {
      renderIso();
      return;
    }

    const hasReferenceLayer = doc.layers.some(layer => layer.type === 'reference' && layer.visible);
    if (hasReferenceLayer) {
      render2d();
      return;
    }
    
    if (useWebGL && webglRenderer) {
      renderWebgl();
      renderOverlay();
      return;
    }
    render2d();
  };
  
  // Keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          documentStore.redo();
        } else {
          documentStore.undo();
        }
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        stepZoom(1);
      } else if (e.key === '-') {
        e.preventDefault();
        stepZoom(-1);
      } else if (e.key === '0') {
        e.preventDefault();
        fitToWindow();
      } else if (e.key === 'y') {
        e.preventDefault();
        documentStore.redo();
      } else if (e.key === 'c') {
        e.preventDefault();
        documentStore.copySelection();
      } else if (e.key === 'x') {
        e.preventDefault();
        documentStore.cutSelection();
      } else if (e.key === 'v') {
        e.preventDefault();
        const cursor = get(uiStore.cursorPosition) as { x: number; y: number } | null;
        if (cursor) {
          documentStore.pasteSelection(cursor.x, cursor.y);
        } else {
          documentStore.pasteSelection();
        }
      }
    } else {
      if (e.code === 'Space') {
        e.preventDefault();
        isPanModifier = true;
        return;
      }

      const hotkeyTool = getToolByHotkey(e.key);
      if (hotkeyTool) {
        toolStore.activeTool.set(hotkeyTool.id);
      } else {
        switch (e.key.toLowerCase()) {
          case 'x': toolStore.swapMaterials(); break;
          case '[': toolStore.setBrushSize(settings.brushSize - 1); break;
          case ']': toolStore.setBrushSize(settings.brushSize + 1); break;
          case 'f': toolStore.toggleShapeFilled(); break;
        }
      }
    }
    render();
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      isPanModifier = false;
    }
  };
  
  onMount(() => {
    ctx = canvas.getContext('2d');
    webglRenderer = createWebglRenderer(webglCanvas);
    useWebGL = webglRenderer !== null;
    
    // Subscribe to stores
    const unsubs = [
      documentStore.subscribe(d => { doc = d; render(); }),
      toolStore.activeTool.subscribe(t => { tool = t; }),
      toolStore.settings.subscribe(s => { settings = s; }),
      toolStore.primaryMaterial.subscribe(m => { primaryMat = m; }),
      toolStore.secondaryMaterial.subscribe(m => { secondaryMat = m; }),
      activeLayer.subscribe(l => { layer = l as GridLayer | null; }),
      uiStore.showGrid.subscribe(g => { showGrid = g; render(); }),
      uiStore.gridStep.subscribe(step => { gridStep = step; render(); }),
      uiStore.cursorPosition.subscribe(pos => { cursorPosition = pos; }),
    ];
    
    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (webglCanvas) {
        webglCanvas.width = canvas.width;
        webglCanvas.height = canvas.height;
      }
      webglRenderer?.resize(canvas.width, canvas.height);
      render();
    });
    resizeObserver.observe(canvas);
    
    // Initial render
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (webglCanvas) {
      webglCanvas.width = canvas.width;
      webglCanvas.height = canvas.height;
    }
    webglRenderer?.resize(canvas.width, canvas.height);
    
    // Center the document
    documentStore.setCamera({
      x: canvas.clientWidth / 2 - doc.width * doc.camera.zoom / 2,
      y: canvas.clientHeight / 2 - doc.height * doc.camera.zoom / 2,
    });
    
    render();
    
    // Animation loop for smooth updates
    let frame = 0;
    const loop = () => {
      frame = requestAnimationFrame(loop);
      render();
    };
    loop();
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      unsubs.forEach(u => u());
      resizeObserver.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  });
</script>

<div class="canvas-stack">
  <canvas
    bind:this={webglCanvas}
    class="editor-canvas webgl"
  ></canvas>
  <canvas
    bind:this={canvas}
    class="editor-canvas overlay"
    style={`cursor: ${getCursorStyle()};`}
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onwheel={handleWheel}
    oncontextmenu={handleContextMenu}
  ></canvas>
</div>

<style>
  .canvas-stack {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .editor-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: block;
  }

  .editor-canvas.webgl {
    pointer-events: none;
  }

  .editor-canvas.overlay {
    touch-action: none;
  }
</style>
