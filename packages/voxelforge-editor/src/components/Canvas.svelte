<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { documentStore, toolStore, uiStore, activeLayer } from '$lib/stores';
  import { toolRegistry, getToolByHotkey, type ToolRuntimeState, type ToolContext } from '$lib/tool-system';
  import { renderDocumentToSurface } from '$lib/render/render-surface';
  import { renderDocumentIso, screenToIso, ISO_DEFAULTS } from '$lib/render/render-iso';
  import { buildGreedyMeshFromDocument, type VoxelMesh } from '$lib/render/voxel-mesher';
  import { createVoxelMeshRenderer, type VoxelMeshRenderer } from '$lib/render/voxel-mesh-renderer';
  import { createWebglRenderer, type WebglRenderer } from '$lib/render/webgl-renderer';
  import { projectIso } from '@voxelyn/core';
  import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Cube, Minus, Plus } from 'phosphor-svelte';
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
  let voxelMeshRenderer: VoxelMeshRenderer | null = null;
  let voxelMeshCache: { key: string; mesh: VoxelMesh } | null = null;
  let view3dDirty = true;
  let view3dPointer = { x: 0, y: 0 };
  let view3dOrbiting = false;
  let view3dPanning = false;
  let fps = $state(0);
  let fpsSmoothed = 0;
  let fpsFrameCount = 0;
  let fpsLastTime = performance.now();
  let needsRender = true;
  let overlayNeedsRender = true;
  let lastOverlayFrame = 0;
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
  let lastDocDims = { width: 0, height: 0, depth: 0 };
  let lastViewMode = '2d' as EditorDocument['viewMode'];

  const invalidateRender = () => {
    needsRender = true;
    overlayNeedsRender = true;
  };

  type AnchorPoint = {
    id: string;
    name: string;
    yaw: number;
    pitch: number;
    distance: number;
    target: { x: number; y: number; z: number };
  };

  let customAnchors: AnchorPoint[] = [];
  let anchorPoints = $state<AnchorPoint[]>([]);
  let view3d = $state({
    yaw: 0.8,
    pitch: -0.45,
    distance: 220,
    target: { x: 0, y: 0, z: 0 },
  });
  let lightDir = $state({ x: -0.4, y: 0.8, z: 0.3 });

  const view3dSettings = {
    fov: 0.9,
    near: 0.1,
    far: 5000,
  };
  
  // Horizon line position in 3D grid as a ratio of maxZ depth (0.0 = front, 1.0 = back)
  // This creates a visual reference line at 60% depth to help with spatial orientation
  const HORIZON_LINE_RATIO = 0.6;
  
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
    if (doc.viewMode === '3d') {
      handlePointerDown3d(e);
      return;
    }
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
    if (doc.viewMode === '3d') {
      handlePointerMove3d(e);
      return;
    }
    const gridPos = screenToGrid(e.clientX, e.clientY);
    cursorPosition = gridPos;
    uiStore.cursorPosition.set(gridPos);

    const toolCtx = buildToolContext();
    const activeToolId = toolState.activePointerToolId ?? tool;
    const activeTool = toolRegistry[activeToolId] ?? toolRegistry.pencil;
    activeTool.onPointerMove(toolCtx, e);
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (doc.viewMode === '3d') {
      handlePointerUp3d(e);
      return;
    }
    const toolCtx = buildToolContext();
    const activeToolId = toolState.activePointerToolId ?? tool;
    const activeTool = toolRegistry[activeToolId] ?? toolRegistry.pencil;
    activeTool.onPointerUp(toolCtx, e);
    toolState.activePointerToolId = null;
  };
  
  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();

    if (doc.viewMode === '3d') {
      const next = e.deltaY > 0 ? view3d.distance * 1.1 : view3d.distance * 0.9;
      view3d.distance = Math.max(20, Math.min(2000, next));
      view3dDirty = true;
      invalidateRender();
      render();
      return;
    }
    
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
    invalidateRender();
  };

  const stepZoom = (delta: number) => {
    const currentIndex = getNearestZoomIndex(doc.camera.zoom);
    const nextIndex = Math.max(0, Math.min(zoomLevels.length - 1, currentIndex + delta));
    const nextZoom = zoomLevels[nextIndex];
    const viewX = canvas.clientWidth / 2;
    const viewY = canvas.clientHeight / 2;
    applyZoomAt(viewX, viewY, nextZoom);
    invalidateRender();
  };

  const fitToWindow = () => {
    const zoomX = canvas.clientWidth / doc.width;
    const zoomY = canvas.clientHeight / doc.height;
    const newZoom = Math.max(0.125, Math.min(8, Math.min(zoomX, zoomY)));
    const newX = canvas.clientWidth / 2 - doc.width * newZoom / 2;
    const newY = canvas.clientHeight / 2 - doc.height * newZoom / 2;
    documentStore.setCamera({ x: newX, y: newY, zoom: newZoom });
    invalidateRender();
  };
  
  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  const getCursorStyle = () => {
    if (doc.viewMode === '3d') return view3dPanning ? 'grabbing' : 'grab';
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
    image.onload = () => {
      invalidateRender();
      render();
    };
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
    renderIsoOverlay();
  };

  const renderIsoOverlay = () => {
    if (!ctx || !canvas) return;

    const selectionToDraw = toolState.selectionPreview ?? doc.selection;
    if (!selectionToDraw.active || selectionToDraw.width <= 0 || selectionToDraw.height <= 0) {
      return;
    }

    const { tileW, tileH, zStep, baselineZ } = ISO_DEFAULTS;
    const centerX = canvas.clientWidth / 2 + doc.camera.x;
    const centerY = canvas.clientHeight / 3 + doc.camera.y;

    const x0 = selectionToDraw.x;
    const y0 = selectionToDraw.y;
    const x1 = selectionToDraw.x + selectionToDraw.width;
    const y1 = selectionToDraw.y + selectionToDraw.height;

    const p1 = projectIso(x0, y0, baselineZ, tileW, tileH, zStep);
    const p2 = projectIso(x1, y0, baselineZ, tileW, tileH, zStep);
    const p3 = projectIso(x1, y1, baselineZ, tileW, tileH, zStep);
    const p4 = projectIso(x0, y1, baselineZ, tileW, tileH, zStep);

    ctx.save();
    ctx.scale(doc.camera.zoom, doc.camera.zoom);
    ctx.translate(centerX / doc.camera.zoom, centerY / doc.camera.zoom);

    const dash = 4 / doc.camera.zoom;
    const offset = (performance.now() / 50) % (dash * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1 / doc.camera.zoom;
    ctx.setLineDash([dash, dash]);
    ctx.lineDashOffset = -offset;

    ctx.beginPath();
    ctx.moveTo(p1.sx, p1.sy);
    ctx.lineTo(p2.sx, p2.sy);
    ctx.lineTo(p3.sx, p3.sy);
    ctx.lineTo(p4.sx, p4.sy);
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  };

  const getDefaultAnchors = (): AnchorPoint[] => {
    const center = { x: doc.width / 2, y: doc.height / 2, z: doc.depth / 2 };
    const baseDistance = Math.max(doc.width, doc.height, doc.depth) * 1.6;
    return [
      { id: 'center', name: 'Center', yaw: 0.8, pitch: -0.45, distance: baseDistance, target: center },
      { id: 'top', name: 'Top', yaw: 0, pitch: -1.25, distance: baseDistance, target: center },
      { id: 'front', name: 'Front', yaw: 0, pitch: -0.1, distance: baseDistance, target: center },
      { id: 'side', name: 'Side', yaw: Math.PI / 2, pitch: -0.1, distance: baseDistance, target: center },
    ];
  };

  const syncAnchors = () => {
    anchorPoints = [...getDefaultAnchors(), ...customAnchors];
  };

  const applyAnchor = (anchor: AnchorPoint) => {
    view3d = {
      yaw: anchor.yaw,
      pitch: anchor.pitch,
      distance: anchor.distance,
      target: { ...anchor.target },
    };
    view3dDirty = true;
    invalidateRender();
    render();
  };

  let anchorIdCounter = 0;

  const generateAnchorId = (): string => {
    // Prefer crypto.randomUUID when available for strong uniqueness guarantees
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `anchor_${crypto.randomUUID()}`;
    }

    // Fallback: use a monotonically increasing counter combined with randomness
    anchorIdCounter += 1;
    const randomPart = Math.random().toString(36).slice(2, 10);
    return `anchor_${anchorIdCounter.toString(36)}_${randomPart}`;
  };

  const addAnchor = () => {
    const id = generateAnchorId();
    const next: AnchorPoint = {
      id,
      name: `Anchor ${customAnchors.length + 1}`,
      yaw: view3d.yaw,
      pitch: view3d.pitch,
      distance: view3d.distance,
      target: { ...view3d.target },
    };
    customAnchors = [...customAnchors, next];
    syncAnchors();
  };

  const snapAxis = (axis: 'x' | 'y' | 'z') => {
    if (axis === 'x') {
      view3d.yaw = Math.PI / 2;
      view3d.pitch = -0.1;
    } else if (axis === 'y') {
      view3d.yaw = 0;
      view3d.pitch = -1.25;
    } else {
      view3d.yaw = 0;
      view3d.pitch = -0.1;
    }
    view3dDirty = true;
    invalidateRender();
    render();
  };

  const nudgeTarget = (dx: number, dy: number, dz: number) => {
    view3d.target = {
      x: view3d.target.x + dx,
      y: view3d.target.y + dy,
      z: view3d.target.z + dz,
    };
    view3dDirty = true;
    invalidateRender();
    render();
  };

  const zoom3d = (direction: number) => {
    const factor = direction > 0 ? 0.85 : 1.15;
    view3d.distance = Math.max(20, Math.min(2000, view3d.distance * factor));
    view3dDirty = true;
    render();
  };

  const getViewBasis = () => {
    const cosPitch = Math.cos(view3d.pitch);
    const sinPitch = Math.sin(view3d.pitch);
    const cosYaw = Math.cos(view3d.yaw);
    const sinYaw = Math.sin(view3d.yaw);
    const camera = {
      x: view3d.target.x + cosPitch * cosYaw * view3d.distance,
      y: view3d.target.y + sinPitch * view3d.distance,
      z: view3d.target.z + cosPitch * sinYaw * view3d.distance,
    };
    const forward = {
      x: view3d.target.x - camera.x,
      y: view3d.target.y - camera.y,
      z: view3d.target.z - camera.z,
    };
    const len = Math.hypot(forward.x, forward.y, forward.z) || 1;
    const f = { x: forward.x / len, y: forward.y / len, z: forward.z / len };
    const upWorld = { x: 0, y: 1, z: 0 };
    const right = {
      x: f.y * upWorld.z - f.z * upWorld.y,
      y: f.z * upWorld.x - f.x * upWorld.z,
      z: f.x * upWorld.y - f.y * upWorld.x,
    };
    const rLen = Math.hypot(right.x, right.y, right.z) || 1;
    const r = { x: right.x / rLen, y: right.y / rLen, z: right.z / rLen };
    const up = {
      x: r.y * f.z - r.z * f.y,
      y: r.z * f.x - r.x * f.z,
      z: r.x * f.y - r.y * f.x,
    };
    return { camera, forward: f, right: r, up };
  };

  let lastViewProj: Float32Array | null = null;

  /**
   * Multiplies two 4x4 matrices (a × b).
   * 
   * Matrix Layout Convention: Column-major order (OpenGL/WebGL standard)
   * - Matrices are stored as 16-element Float32Arrays
   * - Elements are indexed as: [m0, m1, m2, m3, m4, m5, ..., m15]
   * - Column 0: [m0, m1, m2, m3], Column 1: [m4, m5, m6, m7], etc.
   * - This matches WebGL's uniform matrix layout
   * 
   * Algorithm: Standard matrix multiplication C = A × B
   * - For each row i of A and column j of B:
   *   C[i,j] = A[i,0]*B[0,j] + A[i,1]*B[1,j] + A[i,2]*B[2,j] + A[i,3]*B[3,j]
   * 
   * @param a - Left matrix (16 elements, column-major)
   * @param b - Right matrix (16 elements, column-major)
   * @returns Result matrix a × b (16 elements, column-major)
   */
  const multiplyMat4 = (a: Float32Array, b: Float32Array): Float32Array => {
    const out = new Float32Array(16);
    for (let i = 0; i < 4; i += 1) {
      const ai0 = a[i];
      const ai1 = a[i + 4];
      const ai2 = a[i + 8];
      const ai3 = a[i + 12];
      out[i] = ai0 * b[0] + ai1 * b[1] + ai2 * b[2] + ai3 * b[3];
      out[i + 4] = ai0 * b[4] + ai1 * b[5] + ai2 * b[6] + ai3 * b[7];
      out[i + 8] = ai0 * b[8] + ai1 * b[9] + ai2 * b[10] + ai3 * b[11];
      out[i + 12] = ai0 * b[12] + ai1 * b[13] + ai2 * b[14] + ai3 * b[15];
    }
    return out;
  };

  /**
   * Creates a perspective projection matrix for 3D rendering.
   * 
   * Matrix Layout: Column-major order (OpenGL/WebGL standard)
   * 
   * Mathematical Formula (based on standard perspective projection):
   * The returned matrix transforms view-space coordinates to clip-space coordinates.
   * After perspective division (dividing by w), this creates the perspective effect where
   * distant objects appear smaller.
   * 
   * Matrix structure (column-major):
   * [ cot/aspect    0            0               0     ]
   * [     0        cot           0               0     ]
   * [     0         0     (far+near)/(near-far)  -1    ]
   * [     0         0    2*far*near/(near-far)   0     ]
   * 
   * Where:
   * - cot = 1.0 / tan(fov/2)  (cotangent of half the field of view)
   * - near = near plane distance
   * - far = far plane distance
   * 
   * Reference: This implements the standard OpenGL perspective projection matrix.
   * See: https://www.khronos.org/opengl/wiki/GluPerspective_code
   * 
   * @param fov - Field of view angle in radians
   * @param aspect - Aspect ratio (width / height)
   * @param near - Near clipping plane distance (must be positive)
   * @param far - Far clipping plane distance (must be positive, > near)
   * @returns 4x4 perspective projection matrix (16 elements, column-major)
   */
  const makePerspective = (fov: number, aspect: number, near: number, far: number): Float32Array => {
    const f = 1.0 / Math.tan(fov / 2);
    const nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0,
    ]);
  };

  /**
   * Creates a view matrix (camera matrix) that transforms world coordinates to camera/view space.
   * This implements the "look-at" camera model, positioning the camera at 'eye' looking toward 'target'.
   * 
   * Matrix Layout: Column-major order (OpenGL/WebGL standard)
   * 
   * Algorithm:
   * 1. Compute the forward vector (z-axis): normalized(eye - target)
   *    - Points from target to eye (OpenGL right-handed convention)
   * 
   * 2. Compute the right vector (x-axis): normalized(worldUp × forward)
   *    - Cross product of world up vector (0, 1, 0) with forward
   *    - Creates a vector pointing to the camera's right
   * 
   * 3. Compute the up vector (y-axis): forward × right
   *    - Cross product ensures orthogonality
   *    - Creates the camera's local up direction
   * 
   * 4. Build the view matrix from the orthonormal basis (right, up, forward) and eye position:
   *    Matrix structure (column-major):
   *    [ right.x    up.x    forward.x    0 ]
   *    [ right.y    up.y    forward.y    0 ]
   *    [ right.z    up.z    forward.z    0 ]
   *    [ -dot(right,eye)  -dot(up,eye)  -dot(forward,eye)  1 ]
   * 
   * The translation components (last column in row-major, last row in column-major)
   * are negative dot products because we're transforming the world relative to the camera,
   * not the camera relative to the world.
   * 
   * Reference: Standard "look-at" view matrix construction
   * See: https://www.khronos.org/opengl/wiki/GluLookAt_code
   * 
   * @param eye - Camera position in world space
   * @param target - Point the camera is looking at in world space
   * @returns 4x4 view matrix (16 elements, column-major)
   */
  const makeLookAt = (eye: { x: number; y: number; z: number }, target: { x: number; y: number; z: number }) => {
    const zx = eye.x - target.x;
    const zy = eye.y - target.y;
    const zz = eye.z - target.z;
    const zLen = Math.hypot(zx, zy, zz) || 1;
    const zxN = zx / zLen;
    const zyN = zy / zLen;
    const zzN = zz / zLen;

    const upX = 0;
    const upY = 1;
    const upZ = 0;

    const xx = upY * zzN - upZ * zyN;
    const xy = upZ * zxN - upX * zzN;
    const xz = upX * zyN - upY * zxN;
    const xLen = Math.hypot(xx, xy, xz) || 1;
    const x0 = xx / xLen;
    const x1 = xy / xLen;
    const x2 = xz / xLen;

    const y0 = zyN * x2 - zzN * x1;
    const y1 = zzN * x0 - zxN * x2;
    const y2 = zxN * x1 - zyN * x0;

    return new Float32Array([
      x0, y0, zxN, 0,
      x1, y1, zyN, 0,
      x2, y2, zzN, 0,
      -(x0 * eye.x + x1 * eye.y + x2 * eye.z),
      -(y0 * eye.x + y1 * eye.y + y2 * eye.z),
      -(zxN * eye.x + zyN * eye.y + zzN * eye.z),
      1,
    ]);
  };

  const buildViewProjection = () => {
    if (!canvas) {
      return new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]);
    }
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    const aspect = width / height;
    const proj = makePerspective(view3dSettings.fov, aspect, view3dSettings.near, view3dSettings.far);
    const { camera } = getViewBasis();
    const view = makeLookAt(camera, view3d.target);
    return multiplyMat4(proj, view);
  };

  const handlePointerDown3d = (e: PointerEvent) => {
    e.preventDefault();
    view3dPointer = { x: e.clientX, y: e.clientY };
    view3dPanning = e.button === 2 || isPanModifier;
    view3dOrbiting = !view3dPanning;
    canvas.setPointerCapture(e.pointerId);
  };

  const handlePointerMove3d = (e: PointerEvent) => {
    if (!view3dOrbiting && !view3dPanning) return;
    const dx = e.clientX - view3dPointer.x;
    const dy = e.clientY - view3dPointer.y;
    view3dPointer = { x: e.clientX, y: e.clientY };

    if (view3dOrbiting) {
      view3d.yaw += dx * 0.008;
      view3d.pitch = Math.max(-1.4, Math.min(1.2, view3d.pitch + dy * 0.008));
    } else if (view3dPanning) {
      const { right, up } = getViewBasis();
      const panScale = view3d.distance * 0.002;
      view3d.target = {
        x: view3d.target.x - right.x * dx * panScale + up.x * dy * panScale,
        y: view3d.target.y - right.y * dx * panScale + up.y * dy * panScale,
        z: view3d.target.z - right.z * dx * panScale + up.z * dy * panScale,
      };
    }
    view3dDirty = true;
    invalidateRender();
    render();
  };

  const handlePointerUp3d = (e: PointerEvent) => {
    view3dOrbiting = false;
    view3dPanning = false;
    canvas.releasePointerCapture(e.pointerId);
  };

  const render3d = () => {
    if (!ctx || !canvas || !voxelMeshRenderer) return;

    const lightKey = `${lightDir.x.toFixed(2)}:${lightDir.y.toFixed(2)}:${lightDir.z.toFixed(2)}`;
    const layersKey = JSON.stringify(
      doc.layers.map((layer: any) => ({
        v: layer.visible ?? true,
        m:
          layer.meta?.modified ??
          layer.modified ??
          layer.version ??
          layer.updatedAt ??
          0,
      }))
    );
    const paletteKey =
      (doc.palette as any)?.version ??
      (doc.palette as any)?.meta?.modified ??
      JSON.stringify(doc.palette);
    const gridKey = `${doc.meta.modified}-${layersKey}-${paletteKey}-${lightKey}`;
    if (!voxelMeshCache || voxelMeshCache.key !== gridKey) {
      const mesh = buildGreedyMeshFromDocument(doc, doc.palette, lightDir);
      voxelMeshCache = { key: gridKey, mesh };
      voxelMeshRenderer.setMesh(mesh);
    }

    const viewProj = buildViewProjection();
    lastViewProj = viewProj;
    voxelMeshRenderer.render(viewProj);

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    draw3dGrid();
    ctx.restore();

    view3dDirty = false;
  };

  const project3dPoint = (point: { x: number; y: number; z: number }) => {
    if (!canvas || !lastViewProj) return null;
    const m = lastViewProj;
    const x = point.x;
    const y = point.y;
    const z = point.z;
    const clipX = m[0] * x + m[4] * y + m[8] * z + m[12];
    const clipY = m[1] * x + m[5] * y + m[9] * z + m[13];
    const clipW = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (clipW <= 0.0001) return null;
    const ndcX = clipX / clipW;
    const ndcY = clipY / clipW;
    const screenX = (ndcX * 0.5 + 0.5) * canvas.clientWidth;
    const screenY = (1 - (ndcY * 0.5 + 0.5)) * canvas.clientHeight;
    return { x: screenX, y: screenY };
  };

  const draw3dGrid = () => {
    if (!ctx || !canvas) return;
    const gridY = 0;
    const step = Math.max(1, Math.floor(Math.max(doc.width, doc.depth) / 16));
    const maxX = doc.width;
    const maxZ = doc.depth;

    ctx.save();
    ctx.strokeStyle = 'rgba(120, 140, 180, 0.25)';
    ctx.lineWidth = 1;

    for (let x = 0; x <= maxX; x += step) {
      const p1 = project3dPoint({ x, y: gridY, z: 0 });
      const p2 = project3dPoint({ x, y: gridY, z: maxZ });
      if (!p1 || !p2) continue;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    for (let z = 0; z <= maxZ; z += step) {
      const p1 = project3dPoint({ x: 0, y: gridY, z });
      const p2 = project3dPoint({ x: maxX, y: gridY, z });
      if (!p1 || !p2) continue;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    const horizonZ = maxZ * HORIZON_LINE_RATIO;
    const h1 = project3dPoint({ x: 0, y: gridY, z: horizonZ });
    const h2 = project3dPoint({ x: maxX, y: gridY, z: horizonZ });
    if (h1 && h2) {
      ctx.strokeStyle = 'rgba(220, 230, 255, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(h1.x, h1.y);
      ctx.lineTo(h2.x, h2.y);
      ctx.stroke();
    }

    ctx.restore();
  };

  const render = () => {
    // Iso mode uses its own renderer
    if (doc.viewMode === 'iso') {
      renderIso();
      needsRender = false;
      return;
    }

    if (doc.viewMode === '3d') {
      render3d();
      needsRender = false;
      return;
    }

    const hasReferenceLayer = doc.layers.some(layer => layer.type === 'reference' && layer.visible);
    if (hasReferenceLayer) {
      render2d();
      needsRender = false;
      return;
    }
    
    if (useWebGL && webglRenderer) {
      renderWebgl();
      renderOverlay();
      needsRender = false;
      return;
    }
    render2d();
    needsRender = false;
  };

  const shouldAnimateSelection = () => {
    if (doc.viewMode === '3d') return false;
    const selection = toolState.selectionPreview ?? doc.selection;
    return selection.active && selection.width > 0 && selection.height > 0;
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
    voxelMeshRenderer = createVoxelMeshRenderer(webglCanvas);
    useWebGL = webglRenderer !== null;
    
    // Subscribe to stores
    const unsubs = [
      documentStore.subscribe(d => {
        doc = d;
        const dimsChanged =
          d.width !== lastDocDims.width ||
          d.height !== lastDocDims.height ||
          d.depth !== lastDocDims.depth;
        const viewModeChanged = lastViewMode !== d.viewMode;
        if (dimsChanged || (viewModeChanged && d.viewMode === '3d')) {
          view3d.target = { x: d.width / 2, y: d.height / 2, z: d.depth / 2 };
        }
        lastDocDims = { width: d.width, height: d.height, depth: d.depth };
        lastViewMode = d.viewMode;
        view3dDirty = true;
        if (d.viewMode === '3d') {
          uiStore.cursorPosition.set(null);
        }
        syncAnchors();
        invalidateRender();
        render();
      }),
      toolStore.activeTool.subscribe(t => { tool = t; }),
      toolStore.settings.subscribe(s => { settings = s; }),
      toolStore.primaryMaterial.subscribe(m => { primaryMat = m; }),
      toolStore.secondaryMaterial.subscribe(m => { secondaryMat = m; }),
      activeLayer.subscribe(l => { layer = l as GridLayer | null; }),
      uiStore.showGrid.subscribe(g => { showGrid = g; invalidateRender(); render(); }),
      uiStore.gridStep.subscribe(step => { gridStep = step; invalidateRender(); render(); }),
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
      voxelMeshRenderer?.resize(canvas.width, canvas.height);
      view3dDirty = true;
      invalidateRender();
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
    voxelMeshRenderer?.resize(canvas.width, canvas.height);
    
    // Center the document
    documentStore.setCamera({
      x: canvas.clientWidth / 2 - doc.width * doc.camera.zoom / 2,
      y: canvas.clientHeight / 2 - doc.height * doc.camera.zoom / 2,
    });
    
    syncAnchors();
    invalidateRender();
    render();
    
    // Animation loop for smooth updates
    let frame = 0;
    const loop = () => {
      frame = requestAnimationFrame(loop);
      const now = performance.now();
      fpsFrameCount += 1;
      const elapsed = now - fpsLastTime;
      if (elapsed >= 400) {
        const currentFps = (fpsFrameCount / elapsed) * 1000;
        fpsSmoothed = fpsSmoothed === 0 ? currentFps : fpsSmoothed * 0.8 + currentFps * 0.2;
        fps = Math.round(fpsSmoothed);
        fpsFrameCount = 0;
        fpsLastTime = now;
      }

      // TODO: test performance impact of this with different framerates
      if (shouldAnimateSelection() && now - lastOverlayFrame >= 1000 / 60) {
        overlayNeedsRender = true;
        lastOverlayFrame = now;
      }

      // Promote 3D dirtiness into a one-shot render request to avoid continuous re-renders.
      if (doc.viewMode === '3d' && view3dDirty) {
        needsRender = true;
        view3dDirty = false;
      }

      if (needsRender || overlayNeedsRender) {
        render();
        overlayNeedsRender = false;
      }
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

  {#if doc.viewMode === '3d'}
    <div class="view-3d-overlay">
      <div class="view-3d-card">
        <div class="view-3d-title"><Cube size={16} weight="fill" /> 3D Navigator</div>

        <div class="view-3d-axis">
          <button onclick={() => snapAxis('x')}>X</button>
          <button onclick={() => snapAxis('y')}>Y</button>
          <button onclick={() => snapAxis('z')}>Z</button>
        </div>

        <div class="view-3d-pan">
          <button onclick={() => nudgeTarget(0, -Math.max(1, view3d.distance * 0.02), 0)} title="Pan up"><ArrowUp size={14} weight="bold" /></button>
          <div class="pan-row">
            <button onclick={() => nudgeTarget(-Math.max(1, view3d.distance * 0.02), 0, 0)} title="Pan left"><ArrowLeft size={14} weight="bold" /></button>
            <button
              class="pan-center"
              onclick={() => anchorPoints[0] && applyAnchor(anchorPoints[0])}
              title="Center view"
            >•</button>
            <button onclick={() => nudgeTarget(Math.max(1, view3d.distance * 0.02), 0, 0)} title="Pan right"><ArrowRight size={14} weight="bold" /></button>
          </div>
          <button onclick={() => nudgeTarget(0, Math.max(1, view3d.distance * 0.02), 0)} title="Pan down"><ArrowDown size={14} weight="bold" /></button>
        </div>

        <div class="view-3d-zoom">
          <button onclick={() => zoom3d(-1)} title="Zoom out"><Minus size={14} weight="bold" /></button>
          <span>{Math.round(view3d.distance)}</span>
          <button onclick={() => zoom3d(1)} title="Zoom in"><Plus size={14} weight="bold" /></button>
        </div>

        <div class="view-3d-anchors">
          <div class="anchors-header">
            <span>Anchors</span>
            <button class="anchor-add" onclick={addAnchor} title="Add anchor"><Plus size={12} weight="bold" /></button>
          </div>
          <div class="anchors-grid">
            {#each anchorPoints as anchor}
              <button class="anchor-btn" onclick={() => applyAnchor(anchor)}>{anchor.name}</button>
            {/each}
          </div>
        </div>

        <div class="view-3d-light">
          <div class="anchors-header">
            <span>Light</span>
          </div>
          <div class="light-sliders">
            <label>
              X
              <input
                type="range"
                min="-1"
                max="1"
                step="0.05"
                value={lightDir.x}
                oninput={(e) => {
                  lightDir = { ...lightDir, x: parseFloat(e.currentTarget.value) };
                  voxelMeshCache = null;
                  invalidateRender();
                  render();
                }}
              />
            </label>
            <label>
              Y
              <input
                type="range"
                min="-1"
                max="1"
                step="0.05"
                value={lightDir.y}
                oninput={(e) => {
                  lightDir = { ...lightDir, y: parseFloat(e.currentTarget.value) };
                  voxelMeshCache = null;
                  invalidateRender();
                  render();
                }}
              />
            </label>
            <label>
              Z
              <input
                type="range"
                min="-1"
                max="1"
                step="0.05"
                value={lightDir.z}
                oninput={(e) => {
                  lightDir = { ...lightDir, z: parseFloat(e.currentTarget.value) };
                  voxelMeshCache = null;
                  invalidateRender();
                  render();
                }}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
    <div class="view-3d-fps">{fps} FPS</div>
  {/if}
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

  .view-3d-overlay {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 4;
    pointer-events: none;
  }

  .view-3d-fps {
    position: absolute;
    right: 12px;
    bottom: 12px;
    z-index: 4;
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(12, 12, 20, 0.85);
    color: #cdd3ff;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.2px;
    border: 1px solid #2b2b3f;
    pointer-events: none;
  }

  .view-3d-card {
    pointer-events: auto;
    background: rgba(20, 20, 32, 0.92);
    border: 1px solid #2b2b3f;
    border-radius: 10px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 180px;
    color: #cbd2ff;
    font-size: 12px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(6px);
  }

  .view-3d-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    color: #fff;
  }

  .view-3d-axis {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .view-3d-axis button {
    border: none;
    border-radius: 6px;
    background: #1e1e30;
    color: #9aa0b2;
    font-size: 11px;
    font-weight: 600;
    padding: 6px 0;
    cursor: pointer;
  }

  .view-3d-axis button:hover {
    background: #303050;
    color: #fff;
  }

  .view-3d-pan {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .view-3d-pan button {
    width: 28px;
    height: 24px;
    border: none;
    border-radius: 6px;
    background: #1a1a2e;
    color: #d6dbff;
    cursor: pointer;
  }

  .view-3d-pan button:hover {
    background: #2b2b54;
  }

  .pan-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .pan-center {
    width: 28px;
    height: 24px;
    border: 1px solid #343456;
    background: #141425;
    color: #fff;
    font-weight: 700;
  }

  .view-3d-zoom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #141425;
    border-radius: 8px;
    padding: 6px 8px;
  }

  .view-3d-zoom button {
    width: 26px;
    height: 26px;
    border: none;
    border-radius: 6px;
    background: #1f1f33;
    color: #fff;
    cursor: pointer;
  }

  .view-3d-zoom button:hover {
    background: #303050;
  }

  .view-3d-anchors {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .view-3d-light {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .light-sliders {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .light-sliders label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 11px;
    color: #9aa0b2;
  }

  .light-sliders input[type="range"] {
    flex: 1;
    accent-color: #6a6aae;
  }

  .anchors-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: #9aa0b2;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  .anchor-add {
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 6px;
    background: #2b2b54;
    color: #fff;
    cursor: pointer;
  }

  .anchors-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .anchor-btn {
    border: none;
    border-radius: 6px;
    background: #1a1a2e;
    color: #cdd3ff;
    font-size: 11px;
    padding: 4px 8px;
    cursor: pointer;
  }

  .anchor-btn:hover {
    background: #2b2b54;
    color: #fff;
  }
</style>
