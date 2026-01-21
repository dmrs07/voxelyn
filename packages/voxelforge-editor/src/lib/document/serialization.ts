/**
 * VoxelForge Editor - Document Serialization
 * Save/Load documents in .vxf (VoxelForge) format
 */

import type { EditorDocument, Layer, GridLayer, Material } from './types';
import { createGridLayer } from './types';

/** File format version */
const FORMAT_VERSION = 1;

/** Serialized document structure */
export type SerializedDocument = {
  version: number;
  meta: EditorDocument['meta'];
  width: number;
  height: number;
  depth: number;
  viewMode: EditorDocument['viewMode'];
  palette: SerializedPalette;
  layers: SerializedLayer[];
  activeLayerId: string;
};

type SerializedPalette = Array<{
  id: number;
  name: string;
  color: number;
  flags: number;
}>;

type SerializedLayer = {
  id: string;
  name: string;
  type: 'grid2d' | 'voxel3d' | 'reference';
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode?: 'normal' | 'multiply' | 'screen' | 'overlay';
  zIndex?: number;
  isoHeight?: number;
  width?: number;
  height?: number;
  depth?: number;
  data?: string; // Base64 encoded Uint16Array
  imageUrl?: string;
};

/** Encode Uint16Array to base64 */
const encodeData = (data: Uint16Array): string => {
  const uint8 = new Uint8Array(data.buffer);
  let binary = '';
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return btoa(binary);
};

/** Decode base64 to Uint16Array */
const decodeData = (base64: string, length: number): Uint16Array => {
  const binary = atob(base64);
  const uint8 = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    uint8[i] = binary.charCodeAt(i);
  }
  return new Uint16Array(uint8.buffer).slice(0, length);
};

/** Serialize an EditorDocument to JSON */
export const serializeDocument = (doc: EditorDocument): SerializedDocument => {
  const serializePalette = (palette: Material[]): SerializedPalette => {
    return palette.map((mat, id) => ({
      id,
      name: mat.name,
      color: mat.color,
      flags: 0,
    }));
  };

  const serializeLayer = (layer: Layer): SerializedLayer => {
    const base: SerializedLayer = {
      id: layer.id,
      name: layer.name,
      type: layer.type,
      visible: layer.visible,
      locked: layer.locked,
      opacity: layer.opacity,
      blendMode: layer.blendMode,
    };

    if (layer.type === 'grid2d') {
      return {
        ...base,
        width: layer.width,
        height: layer.height,
        data: encodeData(layer.data),
      };
    }

    if (layer.type === 'voxel3d') {
      return {
        ...base,
        width: layer.width,
        height: layer.height,
        depth: layer.depth,
        data: encodeData(layer.data),
      };
    }

    if (layer.type === 'reference') {
      return {
        ...base,
        imageUrl: layer.imageUrl,
      };
    }

    return base;
  };

  return {
    version: FORMAT_VERSION,
    meta: { ...doc.meta },
    width: doc.width,
    height: doc.height,
    depth: doc.depth,
    viewMode: doc.viewMode,
    palette: serializePalette(doc.palette),
    layers: doc.layers.map(serializeLayer),
    activeLayerId: doc.activeLayerId,
  };
};

/** Deserialize JSON to EditorDocument */
export const deserializeDocument = (data: SerializedDocument): EditorDocument => {
  if (data.version > FORMAT_VERSION) {
    throw new Error(`Unsupported file version: ${data.version}. Max supported: ${FORMAT_VERSION}`);
  }

  const palette: Material[] = data.palette.map((p, index) => ({
    id: index,
    name: p.name,
    color: p.color,
    density: 1,
    friction: 0.5,
    isLiquid: false,
    isGaseous: false,
    isTransparent: false,
    isGas: false,
    flammable: false,
  }));

  const layers: Layer[] = data.layers.map((sl, index) => {
    const base = {
      id: sl.id,
      name: sl.name,
      visible: sl.visible,
      locked: sl.locked,
      opacity: sl.opacity,
        blendMode: sl.blendMode ?? 'normal',
      zIndex: sl.zIndex ?? index,
      isoHeight: sl.isoHeight ?? 0,
    };

    if (sl.type === 'grid2d' && sl.width && sl.height && sl.data) {
      return {
        ...base,
        type: 'grid2d' as const,
        width: sl.width,
        height: sl.height,
        data: decodeData(sl.data, sl.width * sl.height),
      };
    }

    if (sl.type === 'voxel3d' && sl.width && sl.height && sl.depth && sl.data) {
      return {
        ...base,
        type: 'voxel3d' as const,
        width: sl.width,
        height: sl.height,
        depth: sl.depth,
        data: decodeData(sl.data, sl.width * sl.height * sl.depth),
      };
    }

    if (sl.type === 'reference' && sl.imageUrl) {
      return {
        ...base,
        type: 'reference' as const,
        imageUrl: sl.imageUrl,
      };
    }

    // Fallback - create empty grid layer
    return createGridLayer(data.width, data.height, sl.name);
  });

  return {
    meta: data.meta,
    width: data.width,
    height: data.height,
    depth: data.depth,
    viewMode: data.viewMode,
    palette,
    layers,
    activeLayerId: data.activeLayerId || layers[0]?.id || '',
    camera: { x: 0, y: 0, zoom: 1, rotation: 0 },
    selection: { active: false, x: 0, y: 0, width: 0, height: 0 },
  };
};

/** Save document to a file download */
export const saveDocumentToFile = (doc: EditorDocument, filename?: string): void => {
  const serialized = serializeDocument(doc);
  const json = JSON.stringify(serialized, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `${doc.meta.name || 'untitled'}.vxf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/** Load document from a file */
export const loadDocumentFromFile = (): Promise<EditorDocument> => {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.vxf,.json';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }
      
      try {
        const text = await file.text();
        const data = JSON.parse(text) as SerializedDocument;
        const doc = deserializeDocument(data);
        resolve(doc);
      } catch (err) {
        reject(new Error(`Failed to load file: ${err}`));
      }
    };
    
    input.oncancel = () => {
      reject(new Error('File selection cancelled'));
    };
    
    input.click();
  });
};

/** Export layer as PNG image */
export const exportLayerAsPNG = (layer: GridLayer, palette: Material[], filename?: string): void => {
  const canvas = document.createElement('canvas');
  canvas.width = layer.width;
  canvas.height = layer.height;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(layer.width, layer.height);
  
  for (let i = 0; i < layer.data.length; i++) {
    const mat = layer.data[i] & 0xff;
    const material = palette[mat];
    if (!material || mat === 0) continue;
    
    const color = material.color;
    const r = color & 0xff;
    const g = (color >> 8) & 0xff;
    const b = (color >> 16) & 0xff;
    const a = (color >> 24) & 0xff;
    
    const pi = i * 4;
    imageData.data[pi] = r;
    imageData.data[pi + 1] = g;
    imageData.data[pi + 2] = b;
    imageData.data[pi + 3] = a;
  }
  
  ctx.putImageData(imageData, 0, 0);
  
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `${layer.name}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 'image/png');
};
