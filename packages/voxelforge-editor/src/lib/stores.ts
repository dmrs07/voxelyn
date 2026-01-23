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
  buildPasteData,
  copySelectionFromLayer,
  createEraseDataFromSelection,
  type ClipboardData,
} from './document/clipboard';

// ============================================================================
// Document Store
// ============================================================================

const createDocumentStore = () => {
  const doc = writable<EditorDocument>(createDocument(128, 128, 32, 'Untitled'));
  const history = writable<HistoryState>(createHistory(100));
  let clipboard: ClipboardData | null = null;
  
  return {
    subscribe: doc.subscribe,
    
    /** Replace the entire document */
    set: (newDoc: EditorDocument) => {
      doc.set(newDoc);
      history.set(createHistory(100));
    },
    
    /** Execute a command with undo support */
    execute: (command: Command) => {
      const currentDoc = get(doc);
      const currentHistory = get(history);
      const result = executeCommand(currentHistory, currentDoc, command);
      doc.set(result.doc);
      history.set(result.history);
    },
    
    /** Undo last action */
    undo: () => {
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
      const currentDoc = get(doc);
      const currentHistory = get(history);
      const command = createPaintCommand(data);
      const result = executeCommand(currentHistory, currentDoc, command);
      doc.set(result.doc);
      history.set(result.history);
    },

    erase: (data: PaintData) => {
      const currentDoc = get(doc);
      const currentHistory = get(history);
      const command = createEraseCommand(data);
      const result = executeCommand(currentHistory, currentDoc, command);
      doc.set(result.doc);
      history.set(result.history);
    },

    fill: (data: PaintData) => {
      const currentDoc = get(doc);
      const currentHistory = get(history);
      const command = createFillCommand(data);
      const result = executeCommand(currentHistory, currentDoc, command);
      doc.set(result.doc);
      history.set(result.history);
    },

    paste: (data: PaintData) => {
      const currentDoc = get(doc);
      const currentHistory = get(history);
      const command = createPasteCommand(data);
      const result = executeCommand(currentHistory, currentDoc, command);
      doc.set(result.doc);
      history.set(result.history);
    },

    select: (data: SelectionData) => {
      const currentDoc = get(doc);
      const currentHistory = get(history);
      const command = createSelectionCommand(data);
      const result = executeCommand(currentHistory, currentDoc, command);
      doc.set(result.doc);
      history.set(result.history);
    },

    transform: (data: TransformData) => {
      const currentDoc = get(doc);
      const currentHistory = get(history);
      const command = createTransformCommand(data);
      const result = executeCommand(currentHistory, currentDoc, command);
      doc.set(result.doc);
      history.set(result.history);
    },
    
    addLayer: (name?: string, zIndex?: number) => {
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
      const command = createAddLayerCommand(layer);
      const currentHistory = get(history);
      const result = executeCommand(currentHistory, currentDoc, command);
      doc.set(result.doc);
      history.set(result.history);
    },

    addVoxelLayer: (name?: string, zIndex?: number) => {
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
      const command = createAddLayerCommand(layer);
      const currentHistory = get(history);
      const result = executeCommand(currentHistory, currentDoc, command);
      doc.set(result.doc);
      history.set(result.history);
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
      const command = createAddLayerCommand(layer);
      const currentHistory = get(history);
      const result = executeCommand(currentHistory, currentDoc, command);
      doc.set(result.doc);
      history.set(result.history);
      return layer.id;
    },

    addReferenceLayer: (imageUrl: string, name?: string, zIndex?: number) => {
      const currentDoc = get(doc);
      const maxZIndex = currentDoc.layers.reduce((max, l) => Math.max(max, l.zIndex), -1);
      const newZIndex = zIndex ?? maxZIndex + 1;
      const layer = createReferenceLayer(
        imageUrl,
        name ?? `Reference ${currentDoc.layers.length + 1}`,
        newZIndex
      );
      const command = createAddLayerCommand(layer);
      const currentHistory = get(history);
      const result = executeCommand(currentHistory, currentDoc, command);
      doc.set(result.doc);
      history.set(result.history);
    },
    
    deleteLayer: (layerId: LayerId) => {
      const currentDoc = get(doc);
      const currentHistory = get(history);
      const command = createDeleteLayerCommand(layerId);
      const result = executeCommand(currentHistory, currentDoc, command);
      doc.set(result.doc);
      history.set(result.history);
    },

    duplicateLayer: (layerId: LayerId) => {
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

      const command = createAddLayerCommand(duplicatedLayer);
      const currentHistory = get(history);
      const result = executeCommand(currentHistory, currentDoc, command);
      doc.set(result.doc);
      history.set(result.history);
    },
    
    toggleLayerVisibility: (layerId: LayerId) => {
      const currentDoc = get(doc);
      const currentHistory = get(history);
      const command = createToggleVisibilityCommand(layerId);
      const result = executeCommand(currentHistory, currentDoc, command);
      doc.set(result.doc);
      history.set(result.history);
    },

    toggleLayerLock: (layerId: LayerId) => {
      const currentDoc = get(doc);
      const currentHistory = get(history);
      const command = createToggleLockCommand(layerId);
      const result = executeCommand(currentHistory, currentDoc, command);
      doc.set(result.doc);
      history.set(result.history);
    },

    renameLayer: (layerId: LayerId, name: string) => {
      const currentDoc = get(doc);
      const currentHistory = get(history);
      const command = createRenameLayerCommand(layerId, name);
      const result = executeCommand(currentHistory, currentDoc, command);
      doc.set(result.doc);
      history.set(result.history);
    },

    setLayerOpacity: (layerId: LayerId, opacity: number) => {
      const currentDoc = get(doc);
      const currentHistory = get(history);
      const command = createSetOpacityCommand(layerId, opacity);
      const result = executeCommand(currentHistory, currentDoc, command);
      doc.set(result.doc);
      history.set(result.history);
    },

    setLayerBlendMode: (layerId: LayerId, blendMode: 'normal' | 'multiply' | 'screen' | 'overlay') => {
      const currentDoc = get(doc);
      const currentHistory = get(history);
      const command = createSetBlendModeCommand(layerId, blendMode);
      const result = executeCommand(currentHistory, currentDoc, command);
      doc.set(result.doc);
      history.set(result.history);
    },
    
    setLayerZIndex: (layerId: LayerId, zIndex: number) => {
      const currentDoc = get(doc);
      const currentHistory = get(history);
      const command = createSetZIndexCommand(layerId, zIndex);
      const result = executeCommand(currentHistory, currentDoc, command);
      doc.set(result.doc);
      history.set(result.history);
    },

    stepActiveLayer: (direction: 'up' | 'down', createIfMissing = true) => {
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
      const command = createAddLayerCommand(layer);
      const currentHistory = get(history);
      const result = executeCommand(currentHistory, currentDoc, command);
      doc.set(result.doc);
      history.set(result.history);
    },

    reorderLayers: (orderedLayerIds: LayerId[]) => {
      const currentDoc = get(doc);
      const currentHistory = get(history);
      const command = createReorderLayersCommand(orderedLayerIds);
      const result = executeCommand(currentHistory, currentDoc, command);
      doc.set(result.doc);
      history.set(result.history);
    },

    mergeLayerDown: (upperLayerId: LayerId, lowerLayerId: LayerId) => {
      const currentDoc = get(doc);
      const currentHistory = get(history);
      const command = createMergeDownCommand(upperLayerId, lowerLayerId);
      const result = executeCommand(currentHistory, currentDoc, command);
      doc.set(result.doc);
      history.set(result.history);
    },

    flattenGridLayers: () => {
      const currentDoc = get(doc);
      const currentHistory = get(history);
      const command = createFlattenGridLayersCommand();
      const result = executeCommand(currentHistory, currentDoc, command);
      doc.set(result.doc);
      history.set(result.history);
    },
    
    setLayerIsoHeight: (layerId: LayerId, isoHeight: number) => {
      const currentDoc = get(doc);
      const currentHistory = get(history);
      const command = createSetIsoHeightCommand(layerId, isoHeight);
      const result = executeCommand(currentHistory, currentDoc, command);
      doc.set(result.doc);
      history.set(result.history);
    },
    
    setActiveLayer: (layerId: LayerId) => {
      doc.update(d => ({ ...d, activeLayerId: layerId }));
    },
    
    setViewMode: (mode: ViewMode) => {
      doc.update(d => ({ ...d, viewMode: mode }));
    },
    
    setCamera: (camera: Partial<EditorDocument['camera']>) => {
      doc.update(d => ({ ...d, camera: { ...d.camera, ...camera } }));
    },
    
    /** Save document to file */
    saveToFile: () => {
      const currentDoc = get(doc);
      saveDocumentToFile(currentDoc);
    },
    
    /** Load document from file */
    loadFromFile: async () => {
      try {
        const newDoc = await loadDocumentFromFile();
        doc.set(newDoc);
        history.set(createHistory(100));
        return true;
      } catch (e) {
        console.error('Failed to load file:', e);
        return false;
      }
    },
    
    /** Export active layer as PNG */
    exportLayerPNG: () => {
      const currentDoc = get(doc);
      const activeLayer = currentDoc.layers.find(l => l.id === currentDoc.activeLayerId);
      if (activeLayer && activeLayer.type === 'grid2d') {
        exportLayerAsPNG(activeLayer, currentDoc.palette);
      }
    },
    
    /** Create new document */
    newDocument: (width: number, height: number, depth: number, name: string) => {
      doc.set(createDocument(width, height, depth, name));
      history.set(createHistory(100));
    },

    /** Copy selection to clipboard */
    copySelection: () => {
      const currentDoc = get(doc);
      const activeLayer = currentDoc.layers.find(l => l.id === currentDoc.activeLayerId);
      if (!activeLayer || activeLayer.type !== 'grid2d') return false;

      const copied = copySelectionFromLayer(activeLayer, currentDoc.selection);
      if (!copied) return false;

      clipboard = copied;
      return true;
    },

    /** Cut selection to clipboard */
    cutSelection: () => {
      const currentDoc = get(doc);
      const activeLayer = currentDoc.layers.find(l => l.id === currentDoc.activeLayerId);
      if (!activeLayer || activeLayer.type !== 'grid2d') return false;

      const copied = copySelectionFromLayer(activeLayer, currentDoc.selection);
      if (!copied) return false;

      clipboard = copied;

      const eraseData = createEraseDataFromSelection(activeLayer, currentDoc.selection);
      if (!eraseData || eraseData.pixels.length === 0) return true;

      const currentHistory = get(history);
      const command = createEraseCommand(eraseData);
      const result = executeCommand(currentHistory, currentDoc, command);
      doc.set(result.doc);
      history.set(result.history);
      return true;
    },

    /** Paste clipboard at position (defaults to selection origin) */
    pasteSelection: (x?: number, y?: number) => {
      const currentDoc = get(doc);
      const activeLayer = currentDoc.layers.find(l => l.id === currentDoc.activeLayerId);
      if (!activeLayer || activeLayer.type !== 'grid2d' || !clipboard) return false;

      const destX = x ?? currentDoc.selection.x ?? 0;
      const destY = y ?? currentDoc.selection.y ?? 0;
      const paintData = buildPasteData(activeLayer, clipboard, destX, destY);
      if (paintData.pixels.length === 0) return false;

      const currentHistory = get(history);
      const command = createPasteCommand(paintData);
      const result = executeCommand(currentHistory, currentDoc, command);
      doc.set(result.doc);
      history.set(result.history);
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

export type ToolId = 'pencil' | 'eraser' | 'fill' | 'select' | 'pan' | 'eyedropper' | 'line' | 'rect' | 'ellipse' | 'wand';

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

export type PanelId = 'tools' | 'layers' | 'palette' | 'simulation' | 'ai';

const createUIStore = () => {
  const panels = writable<Record<PanelId, boolean>>({
    tools: true,
    layers: true,
    palette: true,
    simulation: false,
    ai: false,
  });
  
  const showGrid = writable(true);
  const showPixelGrid = writable(true); // Only at high zoom
  const gridStep = writable(1);
  const cursorPosition = writable<{ x: number; y: number } | null>(null);
  
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
