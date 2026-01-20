<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { documentStore, toolStore, uiStore, activeLayer } from '$lib/stores';
  import { 
    bresenhamLine, 
    getBrushPoints, 
    floodFill, 
    createPaintDataFromPoints,
    getRectPoints,
    getEllipsePoints,
    magicWandSelect
  } from '$lib/tools';
  import { renderDocumentToSurface } from '$lib/render/render-surface';
  import { renderDocumentIso, screenToIso } from '$lib/render/render-iso';
  import { createWebglRenderer, type WebglRenderer } from '$lib/render/webgl-renderer';
  import type { GridLayer, EditorDocument, Selection } from '$lib/document/types';
  import { createRectSelection } from '$lib/document/types';
  import { mergeSelection, type SelectionOp } from '$lib/document/selection';
  import type { ToolId, ToolSettings } from '$lib/stores';

  let canvas: HTMLCanvasElement;
  let webglCanvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let webglRenderer: WebglRenderer | null = null;
  let useWebGL = false;
  let dpr = 1;
  
  // Local state from stores
  let doc: EditorDocument = get(documentStore);
  let tool: ToolId = get(toolStore.activeTool);
  let settings: ToolSettings = get(toolStore.settings);
  let primaryMat: number = get(toolStore.primaryMaterial);
  let secondaryMat: number = get(toolStore.secondaryMaterial);
  let layer: GridLayer | null = get(activeLayer) as GridLayer | null;
  let showGrid: boolean = get(uiStore.showGrid);
  let gridStep: number = get(uiStore.gridStep);
  
  // Canvas state
  let isPanning = false;
  let isDrawing = false;
  let isSelecting = false;
  let startPoint: { x: number; y: number } | null = null;
  let currentPoint: { x: number; y: number } | null = null;
  let lastPoint: { x: number; y: number } | null = null;
  let pendingPixels = new Map<number, { index: number; oldValue: number; newValue: number }>();
  const addPendingPixels = (pixels: Array<{ index: number; oldValue: number; newValue: number }>) => {
    for (const px of pixels) {
      const existing = pendingPixels.get(px.index);
      if (existing) {
        existing.newValue = px.newValue;
      } else {
        pendingPixels.set(px.index, { ...px });
      }
    }
  };
  let currentMaterial = 1;
  let selectionPreview: Selection | null = null;
  let selectionOp: SelectionOp = 'replace';
  
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

  const handlePointerDown = (e: PointerEvent) => {
    if (!layer || layer.type !== 'grid2d') return;
    
    const gridPos = screenToGrid(e.clientX, e.clientY);
    
    // Middle click or space = pan
    if (e.button === 1 || (e.button === 0 && tool === 'pan')) {
      isPanning = true;
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    
    // Right click = secondary material
    const mat = e.button === 2 ? secondaryMat : primaryMat;
    currentMaterial = mat;
    
    if (tool === 'eyedropper') {
      const idx = gridPos.y * layer.width + gridPos.x;
      if (idx >= 0 && idx < layer.data.length) {
        const pickedMat = layer.data[idx] & 0xff;
        toolStore.primaryMaterial.set(pickedMat);
      }
      return;
    }

    if (tool === 'select') {
      isSelecting = true;
      startPoint = gridPos;
      currentPoint = gridPos;
      selectionOp = getSelectionOp(e);
      selectionPreview = buildRectSelection(startPoint, currentPoint);
      canvas.setPointerCapture(e.pointerId);
      render();
      return;
    }

    if (tool === 'wand') {
      const result = magicWandSelect(layer.data, layer.width, layer.height, gridPos.x, gridPos.y, settings.tolerance);
      if (result) {
        const op = getSelectionOp(e);
        const wandSelection: Selection = {
          active: true,
          x: result.x,
          y: result.y,
          width: result.width,
          height: result.height,
          mask: result.mask,
        };
        const merged = mergeSelection(doc.selection, wandSelection, op, doc.width, doc.height);
        documentStore.select({ before: doc.selection, after: merged });
      }
      return;
    }
    
    if (tool === 'fill') {
      const points = floodFill(layer.data, layer.width, layer.height, gridPos.x, gridPos.y, mat, settings.tolerance);
      if (points.length > 0) {
        const paintData = createPaintDataFromPoints(layer.id, layer, points, mat);
        documentStore.fill(paintData);
      }
      return;
    }
    
    // Start drawing for shape tools
    if (tool === 'line' || tool === 'rect' || tool === 'ellipse') {
      isDrawing = true;
      startPoint = gridPos;
      currentPoint = gridPos;
      pendingPixels.clear();
      canvas.setPointerCapture(e.pointerId);
      updateShapePreview();
      render();
      return;
    }
    
    if (tool === 'pencil' || tool === 'eraser') {
      isDrawing = true;
      lastPoint = gridPos;
      pendingPixels.clear();
      canvas.setPointerCapture(e.pointerId);
      
      const brushMat = tool === 'eraser' ? 0 : mat;
      const points = getBrushPoints(gridPos.x, gridPos.y, settings.brushSize, settings.brushShape);
      const paintData = createPaintDataFromPoints(layer.id, layer, points, brushMat);
      addPendingPixels(paintData.pixels);
      
      render();
    }
  };
  
  const updateShapePreview = () => {
    if (!layer || !startPoint || !currentPoint) return;
    
    pendingPixels.clear();
    let points: { x: number; y: number }[] = [];
    
    if (tool === 'line') {
      points = bresenhamLine(startPoint.x, startPoint.y, currentPoint.x, currentPoint.y);
    } else if (tool === 'rect') {
      points = getRectPoints(startPoint.x, startPoint.y, currentPoint.x, currentPoint.y, settings.brushShape === 'square');
    } else if (tool === 'ellipse') {
      points = getEllipsePoints(startPoint.x, startPoint.y, currentPoint.x, currentPoint.y, settings.brushShape === 'square');
    }
    
    const paintData = createPaintDataFromPoints(layer.id, layer, points, currentMaterial);
    addPendingPixels(paintData.pixels);
  };
  
  const handlePointerMove = (e: PointerEvent) => {
    const gridPos = screenToGrid(e.clientX, e.clientY);
    uiStore.cursorPosition.set(gridPos);
    
    if (isPanning) {
      documentStore.setCamera({
        x: doc.camera.x + e.movementX,
        y: doc.camera.y + e.movementY,
      });
      return;
    }

    if (isSelecting && startPoint) {
      currentPoint = gridPos;
      const rectSelection = buildRectSelection(startPoint, currentPoint);
      selectionPreview = mergeSelection(doc.selection, rectSelection, selectionOp, doc.width, doc.height);
      render();
      return;
    }
    
    // Shape tools preview
    if (isDrawing && startPoint && (tool === 'line' || tool === 'rect' || tool === 'ellipse')) {
      currentPoint = gridPos;
      updateShapePreview();
      render();
      return;
    }
    
    if (isDrawing && lastPoint && layer && layer.type === 'grid2d') {
      const mat = tool === 'eraser' ? 0 : (e.buttons === 2 ? secondaryMat : primaryMat);
      
      // Interpolate between last point and current
      const linePoints = bresenhamLine(lastPoint.x, lastPoint.y, gridPos.x, gridPos.y);
      const allPoints: { x: number; y: number }[] = [];
      
      for (const lp of linePoints) {
        allPoints.push(...getBrushPoints(lp.x, lp.y, settings.brushSize, settings.brushShape));
      }
      
      const paintData = createPaintDataFromPoints(layer.id, layer, allPoints, mat);
      addPendingPixels(paintData.pixels);
      
      lastPoint = gridPos;
      render();
    }
  };
  
  const handlePointerUp = (e: PointerEvent) => {
    if (isPanning) {
      isPanning = false;
      canvas.releasePointerCapture(e.pointerId);
      return;
    }

    if (isSelecting) {
      isSelecting = false;
      canvas.releasePointerCapture(e.pointerId);

      if (selectionPreview) {
        documentStore.select({
          before: doc.selection,
          after: selectionPreview,
        });
      }

      selectionPreview = null;
      startPoint = null;
      currentPoint = null;
      return;
    }
    
    if (isDrawing && layer) {
      isDrawing = false;
      canvas.releasePointerCapture(e.pointerId);
      
      // Commit pending pixels
      if (pendingPixels.size > 0) {
        const payload = {
          layerId: layer.id,
          pixels: Array.from(pendingPixels.values()),
        };

        if (tool === 'eraser') {
          documentStore.erase(payload);
        } else {
          documentStore.paint(payload);
        }
        pendingPixels.clear();
      }
      
      startPoint = null;
      currentPoint = null;
      lastPoint = null;
    }
  };
  
  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.125, Math.min(8, doc.camera.zoom * zoomFactor));
    
    // Zoom toward cursor
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const localX = (e.clientX - rect.left) * scaleX;
    const localY = (e.clientY - rect.top) * scaleY;
    const viewX = localX / dpr;
    const viewY = localY / dpr;

    const worldX = (viewX - doc.camera.x) / doc.camera.zoom;
    const worldY = (viewY - doc.camera.y) / doc.camera.zoom;

    const newX = viewX - worldX * newZoom;
    const newY = viewY - worldY * newZoom;
    
    documentStore.setCamera({ x: newX, y: newY, zoom: newZoom });
  };
  
  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
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
    const selectionToDraw = selectionPreview ?? doc.selection;
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

    ctx.restore();
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

    // Draw layers
    const pendingForLayer = isDrawing && layer?.id ? pendingPixels : null;
    for (const l of doc.layers) {
      if (!l.visible || l.type !== 'grid2d') continue;

      ctx.globalAlpha = l.opacity;

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

      ctx.globalAlpha = 1;
    }

    // Draw grid + border + selection
    ctx.restore();
    renderOverlay(false);
  };

  const renderWebgl = () => {
    if (!webglRenderer) return;
    const surface = renderDocumentToSurface(
      doc,
      Array.from(pendingPixels.values()),
      layer?.id ?? null,
      isDrawing
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
      switch (e.key.toLowerCase()) {
        case 'b': toolStore.activeTool.set('pencil'); break;
        case 'e': toolStore.activeTool.set('eraser'); break;
        case 'g': toolStore.activeTool.set('fill'); break;
        case 'i': toolStore.activeTool.set('eyedropper'); break;
        case 'h': toolStore.activeTool.set('pan'); break;
        case 'm': toolStore.activeTool.set('select'); break;
        case 'w': toolStore.activeTool.set('wand'); break;
        case 'l': toolStore.activeTool.set('line'); break;
        case 'r': toolStore.activeTool.set('rect'); break;
        case 'o': toolStore.activeTool.set('ellipse'); break;
        case 'x': toolStore.swapMaterials(); break;
        case '[': toolStore.setBrushSize(settings.brushSize - 1); break;
        case ']': toolStore.setBrushSize(settings.brushSize + 1); break;
      }
    }
    render();
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
    
    return () => {
      unsubs.forEach(u => u());
      resizeObserver.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleKeyDown);
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
    cursor: crosshair;
    touch-action: none;
  }
</style>
