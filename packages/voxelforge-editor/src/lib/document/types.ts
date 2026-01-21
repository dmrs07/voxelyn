import type { Material } from '@voxelyn/core';
import { DEFAULT_MATERIALS } from '@voxelyn/core';

/**
 * VoxelForge Editor - Document Model
 * Core types for representing an editable document
 */

// Material type is imported from voxelyn/core as the foundation

/**
 * Re-export Material type for convenience
 */
export type { Material } from '@voxelyn/core';


/** Unique identifier for layers */
export type LayerId = string;

/** View modes supported by the editor */
export type ViewMode = '2d' | 'iso' | '3d';

/** Layer types */
export type LayerType = 'grid2d' | 'voxel3d' | 'reference';

/** Blend modes supported by layers */
export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay';

/** Base layer interface */
export type LayerBase = {
  id: LayerId;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number; // 0-1
  blendMode: BlendMode;
  zIndex: number; // Z-index for iso/3d modes (can be negative)
  isoHeight: number; // Height offset in iso mode (pixels)
};

/** 2D Grid layer (for Noita-like simulation) */
export type GridLayer = LayerBase & {
  type: 'grid2d';
  data: Uint16Array; // Packed cells (material + flags)
  width: number;
  height: number;
};

/** 3D Voxel layer */
export type VoxelLayer = LayerBase & {
  type: 'voxel3d';
  data: Uint16Array;
  width: number;
  height: number;
  depth: number;
};

/** Reference image layer (non-editable) */
export type ReferenceLayer = LayerBase & {
  type: 'reference';
  imageUrl: string;
};

/** Union of all layer types */
export type Layer = GridLayer | VoxelLayer | ReferenceLayer;

/** Camera state for the viewport */
export type CameraState = {
  x: number; // Pan X
  y: number; // Pan Y
  zoom: number; // 1.0 = 100%
  rotation: number; // For iso/3d modes (0, 90, 180, 270)
};

/** Selection state */
export type Selection = {
  active: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  mask?: Uint8Array; // Optional pixel-level mask
};

/** Document metadata */
export type DocumentMeta = {
  name: string;
  created: number;
  modified: number;
  author?: string;
};

/** The main editor document */
export type EditorDocument = {
  meta: DocumentMeta;
  width: number;
  height: number;
  depth: number; // For 3D mode
  palette: Material[];
  layers: Layer[];
  activeLayerId: LayerId;
  viewMode: ViewMode;
  camera: CameraState;
  selection: Selection;
};

/** Creates a unique layer ID */
export const createLayerId = (): LayerId => 
  `layer_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/** Creates a new empty GridLayer */
export const createGridLayer = (
  width: number,
  height: number,
  name = 'Layer',
  zIndex = 0
): GridLayer => ({
  id: createLayerId(),
  name,
  visible: true,
  locked: false,
  opacity: 1,
  blendMode: 'normal',
  zIndex,
  isoHeight: 0,
  type: 'grid2d',
  data: new Uint16Array(width * height),
  width,
  height,
});

/** Creates a new empty VoxelLayer */
export const createVoxelLayer = (
  width: number,
  height: number,
  depth: number,
  name = 'Voxel Layer',
  zIndex = 0
): VoxelLayer => ({
  id: createLayerId(),
  name,
  visible: true,
  locked: false,
  opacity: 1,
  blendMode: 'normal',
  zIndex,
  isoHeight: 0,
  type: 'voxel3d',
  data: new Uint16Array(width * height * depth),
  width,
  height,
  depth,
});

/** Creates a new reference layer (non-editable image) */
export const createReferenceLayer = (
  imageUrl: string,
  name = 'Reference',
  zIndex = 0
): ReferenceLayer => ({
  id: createLayerId(),
  name,
  visible: true,
  locked: true,
  opacity: 1,
  blendMode: 'normal',
  zIndex,
  isoHeight: 0,
  type: 'reference',
  imageUrl,
});

/** Creates default palette from voxelyn core */
export const createDefaultPalette = (): Material[] => DEFAULT_MATERIALS;

/** Creates a new empty document */
export const createDocument = (
  width = 128,
  height = 128,
  depth = 32,
  name = 'Untitled'
): EditorDocument => {
  const layer = createGridLayer(width, height, 'Background');
  
  return {
    meta: {
      name,
      created: Date.now(),
      modified: Date.now(),
    },
    width,
    height,
    depth,
    palette: createDefaultPalette(),
    layers: [layer],
    activeLayerId: layer.id,
    viewMode: '2d',
    camera: { x: 0, y: 0, zoom: 1, rotation: 0 },
    selection: { active: false, x: 0, y: 0, width: 0, height: 0 },
  };
};

// ============================================
// Document Utilities
// ============================================

/** Get a layer by ID */
export const getLayerById = (doc: EditorDocument, id: LayerId): Layer | undefined =>
  doc.layers.find(l => l.id === id);

/** Get the active layer */
export const getActiveLayer = (doc: EditorDocument): Layer | undefined =>
  getLayerById(doc, doc.activeLayerId);

/** Get layer index */
export const getLayerIndex = (doc: EditorDocument, id: LayerId): number =>
  doc.layers.findIndex(l => l.id === id);

/** Add a new layer at index (default: top) */
export const addLayer = (
  doc: EditorDocument,
  layer: Layer,
  index?: number
): EditorDocument => ({
  ...doc,
  layers: index !== undefined
    ? [...doc.layers.slice(0, index), layer, ...doc.layers.slice(index)]
    : [...doc.layers, layer],
  meta: { ...doc.meta, modified: Date.now() },
});

/** Remove a layer by ID */
export const removeLayer = (doc: EditorDocument, id: LayerId): EditorDocument => {
  const newLayers = doc.layers.filter(l => l.id !== id);
  
  // If we removed the active layer, activate the last one
  const activeId = doc.activeLayerId === id && newLayers.length > 0
    ? newLayers[newLayers.length - 1].id
    : doc.activeLayerId;
  
  return {
    ...doc,
    layers: newLayers,
    activeLayerId: activeId,
    meta: { ...doc.meta, modified: Date.now() },
  };
};

/** Update a layer */
export const updateLayer = (
  doc: EditorDocument,
  id: LayerId,
  updates: Partial<Layer>
): EditorDocument => ({
  ...doc,
  layers: doc.layers.map(l => l.id === id ? { ...l, ...updates } as Layer : l),
  meta: { ...doc.meta, modified: Date.now() },
});

/** Reorder layers (move from index to index) */
export const reorderLayers = (
  doc: EditorDocument,
  fromIndex: number,
  toIndex: number
): EditorDocument => {
  const newLayers = [...doc.layers];
  const [layer] = newLayers.splice(fromIndex, 1);
  newLayers.splice(toIndex, 0, layer);
  
  return {
    ...doc,
    layers: newLayers,
    meta: { ...doc.meta, modified: Date.now() },
  };
};

/** Set active layer */
export const setActiveLayer = (doc: EditorDocument, id: LayerId): EditorDocument => ({
  ...doc,
  activeLayerId: id,
});

/** Update material in palette */
export const updateMaterial = (
  doc: EditorDocument,
  materialId: number,
  updates: Partial<Material>
): EditorDocument => ({
  ...doc,
  palette: doc.palette.map(m => m.id === materialId ? { ...m, ...updates } : m),
  meta: { ...doc.meta, modified: Date.now() },
});

/** Update camera state */
export const updateCamera = (
  doc: EditorDocument,
  updates: Partial<CameraState>
): EditorDocument => ({
  ...doc,
  camera: { ...doc.camera, ...updates },
});

/** Update selection */
export const updateSelection = (
  doc: EditorDocument,
  updates: Partial<Selection>
): EditorDocument => ({
  ...doc,
  selection: { ...doc.selection, ...updates },
  meta: { ...doc.meta, modified: Date.now() },
});

/** Clear selection */
export const clearSelection = (doc: EditorDocument): EditorDocument => ({
  ...doc,
  selection: { active: false, x: 0, y: 0, width: 0, height: 0 },
});

/** Create a rectangular selection */
export const createRectSelection = (
  x: number,
  y: number,
  width: number,
  height: number
): Selection => ({
  active: true,
  x: Math.floor(x),
  y: Math.floor(y),
  width: Math.max(1, Math.floor(width)),
  height: Math.max(1, Math.floor(height)),
});

// ============================================
// Serialization
// ============================================

/** Serialize document to JSON-compatible object */
export const serializeDocument = (doc: EditorDocument): unknown => {
  return {
    meta: doc.meta,
    width: doc.width,
    height: doc.height,
    depth: doc.depth,
    palette: doc.palette,
    layers: doc.layers.map(layer => ({
      ...layer,
      data: Array.from(layer.type === 'reference' ? [] : (layer as GridLayer | VoxelLayer).data),
    })),
    activeLayerId: doc.activeLayerId,
    viewMode: doc.viewMode,
    camera: doc.camera,
    selection: doc.selection,
  };
};

/** Deserialize document from JSON object */
export const deserializeDocument = (data: unknown): EditorDocument | null => {
  try {
    const obj = data as Record<string, unknown>;
    
    // Validate required fields
    if (!obj.meta || typeof obj.meta !== 'object') return null;
    if (typeof obj.width !== 'number' || typeof obj.height !== 'number') return null;
    if (!Array.isArray(obj.palette) || !Array.isArray(obj.layers)) return null;
    
    const palette = obj.palette as Material[];
    const layers: Layer[] = [];
    
    for (const layerData of obj.layers as unknown[]) {
      const layer = layerData as Record<string, unknown>;
      if (!layer.type || !layer.id || !layer.name) continue;
      
      const baseLayer = {
        id: layer.id as string,
        name: layer.name as string,
        visible: layer.visible === true,
        locked: layer.locked === true,
        opacity: typeof layer.opacity === 'number' ? layer.opacity : 1,
        blendMode: (layer.blendMode as BlendMode) || 'normal',
        zIndex: typeof layer.zIndex === 'number' ? layer.zIndex : 0,
        isoHeight: typeof layer.isoHeight === 'number' ? layer.isoHeight : 0,
      };
      
      if (layer.type === 'reference') {
        layers.push({
          ...baseLayer,
          type: 'reference' as const,
          imageUrl: layer.imageUrl as string || '',
        } as ReferenceLayer);
      } else if (layer.type === 'grid2d') {
        layers.push({
          ...baseLayer,
          type: 'grid2d' as const,
          data: new Uint16Array((layer.data as number[]) || []),
          width: layer.width as number,
          height: layer.height as number,
        } as GridLayer);
      } else if (layer.type === 'voxel3d') {
        layers.push({
          ...baseLayer,
          type: 'voxel3d' as const,
          data: new Uint16Array((layer.data as number[]) || []),
          width: layer.width as number,
          height: layer.height as number,
          depth: layer.depth as number,
        } as VoxelLayer);
      }
    }
    
    return {
      meta: obj.meta as DocumentMeta,
      width: obj.width as number,
      height: obj.height as number,
      depth: typeof obj.depth === 'number' ? obj.depth : 32,
      palette,
      layers,
      activeLayerId: (obj.activeLayerId as string) || (layers[0]?.id || ''),
      viewMode: (obj.viewMode as ViewMode) || '2d',
      camera: obj.camera as CameraState || { x: 0, y: 0, zoom: 1, rotation: 0 },
      selection: obj.selection as Selection || { active: false, x: 0, y: 0, width: 0, height: 0 },
    };
  } catch {
    return null;
  }
};

// ============================================
// Validation
// ============================================

/** Validate document integrity */
export const validateDocument = (doc: EditorDocument): string[] => {
  const errors: string[] = [];
  
  if (doc.width < 1 || doc.height < 1) errors.push('Document dimensions must be at least 1x1');
  if (doc.depth < 1) errors.push('Document depth must be at least 1');
  if (doc.palette.length === 0) errors.push('Document must have at least one material');
  if (doc.layers.length === 0) errors.push('Document must have at least one layer');
  
  // Check if active layer exists
  if (!doc.layers.find(l => l.id === doc.activeLayerId)) {
    errors.push('Active layer does not exist');
  }
  
  // Validate each layer
  doc.layers.forEach((layer, idx) => {
    if (!layer.id || !layer.name) errors.push(`Layer ${idx} has missing id or name`);
    if (layer.opacity < 0 || layer.opacity > 1) errors.push(`Layer ${idx} opacity must be 0-1`);
    if (!['normal', 'multiply', 'screen', 'overlay'].includes(layer.blendMode)) {
      errors.push(`Layer ${idx} has invalid blend mode`);
    }
    
    if (layer.type === 'grid2d' || layer.type === 'voxel3d') {
      const gl = layer as GridLayer | VoxelLayer;
      const expectedSize = layer.type === 'grid2d'
        ? gl.width * gl.height
        : (gl as VoxelLayer).width * (gl as VoxelLayer).height * (gl as VoxelLayer).depth;
      
      if (gl.data.length !== expectedSize) {
        errors.push(`Layer ${idx} data size mismatch`);
      }
    }
  });
  
  // Validate selection
  if (doc.selection.active && (doc.selection.width < 1 || doc.selection.height < 1)) {
    errors.push('Active selection must have non-zero width and height');
  }
  
  return errors;
};
