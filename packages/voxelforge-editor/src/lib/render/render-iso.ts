/**
 * VoxelForge Editor - Isometric 2.5D Rendering
 * Renders Grid2D layers as isometric tiles with configurable height and z-index
 */

import { projectIso, forEachIsoOrder, type DrawCommand, sortDrawCommands, makeDrawKey } from '@voxelyn/core';
import type { EditorDocument, GridLayer, Material, Layer, BlendMode } from '../document/types';

/** Height mode presets for isometric rendering */
export type IsoHeightMode = 
  | 'flat'           // All tiles at z=0 (classic top-down feel)
  | 'density'        // Height based on material density
  | 'uniform'        // All non-air tiles have same height
  | 'custom';        // Use material.isoHeight if set, else default

/** Isometric render settings */
export type IsoSettings = {
  tileW: number;           // Tile width in pixels (default 32)
  tileH: number;           // Tile height in pixels (default 16)
  zStep: number;           // Pixels per Z unit (default 8)
  defaultHeight: number;   // Default wall height when no override (default 8)
  heightMode: IsoHeightMode; // How to calculate material height
  baselineZ: number;       // Baseline Z for the grid (default 0)
  lightDir: { x: number; y: number; z: number }; // Light direction for shading
};

const DEFAULT_ISO_SETTINGS: IsoSettings = {
  tileW: 32,
  tileH: 16,
  zStep: 8,
  defaultHeight: 8,
  heightMode: 'density',
  baselineZ: 0,
  lightDir: { x: -0.5, y: -0.5, z: 1 },
};

/** Unpacks RGBA from packed uint32 */
const unpack = (color: number) => ({
  r: color & 0xff,
  g: (color >> 8) & 0xff,
  b: (color >> 16) & 0xff,
  a: (color >> 24) & 0xff,
});

/** Creates a shaded color based on face normal */
const shadeColor = (color: number, brightness: number): string => {
  const c = unpack(color);
  const r = Math.round(Math.max(0, Math.min(255, c.r * brightness)));
  const g = Math.round(Math.max(0, Math.min(255, c.g * brightness)));
  const b = Math.round(Math.max(0, Math.min(255, c.b * brightness)));
  return `rgba(${r},${g},${b},${c.a / 255})`;
};

/** Draws an isometric tile (diamond shape) */
const drawIsoTile = (
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  tileW: number,
  tileH: number,
  color: string
) => {
  const hw = tileW / 2;
  const hh = tileH / 2;
  
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(sx, sy - hh);      // Top
  ctx.lineTo(sx + hw, sy);      // Right
  ctx.lineTo(sx, sy + hh);      // Bottom
  ctx.lineTo(sx - hw, sy);      // Left
  ctx.closePath();
  ctx.fill();
};

/** Draws vertical walls for a tile */
const drawIsoWalls = (
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  tileW: number,
  tileH: number,
  wallPixelHeight: number,
  baseColor: number,
  lightDir: { x: number; y: number; z: number }
) => {
  if (wallPixelHeight <= 0) return;
  
  const hw = tileW / 2;
  const hh = tileH / 2;
  
  // Left wall (darker)
  const leftBrightness = 0.6 + 0.2 * lightDir.x;
  ctx.fillStyle = shadeColor(baseColor, leftBrightness);
  ctx.beginPath();
  ctx.moveTo(sx - hw, sy);
  ctx.lineTo(sx, sy + hh);
  ctx.lineTo(sx, sy + hh + wallPixelHeight);
  ctx.lineTo(sx - hw, sy + wallPixelHeight);
  ctx.closePath();
  ctx.fill();
  
  // Right wall (medium)
  const rightBrightness = 0.7 + 0.2 * lightDir.y;
  ctx.fillStyle = shadeColor(baseColor, rightBrightness);
  ctx.beginPath();
  ctx.moveTo(sx + hw, sy);
  ctx.lineTo(sx, sy + hh);
  ctx.lineTo(sx, sy + hh + wallPixelHeight);
  ctx.lineTo(sx + hw, sy + wallPixelHeight);
  ctx.closePath();
  ctx.fill();
};

/**
 * Gets the height for a material based on settings
 */
const getMaterialHeight = (
  material: Material | undefined,
  settings: IsoSettings
): number => {
  if (!material || material.id === 0) return 0;
  
  const { heightMode, defaultHeight } = settings;
  
  switch (heightMode) {
    case 'flat':
      return 0;
    
    case 'uniform':
      return defaultHeight;
    
    case 'density':
      // Use density as height factor (0-100 maps to 0-defaultHeight)
      return (material.density / 100) * defaultHeight;
    
    case 'custom':
    default:
      // Use material's isoHeight if defined, else fall back to density-based
      if (material.isoHeight !== undefined) {
        return material.isoHeight;
      }
      return (material.density / 100) * defaultHeight;
  }
};

/**
 * Sorts layers by zIndex for proper rendering order
 */
const sortLayersByZIndex = (layers: Layer[]): Layer[] => {
  return [...layers].sort((a, b) => a.zIndex - b.zIndex);
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

/**
 * Renders the document in isometric 2.5D mode
 */
export const renderDocumentIso = (
  ctx: CanvasRenderingContext2D,
  doc: EditorDocument,
  canvasWidth: number,
  canvasHeight: number,
  camera: { x: number; y: number; zoom: number; rotation: number },
  settings: Partial<IsoSettings> = {},
  showGrid: boolean = true,
  gridStep: number = 1
) => {
  const opts: IsoSettings = { ...DEFAULT_ISO_SETTINGS, ...settings };
  const { tileW, tileH, zStep, baselineZ, lightDir } = opts;
  
  // Clear canvas
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  
  // Calculate center offset
  const centerX = canvasWidth / 2 + camera.x;
  const centerY = canvasHeight / 3 + camera.y;
  
  ctx.save();
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(centerX / camera.zoom, centerY / camera.zoom);
  
  // Collect all draw commands from all layers
  const commands: DrawCommand[] = [];
  
  // Sort layers by zIndex (lowest first = drawn first = behind)
  const sortedLayers = sortLayersByZIndex(doc.layers);
  
  for (const layer of sortedLayers) {
    if (!layer.visible || layer.type !== 'grid2d') continue;
    const grid = layer as GridLayer;
    
    // Layer's base Z position (from zIndex + isoHeight)
    // zIndex acts as a multiplier for layer stacking
    // isoHeight is an additional pixel offset
    const layerBaseZ = baselineZ + layer.zIndex * opts.defaultHeight;
    const layerPixelOffset = layer.isoHeight;
    const layerOpacity = layer.opacity;
    const layerBlendMode = layer.blendMode ?? 'normal';
    
    forEachIsoOrder(grid.width, grid.height, (x: number, y: number) => {
      const idx = y * grid.width + x;
      const cell = grid.data[idx];
      const mat = cell & 0xff;
      
      if (mat === 0) return;
      
      const material = doc.palette[mat];
      if (!material) return;
      
      const materialHeight = getMaterialHeight(material, opts);
      const totalZ = layerBaseZ + materialHeight;
      
      // Project to screen (including layer's pixel offset)
      const { sx, sy: baseSy } = projectIso(x, y, totalZ, tileW, tileH, zStep);
      const sy = baseSy - layerPixelOffset;
      
      // Create draw command with proper sort key
      // Key includes layer zIndex for proper inter-layer sorting
      // Higher zIndex = drawn later = in front
      const key = makeDrawKey(x, y, Math.floor(totalZ + layer.zIndex * 100), layer.zIndex + 128);
      
      commands.push({
        key,
        draw: () => {
          ctx.globalAlpha = layerOpacity;
          ctx.globalCompositeOperation = getCompositeOperation(layerBlendMode);
          
          // Draw walls if height > 0
          if (materialHeight > 0) {
            const wallPixelHeight = materialHeight * zStep / opts.defaultHeight * 4;
            drawIsoWalls(ctx, sx, sy, tileW, tileH, wallPixelHeight, material.color, lightDir);
          }
          
          // Draw top face (brightest)
          const topBrightness = 0.9 + 0.1 * lightDir.z;
          drawIsoTile(ctx, sx, sy, tileW, tileH, shadeColor(material.color, topBrightness));
        },
      });
    });
  }
  
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  
  // Sort and execute draw commands
  sortDrawCommands(commands);
  for (const cmd of commands) {
    cmd.draw();
  }
  
  ctx.globalAlpha = 1;
  
  // Draw grid lines (optional, at baseline)
  if (showGrid && camera.zoom >= 0.5) {
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 0.5 / camera.zoom;
    
    const firstGrid = sortedLayers.find(l => l.type === 'grid2d') as GridLayer | undefined;
    if (firstGrid) {
      for (let x = 0; x <= firstGrid.width; x += gridStep) {
        const p1 = projectIso(x, 0, baselineZ, tileW, tileH, zStep);
        const p2 = projectIso(x, firstGrid.height, baselineZ, tileW, tileH, zStep);
        ctx.beginPath();
        ctx.moveTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.stroke();
      }
      for (let y = 0; y <= firstGrid.height; y += gridStep) {
        const p1 = projectIso(0, y, baselineZ, tileW, tileH, zStep);
        const p2 = projectIso(firstGrid.width, y, baselineZ, tileW, tileH, zStep);
        ctx.beginPath();
        ctx.moveTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.stroke();
      }
    }
  }
  
  ctx.restore();
};

/** Converts screen coordinates to isometric grid coordinates */
export const screenToIso = (
  screenX: number,
  screenY: number,
  canvasWidth: number,
  canvasHeight: number,
  camera: { x: number; y: number; zoom: number },
  settings: Partial<IsoSettings> = {}
): { x: number; y: number } => {
  const opts: IsoSettings = { ...DEFAULT_ISO_SETTINGS, ...settings };
  const { tileW, tileH } = opts;
  
  const centerX = canvasWidth / 2 + camera.x;
  const centerY = canvasHeight / 3 + camera.y;
  
  // Transform screen to world
  const worldX = (screenX - centerX) / camera.zoom;
  const worldY = (screenY - centerY) / camera.zoom;
  
  // Inverse isometric projection (at z=0)
  const x = (worldX / (tileW / 2) + worldY / (tileH / 2)) / 2;
  const y = (worldY / (tileH / 2) - worldX / (tileW / 2)) / 2;
  
  return { x: Math.floor(x), y: Math.floor(y) };
};

/** Preset configurations for common use cases */
export const ISO_PRESETS = {
  /** Classic flat 2D look (no height) */
  flat: {
    heightMode: 'flat' as IsoHeightMode,
    defaultHeight: 0,
  },
  /** Uniform blocks like Minecraft */
  blocks: {
    heightMode: 'uniform' as IsoHeightMode,
    defaultHeight: 8,
  },
  /** Height based on material density */
  terrain: {
    heightMode: 'density' as IsoHeightMode,
    defaultHeight: 12,
  },
  /** Custom per-material heights */
  custom: {
    heightMode: 'custom' as IsoHeightMode,
    defaultHeight: 8,
  },
  /** Smaller tiles for detailed maps */
  detailed: {
    tileW: 16,
    tileH: 8,
    zStep: 4,
    defaultHeight: 4,
    heightMode: 'density' as IsoHeightMode,
  },
  /** Larger tiles for overview */
  overview: {
    tileW: 64,
    tileH: 32,
    zStep: 16,
    defaultHeight: 16,
    heightMode: 'density' as IsoHeightMode,
  },
} as const;
