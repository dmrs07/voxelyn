/**
 * VoxelForge Editor - Global Stores
 * Svelte 5 runes-compatible stores
 */

import { writable, derived, get } from 'svelte/store';
import { 
  createDocument, 
  type EditorDocument, 
  type LayerId, 
  type ViewMode,
  type GridLayer,
  type Layer,
  type Selection,
  type VoxelLayer,
  createGridLayer,
  createVoxelLayer,
  createReferenceLayer,
  createLayerId
} from './document/types';
import { 
  createHistory, 
  executeCommand, 
  undo as undoCommand, 
  redo as redoCommand,
  createPaintCommand,
  createEraseCommand,
  createFillCommand,
  createPasteCommand,
  createSelectionCommand,
  createTransformCommand,
  createAddLayerCommand,
  createDeleteLayerCommand,
  createToggleVisibilityCommand,
  createToggleLockCommand,
  createSetZIndexCommand,
  createSetIsoHeightCommand,
  createSetOpacityCommand,
  createSetBlendModeCommand,
  createRenameLayerCommand,
  createReorderLayersCommand,
  createMergeDownCommand,
  createFlattenGridLayersCommand,
  type HistoryState,
  type Command,
  type PaintData,
  type SelectionData,
  type TransformData,
} from './document/commands';
import { 
  saveDocumentToFile, 
  loadDocumentFromFile, 
  exportLayerAsPNG 
} from './document/serialization';
import {
  type ClipboardData,
} from './document/clipboard';
import {
  buildClipboardFromFloating,
  buildFloatingTransformData,
  createFloatingFromClipboard,
  createFloatingFromSelection,
  flipFloatingSelection,
  getFloatingSelection,
  moveFloatingSelection,
  rotateFloatingSelection,
  type FloatingSelectionSession,
} from './document/floating-selection';
import { projectStore } from './project/store';
import { worldStore } from './world/store';

// ============================================================================
// Document Store
// ============================================================================

export type FloatingCommitReason = 'enter' | 'tool-switch' | 'outside-click' | 'save' | 'export' | 'view-change' | 'layer-change';
type PaintableLayer = GridLayer | VoxelLayer;

const isPaintableLayer = (layer: Layer | undefined): layer is PaintableLayer =>
  Boolean(layer && (layer.type === 'grid2d' || layer.type === 'voxel3d'));

const masksEqual = (a?: Uint8Array, b?: Uint8Array): boolean => {
  if (!a && !b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const selectionsEqual = (a: Selection, b: Selection): boolean =>
  a.active === b.active &&
  a.x === b.x &&
  a.y === b.y &&
  a.width === b.width &&
  a.height === b.height &&
  masksEqual(a.mask, b.mask);

const createDocumentStore = () => {
  const doc = writable<EditorDocument>(createDocument(128, 128, 32, 'Untitled'));
  const history = writable<HistoryState>(createHistory(100));
  const floating = writable<FloatingSelectionSession | null>(null);
  let clipboard: ClipboardData | null = null;

  const getActivePaintableLayer = (currentDoc: EditorDocument): PaintableLayer | null => {
    const layer = currentDoc.layers.find(l => l.id === currentDoc.activeLayerId);
    if (!isPaintableLayer(layer) || layer.locked) return null;
    return layer;
  };

  const applyCommand = (command: Command): void => {
    const currentDoc = get(doc);
    const currentHistory = get(history);
    const result = executeCommand(currentHistory, currentDoc, command);
    doc.set(result.doc);
    history.set(result.history);
  };

  const commitFloatingInternal = (_reason: FloatingCommitReason): boolean => {
    const currentFloating = get(floating);
    if (!currentFloating) return false;

    const currentDoc = get(doc);
    const layer = currentDoc.layers.find(l => l.id === currentFloating.layerId);
    if (!layer || (layer.type !== 'grid2d' && layer.type !== 'voxel3d')) {
      floating.set(null);
      return false;
    }

    const transformData = buildFloatingTransformData(currentFloating, layer.data);
    const selectionAfter = getFloatingSelection(currentFloating);
    const noPixelsChanged = transformData.pixels.length === 0;
    const noSelectionChanged = selectionsEqual(currentFloating.selectionBefore, selectionAfter);

    if (noPixelsChanged && noSelectionChanged) {
      floating.set(null);
      return true;
    }

    const command = createTransformCommand(transformData);
    const currentHistory = get(history);
    const result = executeCommand(currentHistory, currentDoc, command);
    doc.set(result.doc);
    history.set(result.history);
    floating.set(null);
    return true;
  };

  const cancelFloatingInternal = (): boolean => {
    const currentFloating = get(floating);
    if (!currentFloating) return false;
    floating.set(null);
    doc.update(d => ({ ...d, selection: { ...currentFloating.selectionBefore, mask: currentFloating.selectionBefore.mask?.slice() } }));
    return true;
  };

  const ensureFloatingCommitted = (reason: FloatingCommitReason): void => {
    if (get(floating)) {
      commitFloatingInternal(reason);
    }
  };

  const copySelectionToClipboard = (activeZ = 0): boolean => {
    const currentFloating = get(floating);
    if (currentFloating) {
      clipboard = buildClipboardFromFloating(currentFloating);
      return true;
    }

    const currentDoc = get(doc);
    const activeLayer = getActivePaintableLayer(currentDoc);
    if (!activeLayer) return false;
    const floatingFromSelection = createFloatingFromSelection(activeLayer, currentDoc.selection, activeZ);
    if (!floatingFromSelection) return false;
    clipboard = buildClipboardFromFloating(floatingFromSelection);
    return true;
  };

  const beginFloatingFromSelectionInternal = (activeZ: number): boolean => {
    ensureFloatingCommitted('tool-switch');
    const currentDoc = get(doc);
    const activeLayer = getActivePaintableLayer(currentDoc);
    if (!activeLayer) return false;
    const session = createFloatingFromSelection(activeLayer, currentDoc.selection, activeZ);
    if (!session) return false;
    floating.set(session);
    doc.update(d => ({ ...d, selection: getFloatingSelection(session) }));
    return true;
  };

  const beginFloatingFromClipboardInternal = (x: number, y: number, activeZ: number): boolean => {
    ensureFloatingCommitted('tool-switch');
    const currentDoc = get(doc);
    const activeLayer = getActivePaintableLayer(currentDoc);
    if (!activeLayer || !clipboard) return false;
    const session = createFloatingFromClipboard(activeLayer, clipboard, x, y, activeZ, currentDoc.selection);
    if (!session) return false;
    floating.set(session);
    doc.update(d => ({ ...d, selection: getFloatingSelection(session) }));
    return true;
  };
  
  return {
    subscribe: doc.subscribe,
    floating: {
      subscribe: floating.subscribe,
    },
    hasFloating: () => get(floating) !== null,
    
    /** Replace the entire document */
    set: (newDoc: EditorDocument) => {
      ensureFloatingCommitted('view-change');
      doc.set(newDoc);
      history.set(createHistory(100));
      floating.set(null);
    },
    
    /** Execute a command with undo support */
    execute: (command: Command) => {
      ensureFloatingCommitted('tool-switch');
      applyCommand(command);
    },
    
    /** Undo last action */
    undo: () => {
      ensureFloatingCommitted('tool-switch');
      const currentDoc = get(doc);
      const currentHistory = get(history);
      const result = undoCommand(currentHistory, currentDoc);
      if (result) {
        doc.set(result.doc);
        history.set(result.history);
      }
    },
    
    /** Redo last undone action */
    redo: () => {
      ensureFloatingCommitted('tool-switch');
      const currentDoc = get(doc);
      const currentHistory = get(history);
      const result = redoCommand(currentHistory, currentDoc);
      if (result) {
        doc.set(result.doc);
        history.set(result.history);
      }
    },
    
    /** Get history state (for UI indicators) */
    history: derived(history, h => ({
      canUndo: h.past.length > 0,
      canRedo: h.future.length > 0,
      undoCount: h.past.length,
      redoCount: h.future.length,
    })),
    
    // Helper actions
    paint: (data: PaintData) => {
      ensureFloatingCommitted('tool-switch');
      applyCommand(createPaintCommand(data));
    },

    erase: (data: PaintData) => {
      ensureFloatingCommitted('tool-switch');
      applyCommand(createEraseCommand(data));
    },

    fill: (data: PaintData) => {
      ensureFloatingCommitted('tool-switch');
      applyCommand(createFillCommand(data));
    },

    paste: (data: PaintData) => {
      ensureFloatingCommitted('tool-switch');
      applyCommand(createPasteCommand(data));
    },

    select: (data: SelectionData) => {
      ensureFloatingCommitted('tool-switch');
      applyCommand(createSelectionCommand(data));
    },

    transform: (data: TransformData) => {
      ensureFloatingCommitted('tool-switch');
      applyCommand(createTransformCommand(data));
    },
    
    addLayer: (name?: string, zIndex?: number) => {
      ensureFloatingCommitted('layer-change');
      const currentDoc = get(doc);
      // Default zIndex is one above the highest existing layer
      const maxZIndex = currentDoc.layers.reduce((max, l) => Math.max(max, l.zIndex), -1);
      const newZIndex = zIndex ?? maxZIndex + 1;
      const layer = createGridLayer(
        currentDoc.width, 
        currentDoc.height, 
        name ?? `Layer ${currentDoc.layers.length + 1}`,
        newZIndex
      );
      applyCommand(createAddLayerCommand(layer));
    },

    addVoxelLayer: (name?: string, zIndex?: number) => {
      ensureFloatingCommitted('layer-change');
      const currentDoc = get(doc);
      const maxZIndex = currentDoc.layers.reduce((max, l) => Math.max(max, l.zIndex), -1);
      const newZIndex = zIndex ?? maxZIndex + 1;
      const layer = createVoxelLayer(
        currentDoc.width,
        currentDoc.height,
        currentDoc.depth,
        name ?? `Voxel ${currentDoc.layers.length + 1}`,
        newZIndex
      );
      applyCommand(createAddLayerCommand(layer));
    },

    /** Add a voxel layer with pre-existing data */
    addVoxelLayerWithData: (
      data: Uint16Array,
      width: number,
      height: number,
      depth: number,
      name?: string,
      zIndex?: number
    ) => {
      ensureFloatingCommitted('layer-change');
      const currentDoc = get(doc);
      const maxZIndex = currentDoc.layers.reduce((max, l) => Math.max(max, l.zIndex), -1);
      const newZIndex = zIndex ?? maxZIndex + 1;
      const layer: VoxelLayer = {
        id: createLayerId(),
        name: name ?? `Voxel ${currentDoc.layers.length + 1}`,
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: 'normal',
        zIndex: newZIndex,
        isoHeight: 0,
        type: 'voxel3d',
        data: data.slice(), // Copy the data
        width,
        height,
        depth,
      };
      applyCommand(createAddLayerCommand(layer));
      return layer.id;
    },

    addReferenceLayer: (imageUrl: string, name?: string, zIndex?: number) => {
      ensureFloatingCommitted('layer-change');
      const currentDoc = get(doc);
      const maxZIndex = currentDoc.layers.reduce((max, l) => Math.max(max, l.zIndex), -1);
      const newZIndex = zIndex ?? maxZIndex + 1;
      const layer = createReferenceLayer(
        imageUrl,
        name ?? `Reference ${currentDoc.layers.length + 1}`,
        newZIndex
      );
      applyCommand(createAddLayerCommand(layer));
    },
    
    deleteLayer: (layerId: LayerId) => {
      ensureFloatingCommitted('layer-change');
      applyCommand(createDeleteLayerCommand(layerId));
    },

    duplicateLayer: (layerId: LayerId) => {
      ensureFloatingCommitted('layer-change');
      const currentDoc = get(doc);
      const sourceLayer = currentDoc.layers.find(l => l.id === layerId);
      if (!sourceLayer) return;

      const maxZIndex = currentDoc.layers.reduce((max, l) => Math.max(max, l.zIndex), -1);
      const newZIndex = maxZIndex + 1;

      const duplicatedLayer = sourceLayer.type === 'grid2d'
        ? {
          ...sourceLayer,
          id: createLayerId(),
          name: `${sourceLayer.name} Copy`,
          zIndex: newZIndex,
          data: new Uint16Array(sourceLayer.data),
        }
        : sourceLayer.type === 'voxel3d'
          ? {
            ...sourceLayer,
            id: createLayerId(),
            name: `${sourceLayer.name} Copy`,
            zIndex: newZIndex,
            data: new Uint16Array(sourceLayer.data),
          }
          : {
            ...sourceLayer,
            id: createLayerId(),
            name: `${sourceLayer.name} Copy`,
            zIndex: newZIndex,
          };

      applyCommand(createAddLayerCommand(duplicatedLayer));
    },
    
    toggleLayerVisibility: (layerId: LayerId) => {
      ensureFloatingCommitted('layer-change');
      applyCommand(createToggleVisibilityCommand(layerId));
    },

    toggleLayerLock: (layerId: LayerId) => {
      ensureFloatingCommitted('layer-change');
      applyCommand(createToggleLockCommand(layerId));
    },

    renameLayer: (layerId: LayerId, name: string) => {
      ensureFloatingCommitted('layer-change');
      applyCommand(createRenameLayerCommand(layerId, name));
    },

    setLayerOpacity: (layerId: LayerId, opacity: number) => {
      ensureFloatingCommitted('layer-change');
      applyCommand(createSetOpacityCommand(layerId, opacity));
    },

    setLayerBlendMode: (layerId: LayerId, blendMode: 'normal' | 'multiply' | 'screen' | 'overlay') => {
      ensureFloatingCommitted('layer-change');
      applyCommand(createSetBlendModeCommand(layerId, blendMode));
    },
    
    setLayerZIndex: (layerId: LayerId, zIndex: number) => {
      ensureFloatingCommitted('layer-change');
      applyCommand(createSetZIndexCommand(layerId, zIndex));
    },

    stepActiveLayer: (direction: 'up' | 'down', createIfMissing = true) => {
      ensureFloatingCommitted('layer-change');
      const currentDoc = get(doc);
      const sorted = [...currentDoc.layers].sort((a, b) => a.zIndex - b.zIndex);
      const activeIndex = sorted.findIndex(l => l.id === currentDoc.activeLayerId);
      if (activeIndex === -1) return;

      const delta = direction === 'up' ? 1 : -1;
      const next = sorted[activeIndex + delta];
      if (next) {
        doc.update(d => ({ ...d, activeLayerId: next.id }));
        return;
      }

      if (!createIfMissing) return;

      const maxZIndex = currentDoc.layers.reduce((max, l) => Math.max(max, l.zIndex), -1);
      const minZIndex = currentDoc.layers.reduce((min, l) => Math.min(min, l.zIndex), 0);
      const newZIndex = direction === 'up' ? maxZIndex + 1 : minZIndex - 1;
      const layer = createGridLayer(
        currentDoc.width,
        currentDoc.height,
        `Layer ${currentDoc.layers.length + 1}`,
        newZIndex
      );
      applyCommand(createAddLayerCommand(layer));
    },

    reorderLayers: (orderedLayerIds: LayerId[]) => {
      ensureFloatingCommitted('layer-change');
      applyCommand(createReorderLayersCommand(orderedLayerIds));
    },

    mergeLayerDown: (upperLayerId: LayerId, lowerLayerId: LayerId) => {
      ensureFloatingCommitted('layer-change');
      applyCommand(createMergeDownCommand(upperLayerId, lowerLayerId));
    },

    flattenGridLayers: () => {
      ensureFloatingCommitted('layer-change');
      applyCommand(createFlattenGridLayersCommand());
    },
    
    setLayerIsoHeight: (layerId: LayerId, isoHeight: number) => {
      ensureFloatingCommitted('layer-change');
      applyCommand(createSetIsoHeightCommand(layerId, isoHeight));
    },
    
    setActiveLayer: (layerId: LayerId) => {
      ensureFloatingCommitted('layer-change');
      doc.update(d => ({ ...d, activeLayerId: layerId }));
    },
    
    setViewMode: (mode: ViewMode) => {
      ensureFloatingCommitted('view-change');
      doc.update(d => ({ ...d, viewMode: mode }));
    },
    
    setCamera: (camera: Partial<EditorDocument['camera']>) => {
      doc.update(d => ({ ...d, camera: { ...d.camera, ...camera } }));
    },
    
    /** Save document to file */
    saveToFile: () => {
      ensureFloatingCommitted('save');
      const currentDoc = get(doc);
      saveDocumentToFile(currentDoc);
    },
    
    /** Load document from file */
    loadFromFile: async () => {
      try {
        ensureFloatingCommitted('view-change');
        const newDoc = await loadDocumentFromFile();
        doc.set(newDoc);
        history.set(createHistory(100));
        floating.set(null);
        return true;
      } catch (e) {
        console.error('Failed to load file:', e);
        return false;
      }
    },
    
    /** Export active layer as PNG */
    exportLayerPNG: () => {
      ensureFloatingCommitted('export');
      const currentDoc = get(doc);
      const activeLayer = currentDoc.layers.find(l => l.id === currentDoc.activeLayerId);
      if (activeLayer && activeLayer.type === 'grid2d') {
        exportLayerAsPNG(activeLayer, currentDoc.palette);
      }
    },
    
    /** Create new document */
    newDocument: (width: number, height: number, depth: number, name: string) => {
      ensureFloatingCommitted('view-change');
      doc.set(createDocument(width, height, depth, name));
      history.set(createHistory(100));
      floating.set(null);
    },

    /** Copy selection to clipboard */
    copySelection: (activeZ = 0) => {
      return copySelectionToClipboard(activeZ);
    },

    /** Cut selection to clipboard */
    cutSelection: (activeZ = 0) => {
      const didCopy = copySelectionToClipboard(activeZ);
      if (!didCopy) return false;
      return beginFloatingFromSelectionInternal(activeZ);
    },

    /** Paste clipboard at position (defaults to selection origin) */
    pasteSelection: (x?: number, y?: number, activeZ = 0) => {
      const currentDoc = get(doc);
      const activeLayer = getActivePaintableLayer(currentDoc);
      if (!activeLayer || !clipboard) return false;

      const destX = x ?? currentDoc.selection.x ?? 0;
      const destY = y ?? currentDoc.selection.y ?? 0;
      return beginFloatingFromClipboardInternal(destX, destY, activeZ);
    },

    beginFloatingFromSelection: (activeZ: number) => {
      return beginFloatingFromSelectionInternal(activeZ);
    },

    beginFloatingFromClipboard: (x: number, y: number, activeZ: number) => {
      return beginFloatingFromClipboardInternal(x, y, activeZ);
    },

    moveFloatingBy: (dx: number, dy: number) => {
      const currentFloating = get(floating);
      if (!currentFloating) return;
      const next = moveFloatingSelection(currentFloating, dx, dy);
      floating.set(next);
      doc.update(d => ({ ...d, selection: getFloatingSelection(next) }));
    },

    rotateFloating: (angle: 90 | 180 | 270) => {
      const currentFloating = get(floating);
      if (!currentFloating) return;
      const next = rotateFloatingSelection(currentFloating, angle);
      floating.set(next);
      doc.update(d => ({ ...d, selection: getFloatingSelection(next) }));
    },

    flipFloating: (axis: 'horizontal' | 'vertical') => {
      const currentFloating = get(floating);
      if (!currentFloating) return;
      const next = flipFloatingSelection(currentFloating, axis);
      floating.set(next);
      doc.update(d => ({ ...d, selection: getFloatingSelection(next) }));
    },

    commitFloating: (reason: FloatingCommitReason) => commitFloatingInternal(reason),

    cancelFloating: () => {
      cancelFloatingInternal();
    },

    selectAllActivePlane: (activeZ: number) => {
      ensureFloatingCommitted('tool-switch');
      const currentDoc = get(doc);
      const activeLayer = getActivePaintableLayer(currentDoc);
      if (!activeLayer) return false;

      const selection: Selection = {
        active: true,
        x: 0,
        y: 0,
        width: activeLayer.width,
        height: activeLayer.height,
      };

      applyCommand(createSelectionCommand({
        before: currentDoc.selection,
        after: selection,
      }));
      // Keep activeZ in signature for API stability and voxel parity.
      void activeZ;
      return true;
    },
  };
};

export const documentStore = createDocumentStore();

/** History info type for UI indicators */
export type HistoryInfo = {
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
};

// ============================================================================
// Tool Store
// ============================================================================

export type ToolId =
  | 'pencil'
  | 'eraser'
  | 'fill'
  | 'select'
  | 'lasso_freehand'
  | 'lasso_polygon'
  | 'move'
  | 'pan'
  | 'eyedropper'
  | 'line'
  | 'rect'
  | 'ellipse'
  | 'wand';

export type ToolSettings = {
  brushSize: number;
  brushShape: 'square' | 'circle' | 'diamond';
  shapeFilled: boolean;
  autoLayerStep: boolean;
  autoLayerStepDirection: 'up' | 'down';
  autoLayerStepCreate: boolean;
  tolerance: number; // For fill tool
};

const createToolStore = () => {
  const activeTool = writable<ToolId>('pencil');
  const settings = writable<ToolSettings>({
    brushSize: 1,
    brushShape: 'square',
    shapeFilled: false,
    autoLayerStep: false,
    autoLayerStepDirection: 'up',
    autoLayerStepCreate: true,
    tolerance: 0,
  });
  const primaryMaterial = writable<number>(1); // Stone
  const secondaryMaterial = writable<number>(0); // Air
  const activeZ = writable<number>(0); // Current Z level for voxel editing
  
  return {
    activeTool: {
      subscribe: activeTool.subscribe,
      set: activeTool.set,
    },
    settings: {
      subscribe: settings.subscribe,
      update: settings.update,
      set: settings.set,
    },
    primaryMaterial: {
      subscribe: primaryMaterial.subscribe,
      set: primaryMaterial.set,
    },
    secondaryMaterial: {
      subscribe: secondaryMaterial.subscribe,
      set: secondaryMaterial.set,
    },
    activeZ: {
      subscribe: activeZ.subscribe,
      set: activeZ.set,
    },
    
    /** Set active Z level with bounds */
    setActiveZ: (z: number, maxDepth = 64) => {
      activeZ.set(Math.max(0, Math.min(maxDepth - 1, z)));
    },
    
    /** Step Z level up or down */
    stepActiveZ: (delta: number, maxDepth = 64) => {
      activeZ.update(z => Math.max(0, Math.min(maxDepth - 1, z + delta)));
    },
    
    /** Swap primary and secondary materials */
    swapMaterials: () => {
      const primary = get(primaryMaterial);
      const secondary = get(secondaryMaterial);
      primaryMaterial.set(secondary);
      secondaryMaterial.set(primary);
    },
    
    /** Set brush size with bounds */
    setBrushSize: (size: number) => {
      settings.update(s => ({ ...s, brushSize: Math.max(1, Math.min(64, size)) }));
    },

    /** Set brush shape */
    setBrushShape: (shape: ToolSettings['brushShape']) => {
      settings.update(s => ({ ...s, brushShape: shape }));
    },

    /** Toggle filled shape rendering */
    toggleShapeFilled: () => {
      settings.update(s => ({ ...s, shapeFilled: !s.shapeFilled }));
    },

    toggleAutoLayerStep: () => {
      settings.update(s => ({ ...s, autoLayerStep: !s.autoLayerStep }));
    },

    setAutoLayerStepDirection: (direction: ToolSettings['autoLayerStepDirection']) => {
      settings.update(s => ({ ...s, autoLayerStepDirection: direction }));
    },

    toggleAutoLayerStepCreate: () => {
      settings.update(s => ({ ...s, autoLayerStepCreate: !s.autoLayerStepCreate }));
    },
  };
};

export const toolStore = createToolStore();

// ============================================================================
// UI Store
// ============================================================================

export type PanelId = 'tools' | 'layers' | 'palette' | 'simulation' | 'ai' | 'assets' | 'project' | 'console';
export type Voxel2DRenderMode = 'slice' | 'projection';

const createUIStore = () => {
  const panels = writable<Record<PanelId, boolean>>({
    tools: true,
    layers: true,
    palette: true,
    simulation: false,
    ai: false,
    assets: false,
    project: true,
    console: false,
  });
  
  const showGrid = writable(true);
  const showPixelGrid = writable(true); // Only at high zoom
  const gridStep = writable(1);
  const cursorPosition = writable<{ x: number; y: number } | null>(null);
  const showTextures = writable(false); // Toggle procedural textures rendering
  const voxel2DMode = writable<Voxel2DRenderMode>('slice');
  
  return {
    panels: {
      subscribe: panels.subscribe,
      toggle: (id: PanelId) => panels.update(p => ({ ...p, [id]: !p[id] })),
      show: (id: PanelId) => panels.update(p => ({ ...p, [id]: true })),
      hide: (id: PanelId) => panels.update(p => ({ ...p, [id]: false })),
    },
    showGrid: {
      subscribe: showGrid.subscribe,
      toggle: () => showGrid.update(v => !v),
    },
    gridStep: {
      subscribe: gridStep.subscribe,
      set: (value: number) => gridStep.set(Math.max(1, Math.min(64, Math.floor(value)))),
    },
    showPixelGrid: {
      subscribe: showPixelGrid.subscribe,
      toggle: () => showPixelGrid.update(v => !v),
    },
    cursorPosition: {
      subscribe: cursorPosition.subscribe,
      set: cursorPosition.set,
    },
    showTextures: {
      subscribe: showTextures.subscribe,
      toggle: () => showTextures.update(v => !v),
      set: showTextures.set,
    },
    voxel2DMode: {
      subscribe: voxel2DMode.subscribe,
      set: (mode: Voxel2DRenderMode) => voxel2DMode.set(mode),
      cycle: () => voxel2DMode.update(mode => mode === 'slice' ? 'projection' : 'slice'),
    },
  };
};

export const uiStore = createUIStore();

// ============================================================================
// Derived Stores
// ============================================================================

/** Active layer derived from document */
export const activeLayer = derived(documentStore, $doc => 
  $doc.layers.find(l => l.id === $doc.activeLayerId) ?? null
);

/** Palette as array derived from document */
export const palette = derived(documentStore, $doc => $doc.palette);

export { projectStore, worldStore };
