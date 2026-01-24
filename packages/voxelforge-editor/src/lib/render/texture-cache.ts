/**
 * VoxelForge Editor - Texture Cache System
 * Caches procedurally generated textures for materials
 */

import { 
  generateTextureForMaterial,
  type TextureOptions 
} from '@voxelyn/core';
import type { Material } from '../document/types';

export type TextureTile = {
  materialId: number;
  imageData: ImageData;
  pattern: CanvasPattern | null;
  seed: number;
};

export type TextureCache = {
  tiles: Map<number, TextureTile>;
  size: number;
  lastSeed: number;
};

let globalCache: TextureCache | null = null;

// Offscreen canvas reserved for future use (WebGL texture atlas generation)
let _offscreenCanvas: OffscreenCanvas | null = null;

/**
 * Initialize the texture cache system
 */
export const initTextureCache = (tileSize: number = 16): TextureCache => {
  if (globalCache && globalCache.size === tileSize) {
    return globalCache;
  }
  
  globalCache = {
    tiles: new Map(),
    size: tileSize,
    lastSeed: Date.now(),
  };
  
  // Create offscreen canvas for pattern creation
  if (typeof OffscreenCanvas !== 'undefined') {
    _offscreenCanvas = new OffscreenCanvas(tileSize, tileSize);
  }
  
  return globalCache;
};

/**
 * Get or generate a texture tile for a material
 */
export const getTextureTile = (
  material: Material,
  patternCtx: CanvasRenderingContext2D,
  options: Partial<TextureOptions> = {}
): TextureTile | null => {
  if (!globalCache) {
    initTextureCache();
  }
  
  const cache = globalCache!;
  const cached = cache.tiles.get(material.id);
  
  // Return cached if seed matches
  if (cached && cached.seed === cache.lastSeed) {
    return cached;
  }
  
  // Generate new texture
  const size = cache.size;
  const textureData = generateTextureForMaterial(material, {
    width: size,
    height: size,
    seed: material.id * 1000 + cache.lastSeed,
    scale: options.scale ?? 2,
  });
  
  // Convert Uint32Array to ImageData
  const imageData = new ImageData(size, size);
  const pixels = imageData.data;
  
  for (let i = 0; i < textureData.length; i++) {
    const color = textureData[i]!;
    const r = color & 0xff;
    const g = (color >> 8) & 0xff;
    const b = (color >> 16) & 0xff;
    const a = (color >> 24) & 0xff;
    
    const idx = i * 4;
    pixels[idx] = r;
    pixels[idx + 1] = g;
    pixels[idx + 2] = b;
    pixels[idx + 3] = a;
  }
  
  // Create pattern for efficient rendering
  let pattern: CanvasPattern | null = null;
  
  // Use a temporary canvas to create the pattern
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = size;
  tempCanvas.height = size;
  const tempCtx = tempCanvas.getContext('2d');
  
  if (tempCtx) {
    tempCtx.putImageData(imageData, 0, 0);
    pattern = patternCtx.createPattern(tempCanvas, 'repeat');
  }
  
  const tile: TextureTile = {
    materialId: material.id,
    imageData,
    pattern,
    seed: cache.lastSeed,
  };
  
  cache.tiles.set(material.id, tile);
  return tile;
};

/**
 * Clear the texture cache (call when changing seed or materials)
 */
export const clearTextureCache = (): void => {
  if (globalCache) {
    globalCache.tiles.clear();
    globalCache.lastSeed = Date.now();
  }
};

/**
 * Update seed for new texture generation
 */
export const updateTextureSeed = (seed?: number): void => {
  if (globalCache) {
    globalCache.lastSeed = seed ?? Date.now();
    globalCache.tiles.clear();
  }
};

/**
 * Get cache statistics
 */
export const getTextureCacheStats = (): { count: number; size: number } => {
  return {
    count: globalCache?.tiles.size ?? 0,
    size: globalCache?.size ?? 0,
  };
};

/**
 * Draw a textured isometric tile (diamond shape with texture mapping)
 */
export const drawTexturedIsoTile = (
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  tileW: number,
  tileH: number,
  tile: TextureTile,
  brightness: number = 1.0
): void => {
  const hw = tileW / 2;
  const hh = tileH / 2;
  
  ctx.save();
  
  // Create clipping path for diamond shape
  ctx.beginPath();
  ctx.moveTo(sx, sy - hh);      // Top
  ctx.lineTo(sx + hw, sy);      // Right
  ctx.lineTo(sx, sy + hh);      // Bottom
  ctx.lineTo(sx - hw, sy);      // Left
  ctx.closePath();
  ctx.clip();
  
  // Draw the texture pattern
  if (tile.pattern) {
    // Apply brightness as alpha blending
    ctx.globalAlpha = brightness;
    ctx.fillStyle = tile.pattern;
    
    // Transform to fit the tile area
    ctx.translate(sx - hw, sy - hh);
    ctx.fillRect(0, 0, tileW, tileH * 2);
  } else {
    // Fallback: draw imageData manually (slower)
    const scale = tileW / tile.imageData.width;
    ctx.translate(sx - hw, sy - hh);
    
    // Create temp canvas for scaled drawing
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = tile.imageData.width;
    tempCanvas.height = tile.imageData.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.putImageData(tile.imageData, 0, 0);
      ctx.globalAlpha = brightness;
      ctx.scale(scale, scale);
      ctx.drawImage(tempCanvas, 0, 0);
    }
  }
  
  ctx.restore();
};

/**
 * Draw textured walls for isometric view
 */
export const drawTexturedIsoWalls = (
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  tileW: number,
  tileH: number,
  wallPixelHeight: number,
  tile: TextureTile,
  leftBrightness: number,
  rightBrightness: number
): void => {
  if (wallPixelHeight <= 0) return;
  
  const hw = tileW / 2;
  const hh = tileH / 2;
  
  // Left wall
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(sx - hw, sy);
  ctx.lineTo(sx, sy + hh);
  ctx.lineTo(sx, sy + hh + wallPixelHeight);
  ctx.lineTo(sx - hw, sy + wallPixelHeight);
  ctx.closePath();
  ctx.clip();
  
  if (tile.pattern) {
    ctx.globalAlpha = leftBrightness;
    ctx.fillStyle = tile.pattern;
    ctx.fillRect(sx - hw, sy, hw, wallPixelHeight + hh);
  }
  ctx.restore();
  
  // Right wall
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(sx + hw, sy);
  ctx.lineTo(sx, sy + hh);
  ctx.lineTo(sx, sy + hh + wallPixelHeight);
  ctx.lineTo(sx + hw, sy + wallPixelHeight);
  ctx.closePath();
  ctx.clip();
  
  if (tile.pattern) {
    ctx.globalAlpha = rightBrightness;
    ctx.fillStyle = tile.pattern;
    ctx.fillRect(sx, sy, hw, wallPixelHeight + hh);
  }
  ctx.restore();
};

/**
 * Pre-generate textures for all materials in a palette
 */
export const preloadPaletteTextures = (
  palette: Material[],
  ctx: CanvasRenderingContext2D
): void => {
  for (const material of palette) {
    if (material && material.id !== 0) {
      getTextureTile(material, ctx);
    }
  }
};
