/**
 * Minimal Tiled JSON helpers (v0.1).
 * - Supports tilelayer with numeric data arrays.
 * - Supports infinite maps with chunks containing numeric data arrays.
 * - Decodes flip flags from gid.
 */

import type { Grid2D } from '../../core/grid2d.js';
import { makeCell, setXY } from '../../core/grid2d.js';

export type TiledChunk = {
  x: number;
  y: number;
  width: number;
  height: number;
  data: number[];
};

export type TiledLayer = {
  type: string;
  name?: string;
  width?: number;
  height?: number;
  offsetx?: number;
  offsety?: number;
  data?: number[];
  chunks?: TiledChunk[];
};

export type TiledTileset = {
  firstgid: number;
  name?: string;
  source?: string;
  tilecount?: number;
  tilewidth?: number;
  tileheight?: number;
  spacing?: number;
  margin?: number;
};

export type TiledMap = {
  width?: number;
  height?: number;
  tilewidth?: number;
  tileheight?: number;
  infinite?: boolean;
  layers?: TiledLayer[];
  tilesets?: TiledTileset[];
};

export type TiledGidInfo = {
  raw: number;
  id: number;
  flipH: boolean;
  flipV: boolean;
  flipD: boolean;
  tileset?: TiledTileset;
  localId?: number;
};

export type ResolvedTileset = {
  tileset: TiledTileset;
  localId: number;
};

export type TiledLayerToGridOptions = {
  tilesets?: TiledTileset[];
  tileW?: number;
  tileH?: number;
  offsetMode?: 'pixels' | 'tiles';
  storeFlipFlags?: boolean;
  writeEmpty?: boolean;
  gidToMaterial?: (info: TiledGidInfo) => number;
  flipFlagsToCellFlags?: (info: TiledGidInfo) => number;
};

const FLIP_H = 0x80000000;
const FLIP_V = 0x40000000;
const FLIP_D = 0x20000000;
const ID_MASK = 0x1fffffff;

export const TILED_FLIP_H = 1 << 0;
export const TILED_FLIP_V = 1 << 1;
export const TILED_FLIP_D = 1 << 2;

export function decodeTiledGid(gid: number): TiledGidInfo {
  const raw = gid >>> 0;
  const flipH = (raw & FLIP_H) !== 0;
  const flipV = (raw & FLIP_V) !== 0;
  const flipD = (raw & FLIP_D) !== 0;
  const id = raw & ID_MASK;
  return { raw, id, flipH, flipV, flipD };
}

export function resolveTilesetForGid(
  tilesets: TiledTileset[] = [],
  id: number
): ResolvedTileset | null {
  let match: TiledTileset | null = null;
  for (const tileset of tilesets) {
    if (tileset.firstgid <= id) {
      if (!match || tileset.firstgid > match.firstgid) {
        match = tileset;
      }
    }
  }
  if (!match) return null;
  const localId = id - match.firstgid;
  if (typeof match.tilecount === 'number' && localId >= match.tilecount) {
    return null;
  }
  return { tileset: match, localId };
}

const defaultFlipFlagsToCellFlags = (info: TiledGidInfo): number => {
  let flags = 0;
  if (info.flipH) flags |= TILED_FLIP_H;
  if (info.flipV) flags |= TILED_FLIP_V;
  if (info.flipD) flags |= TILED_FLIP_D;
  return flags & 0xff;
};

const defaultGidToMaterial = (info: TiledGidInfo): number => info.id & 0xff;

export function tiledLayerToGrid2D(
  layer: TiledLayer,
  grid: Grid2D,
  options: TiledLayerToGridOptions = {}
): void {
  if (layer.type !== 'tilelayer') {
    throw new Error('tiledLayerToGrid2D requires layer.type === "tilelayer"');
  }

  const tileW = options.tileW && options.tileW > 0 ? options.tileW : 1;
  const tileH = options.tileH && options.tileH > 0 ? options.tileH : 1;
  const offsetMode = options.offsetMode ?? 'pixels';
  const storeFlipFlags = options.storeFlipFlags ?? true;
  const writeEmpty = options.writeEmpty ?? true;
  const gidToMaterial = options.gidToMaterial ?? defaultGidToMaterial;
  const flipFlagsToCellFlags = options.flipFlagsToCellFlags ?? defaultFlipFlagsToCellFlags;

  const offsetXRaw = layer.offsetx ?? 0;
  const offsetYRaw = layer.offsety ?? 0;
  const offsetX =
    offsetMode === 'pixels' ? Math.round(offsetXRaw / tileW) : Math.round(offsetXRaw);
  const offsetY =
    offsetMode === 'pixels' ? Math.round(offsetYRaw / tileH) : Math.round(offsetYRaw);

  const tilesets = options.tilesets ?? [];

  const applyTile = (gid: number, x: number, y: number): void => {
    if (gid === 0) {
      if (writeEmpty) setXY(grid, x, y, 0);
      return;
    }
    const info = decodeTiledGid(gid);
    if (info.id === 0) {
      if (writeEmpty) setXY(grid, x, y, 0);
      return;
    }

    const resolved = resolveTilesetForGid(tilesets, info.id);
    if (resolved) {
      info.tileset = resolved.tileset;
      info.localId = resolved.localId;
    }

    const material = gidToMaterial(info) & 0xff;
    const flags = storeFlipFlags ? flipFlagsToCellFlags(info) & 0xff : 0;
    setXY(grid, x, y, makeCell(material, flags));
  };

  if (Array.isArray(layer.data)) {
    const width = layer.width ?? 0;
    const height = layer.height ?? 0;
    if (width <= 0 || height <= 0) {
      throw new Error('tiledLayerToGrid2D requires layer.width/height with layer.data');
    }
    if (layer.data.length < width * height) {
      throw new Error('tiledLayerToGrid2D layer.data is smaller than width*height');
    }
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = y * width + x;
        const gid = layer.data[i] ?? 0;
        applyTile(gid, x + offsetX, y + offsetY);
      }
    }
    return;
  }

  if (Array.isArray(layer.chunks)) {
    for (const chunk of layer.chunks) {
      if (!Array.isArray(chunk.data)) {
        throw new Error('tiledLayerToGrid2D chunk.data must be a number array');
      }
      const expected = chunk.width * chunk.height;
      if (chunk.data.length < expected) {
        throw new Error('tiledLayerToGrid2D chunk.data is smaller than width*height');
      }
      const baseX = chunk.x + offsetX;
      const baseY = chunk.y + offsetY;
      for (let y = 0; y < chunk.height; y += 1) {
        for (let x = 0; x < chunk.width; x += 1) {
          const i = y * chunk.width + x;
          const gid = chunk.data[i] ?? 0;
          applyTile(gid, baseX + x, baseY + y);
        }
      }
    }
  }
}
