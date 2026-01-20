/**
 * VoxelForge Editor - Command Pattern for Undo/Redo
 */

import type { EditorDocument, Layer, LayerId, Selection } from './types';

/** Base command interface */
export type Command = {
  id: string;
  description: string;
  execute: (doc: EditorDocument) => EditorDocument;
  undo: (doc: EditorDocument) => EditorDocument;
  canExecute?: (doc: EditorDocument) => boolean; // Optional validation
};

/** History state for undo/redo */
export type HistoryState = {
  past: Command[];
  future: Command[];
  maxSize: number;
};

/** Creates a new history state */
export const createHistory = (maxSize = 100): HistoryState => ({
  past: [],
  future: [],
  maxSize,
});

/** Executes a command and adds it to history */
export const executeCommand = (
  history: HistoryState,
  doc: EditorDocument,
  command: Command
): { history: HistoryState; doc: EditorDocument } => {
  // Check if command can execute (optional validation)
  if (command.canExecute && !command.canExecute(doc)) {
    // Command cannot execute - don't record it
    return { history, doc };
  }

  const newDoc = command.execute(doc);
  
  // Only record if document actually changed
  if (newDoc === doc) {
    return { history, doc };
  }

  const newPast = [...history.past, command].slice(-history.maxSize);
  
  return {
    history: {
      ...history,
      past: newPast,
      future: [], // Clear redo stack on new action
    },
    doc: newDoc,
  };
};

/** Undoes the last command */
export const undo = (
  history: HistoryState,
  doc: EditorDocument
): { history: HistoryState; doc: EditorDocument } | null => {
  const command = history.past[history.past.length - 1];
  if (!command) return null;
  
  const newDoc = command.undo(doc);
  
  return {
    history: {
      ...history,
      past: history.past.slice(0, -1),
      future: [command, ...history.future],
    },
    doc: newDoc,
  };
};

/** Redoes the last undone command */
export const redo = (
  history: HistoryState,
  doc: EditorDocument
): { history: HistoryState; doc: EditorDocument } | null => {
  const command = history.future[0];
  if (!command) return null;
  
  const newDoc = command.execute(doc);
  
  return {
    history: {
      ...history,
      past: [...history.past, command],
      future: history.future.slice(1),
    },
    doc: newDoc,
  };
};

/** Creates a unique command ID */
const createCommandId = () => 
  `cmd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

// ============================================================================
// Paint Commands
// ============================================================================

export type PaintData = {
  layerId: LayerId;
  pixels: Array<{ index: number; oldValue: number; newValue: number }>;
};

export type SelectionData = {
  before: Selection;
  after: Selection;
};

export type TransformData = PaintData & {
  selectionBefore?: Selection;
  selectionAfter?: Selection;
};

const applyPixelChanges = (
  doc: EditorDocument,
  layerId: LayerId,
  pixels: PaintData['pixels'],
  useNewValue: boolean
): EditorDocument => {
  const layerIndex = doc.layers.findIndex(l => l.id === layerId);
  if (layerIndex === -1) return doc;

  const layer = doc.layers[layerIndex];
  if (layer.type !== 'grid2d' && layer.type !== 'voxel3d') return doc;

  const newData = new Uint16Array(layer.data);
  for (const px of pixels) {
    newData[px.index] = useNewValue ? px.newValue : px.oldValue;
  }

  const newLayers = [...doc.layers];
  newLayers[layerIndex] = { ...layer, data: newData };

  return { ...doc, layers: newLayers, meta: { ...doc.meta, modified: Date.now() } };
};

/** Creates a paint command */
export const createPaintCommand = (data: PaintData): Command => ({
  id: createCommandId(),
  description: `Paint ${data.pixels.length} pixels`,
  
  execute: (doc) => applyPixelChanges(doc, data.layerId, data.pixels, true),
  
  undo: (doc) => applyPixelChanges(doc, data.layerId, data.pixels, false),
});

/** Creates an erase command (paint to material 0 or provided data) */
export const createEraseCommand = (data: PaintData): Command => ({
  id: createCommandId(),
  description: `Erase ${data.pixels.length} pixels`,
  execute: (doc) => applyPixelChanges(doc, data.layerId, data.pixels, true),
  undo: (doc) => applyPixelChanges(doc, data.layerId, data.pixels, false),
});

/** Creates a fill command */
export const createFillCommand = (data: PaintData): Command => ({
  id: createCommandId(),
  description: `Fill ${data.pixels.length} pixels`,
  execute: (doc) => applyPixelChanges(doc, data.layerId, data.pixels, true),
  undo: (doc) => applyPixelChanges(doc, data.layerId, data.pixels, false),
});

/** Creates a paste command */
export const createPasteCommand = (data: PaintData): Command => ({
  id: createCommandId(),
  description: `Paste ${data.pixels.length} pixels`,
  execute: (doc) => applyPixelChanges(doc, data.layerId, data.pixels, true),
  undo: (doc) => applyPixelChanges(doc, data.layerId, data.pixels, false),
});

/** Creates a selection command */
export const createSelectionCommand = (data: SelectionData): Command => ({
  id: createCommandId(),
  description: 'Selection change',
  execute: (doc) => ({ ...doc, selection: data.after, meta: { ...doc.meta, modified: Date.now() } }),
  undo: (doc) => ({ ...doc, selection: data.before, meta: { ...doc.meta, modified: Date.now() } }),
});

/** Creates a transform command (move/rotate selection) */
export const createTransformCommand = (data: TransformData): Command => ({
  id: createCommandId(),
  description: `Transform ${data.pixels.length} pixels`,
  execute: (doc) => {
    const updated = applyPixelChanges(doc, data.layerId, data.pixels, true);
    return data.selectionAfter
      ? { ...updated, selection: data.selectionAfter, meta: { ...updated.meta, modified: Date.now() } }
      : updated;
  },
  undo: (doc) => {
    const updated = applyPixelChanges(doc, data.layerId, data.pixels, false);
    return data.selectionBefore
      ? { ...updated, selection: data.selectionBefore, meta: { ...updated.meta, modified: Date.now() } }
      : updated;
  },
});

// ============================================================================
// Layer Commands
// ============================================================================

/** Creates a command to add a new layer */
export const createAddLayerCommand = (layer: Layer, index?: number): Command => ({
  id: createCommandId(),
  description: `Add layer "${layer.name}"`,
  
  execute: (doc) => {
    const newLayers = [...doc.layers];
    const insertIndex = index ?? newLayers.length;
    newLayers.splice(insertIndex, 0, layer);
    
    return { 
      ...doc, 
      layers: newLayers, 
      activeLayerId: layer.id,
      meta: { ...doc.meta, modified: Date.now() },
    };
  },
  
  undo: (doc) => {
    const newLayers = doc.layers.filter(l => l.id !== layer.id);
    const newActiveId = newLayers[0]?.id ?? '';
    
    return { 
      ...doc, 
      layers: newLayers, 
      activeLayerId: doc.activeLayerId === layer.id ? newActiveId : doc.activeLayerId,
      meta: { ...doc.meta, modified: Date.now() },
    };
  },
});

/** Creates a command to delete a layer */
export const createDeleteLayerCommand = (layerId: LayerId): Command => {
  let deletedLayer: Layer | null = null;
  let deletedIndex = -1;
  
  return {
    id: createCommandId(),
    description: 'Delete layer',
    
    canExecute: (doc) => {
      // Only allow deletion if there's more than one layer
      return doc.layers.length > 1 && doc.layers.some(l => l.id === layerId);
    },
    
    execute: (doc) => {
      deletedIndex = doc.layers.findIndex(l => l.id === layerId);
      if (deletedIndex === -1) return doc;
      
      deletedLayer = doc.layers[deletedIndex];
      const newLayers = doc.layers.filter(l => l.id !== layerId);
      
      // Don't delete the last layer (should be caught by canExecute)
      if (newLayers.length === 0) return doc;
      
      const newActiveId = doc.activeLayerId === layerId 
        ? (newLayers[Math.max(0, deletedIndex - 1)]?.id ?? newLayers[0].id)
        : doc.activeLayerId;
      
      return { 
        ...doc, 
        layers: newLayers, 
        activeLayerId: newActiveId,
        meta: { ...doc.meta, modified: Date.now() },
      };
    },
    
    undo: (doc) => {
      if (!deletedLayer || deletedIndex === -1) return doc;
      
      const newLayers = [...doc.layers];
      newLayers.splice(deletedIndex, 0, deletedLayer);
      
      return { 
        ...doc, 
        layers: newLayers, 
        activeLayerId: deletedLayer.id,
        meta: { ...doc.meta, modified: Date.now() },
      };
    },
  };
};

/** Creates a command to toggle layer visibility */
export const createToggleVisibilityCommand = (layerId: LayerId): Command => ({
  id: createCommandId(),
  description: 'Toggle layer visibility',
  
  execute: (doc) => {
    const layerIndex = doc.layers.findIndex(l => l.id === layerId);
    if (layerIndex === -1) return doc;
    
    const layer = doc.layers[layerIndex];
    const newLayers = [...doc.layers];
    newLayers[layerIndex] = { ...layer, visible: !layer.visible };
    
    return { ...doc, layers: newLayers };
  },
  
  undo: (doc) => {
    const layerIndex = doc.layers.findIndex(l => l.id === layerId);
    if (layerIndex === -1) return doc;
    
    const layer = doc.layers[layerIndex];
    const newLayers = [...doc.layers];
    newLayers[layerIndex] = { ...layer, visible: !layer.visible };
    
    return { ...doc, layers: newLayers };
  },
});

/** Creates a command to rename a layer */
export const createRenameLayerCommand = (layerId: LayerId, newName: string): Command => {
  let oldName = '';
  
  return {
    id: createCommandId(),
    description: `Rename layer to "${newName}"`,
    
    execute: (doc) => {
      const layerIndex = doc.layers.findIndex(l => l.id === layerId);
      if (layerIndex === -1) return doc;
      
      oldName = doc.layers[layerIndex].name;
      const newLayers = [...doc.layers];
      newLayers[layerIndex] = { ...newLayers[layerIndex], name: newName };
      
      return { ...doc, layers: newLayers, meta: { ...doc.meta, modified: Date.now() } };
    },
    
    undo: (doc) => {
      const layerIndex = doc.layers.findIndex(l => l.id === layerId);
      if (layerIndex === -1) return doc;
      
      const newLayers = [...doc.layers];
      newLayers[layerIndex] = { ...newLayers[layerIndex], name: oldName };
      
      return { ...doc, layers: newLayers, meta: { ...doc.meta, modified: Date.now() } };
    },
  };
};

/** Creates a command to change layer opacity */
export const createSetOpacityCommand = (layerId: LayerId, opacity: number): Command => {
  let oldOpacity = 1;
  
  return {
    id: createCommandId(),
    description: 'Change layer opacity',
    
    execute: (doc) => {
      const layerIndex = doc.layers.findIndex(l => l.id === layerId);
      if (layerIndex === -1) return doc;
      
      oldOpacity = doc.layers[layerIndex].opacity;
      const newLayers = [...doc.layers];
      newLayers[layerIndex] = { ...newLayers[layerIndex], opacity: Math.max(0, Math.min(1, opacity)) };
      
      return { ...doc, layers: newLayers };
    },
    
    undo: (doc) => {
      const layerIndex = doc.layers.findIndex(l => l.id === layerId);
      if (layerIndex === -1) return doc;
      
      const newLayers = [...doc.layers];
      newLayers[layerIndex] = { ...newLayers[layerIndex], opacity: oldOpacity };
      
      return { ...doc, layers: newLayers };
    },
  };
};

/** Creates a command to change layer z-index */
export const createSetZIndexCommand = (layerId: LayerId, zIndex: number): Command => {
  let oldZIndex = 0;
  
  return {
    id: createCommandId(),
    description: `Set layer z-index to ${zIndex}`,
    
    execute: (doc) => {
      const layerIndex = doc.layers.findIndex(l => l.id === layerId);
      if (layerIndex === -1) return doc;
      
      oldZIndex = doc.layers[layerIndex].zIndex;
      const newLayers = [...doc.layers];
      newLayers[layerIndex] = { ...newLayers[layerIndex], zIndex };
      
      return { ...doc, layers: newLayers, meta: { ...doc.meta, modified: Date.now() } };
    },
    
    undo: (doc) => {
      const layerIndex = doc.layers.findIndex(l => l.id === layerId);
      if (layerIndex === -1) return doc;
      
      const newLayers = [...doc.layers];
      newLayers[layerIndex] = { ...newLayers[layerIndex], zIndex: oldZIndex };
      
      return { ...doc, layers: newLayers, meta: { ...doc.meta, modified: Date.now() } };
    },
  };
};

/** Creates a command to change layer iso height offset */
export const createSetIsoHeightCommand = (layerId: LayerId, isoHeight: number): Command => {
  let oldIsoHeight = 0;
  
  return {
    id: createCommandId(),
    description: `Set layer iso height to ${isoHeight}`,
    
    execute: (doc) => {
      const layerIndex = doc.layers.findIndex(l => l.id === layerId);
      if (layerIndex === -1) return doc;
      
      oldIsoHeight = doc.layers[layerIndex].isoHeight;
      const newLayers = [...doc.layers];
      newLayers[layerIndex] = { ...newLayers[layerIndex], isoHeight };
      
      return { ...doc, layers: newLayers, meta: { ...doc.meta, modified: Date.now() } };
    },
    
    undo: (doc) => {
      const layerIndex = doc.layers.findIndex(l => l.id === layerId);
      if (layerIndex === -1) return doc;
      
      const newLayers = [...doc.layers];
      newLayers[layerIndex] = { ...newLayers[layerIndex], isoHeight: oldIsoHeight };
      
      return { ...doc, layers: newLayers, meta: { ...doc.meta, modified: Date.now() } };
    },
  };
};
