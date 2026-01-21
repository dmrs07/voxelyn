/**
 * VoxelForge Editor - Tool System
 */

import type { ToolSettings } from './stores';
import type { EditorDocument, GridLayer, LayerId } from './document/types';
import type { PaintData } from './document/commands';

/** Context passed to tools */
export type ToolContext = {
  doc: EditorDocument;
  layerId: LayerId;
  material: number;
  settings: ToolSettings;
  canvasWidth: number;
  canvasHeight: number;
};

/** Point in grid coordinates */
export type GridPoint = { x: number; y: number };

/** Breshenham line algorithm */
export const bresenhamLine = (x0: number, y0: number, x1: number, y1: number): GridPoint[] => {
  const points: GridPoint[] = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  
  while (true) {
    points.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
  
  return points;
};

/** Get brush points around center based on size and shape */
export const getBrushPoints = (
  cx: number, 
  cy: number, 
  size: number, 
  shape: ToolSettings['brushShape']
): GridPoint[] => {
  const points: GridPoint[] = [];
  const half = Math.floor(size / 2);
  
  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      
      let include = false;
      switch (shape) {
        case 'square':
          include = true;
          break;
        case 'circle':
          include = dx * dx + dy * dy <= half * half;
          break;
        case 'diamond':
          include = Math.abs(dx) + Math.abs(dy) <= half;
          break;
      }
      
      if (include) {
        points.push({ x, y });
      }
    }
  }
  
  return points;
};

/** Flood fill algorithm */
export const floodFill = (
  data: Uint16Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  newMaterial: number,
  tolerance = 0
): GridPoint[] => {
  const points: GridPoint[] = [];
  const startIndex = startY * width + startX;
  const targetMaterial = data[startIndex] & 0xff;
  
  if (targetMaterial === newMaterial) return points;
  
  const visited = new Set<number>();
  const stack: GridPoint[] = [{ x: startX, y: startY }];
  
  while (stack.length > 0) {
    const { x, y } = stack.pop()!;
    const index = y * width + x;
    
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    if (visited.has(index)) continue;
    
    const currentMaterial = data[index] & 0xff;
    if (Math.abs(currentMaterial - targetMaterial) > tolerance) continue;
    
    visited.add(index);
    points.push({ x, y });
    
    stack.push({ x: x + 1, y });
    stack.push({ x: x - 1, y });
    stack.push({ x, y: y + 1 });
    stack.push({ x, y: y - 1 });
  }
  
  return points;
};

/** Creates paint data from points */
export const createPaintDataFromPoints = (
  layerId: LayerId,
  layer: GridLayer,
  points: GridPoint[],
  newMaterial: number
): PaintData => {
  const pixels: PaintData['pixels'] = [];
  const seen = new Set<number>();
  
  for (const { x, y } of points) {
    if (x < 0 || x >= layer.width || y < 0 || y >= layer.height) continue;
    
    const index = y * layer.width + x;
    if (seen.has(index)) continue;
    seen.add(index);
    
    const oldValue = layer.data[index];
    const newValue = (oldValue & 0xff00) | (newMaterial & 0xff); // Keep flags, change material
    
    if (oldValue !== newValue) {
      pixels.push({ index, oldValue, newValue });
    }
  }
  
  return { layerId, pixels };
};

/** Get points for a rectangle (outline or filled) */
export const getRectPoints = (
  x0: number, y0: number, 
  x1: number, y1: number, 
  filled = false
): GridPoint[] => {
  const points: GridPoint[] = [];
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  
  if (filled) {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        points.push({ x, y });
      }
    }
  } else {
    // Outline only
    for (let x = minX; x <= maxX; x++) {
      points.push({ x, y: minY });
      points.push({ x, y: maxY });
    }
    for (let y = minY + 1; y < maxY; y++) {
      points.push({ x: minX, y });
      points.push({ x: maxX, y });
    }
  }
  
  return points;
};

/** Get points for an ellipse (outline or filled) */
export const getEllipsePoints = (
  x0: number, y0: number,
  x1: number, y1: number,
  filled = false
): GridPoint[] => {
  const points: GridPoint[] = [];
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rx = Math.abs(x1 - x0) / 2;
  const ry = Math.abs(y1 - y0) / 2;
  
  if (rx === 0 || ry === 0) return points;
  
  // Midpoint ellipse algorithm
  const plotPoints = (px: number, py: number) => {
    const ix = Math.round(px);
    const iy = Math.round(py);
    if (filled) {
      for (let x = Math.round(cx - (px - cx)); x <= ix; x++) {
        points.push({ x, y: iy });
        points.push({ x, y: Math.round(2 * cy - iy) });
      }
    } else {
      points.push({ x: ix, y: iy });
      points.push({ x: Math.round(2 * cx - ix), y: iy });
      points.push({ x: ix, y: Math.round(2 * cy - iy) });
      points.push({ x: Math.round(2 * cx - ix), y: Math.round(2 * cy - iy) });
    }
  };
  
  let x = 0;
  let y = ry;
  const rx2 = rx * rx;
  const ry2 = ry * ry;
  let p1 = ry2 - rx2 * ry + 0.25 * rx2;
  
  while (2 * ry2 * x <= 2 * rx2 * y) {
    plotPoints(cx + x, cy + y);
    x++;
    if (p1 < 0) {
      p1 += 2 * ry2 * x + ry2;
    } else {
      y--;
      p1 += 2 * ry2 * x - 2 * rx2 * y + ry2;
    }
  }
  
  let p2 = ry2 * (x + 0.5) * (x + 0.5) + rx2 * (y - 1) * (y - 1) - rx2 * ry2;
  while (y >= 0) {
    plotPoints(cx + x, cy + y);
    y--;
    if (p2 > 0) {
      p2 += rx2 - 2 * rx2 * y;
    } else {
      x++;
      p2 += 2 * ry2 * x - 2 * rx2 * y + rx2;
    }
  }
  
  return points;
};

/** Magic Wand - seleciona região contígua do mesmo material */
export const magicWandSelect = (
  data: Uint16Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  tolerance = 0
): { x: number; y: number; width: number; height: number; mask: Uint8Array } | null => {
  if (startX < 0 || startX >= width || startY < 0 || startY >= height) return null;
  
  const startIndex = startY * width + startX;
  const targetMaterial = data[startIndex] & 0xff;
  
  const visited = new Set<number>();
  const selected = new Set<number>();
  const stack: GridPoint[] = [{ x: startX, y: startY }];
  
  let minX = startX, maxX = startX, minY = startY, maxY = startY;
  
  while (stack.length > 0) {
    const { x, y } = stack.pop()!;
    const index = y * width + x;
    
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    if (visited.has(index)) continue;
    visited.add(index);
    
    const currentMaterial = data[index] & 0xff;
    if (Math.abs(currentMaterial - targetMaterial) > tolerance) continue;
    
    selected.add(index);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    
    stack.push({ x: x + 1, y });
    stack.push({ x: x - 1, y });
    stack.push({ x, y: y + 1 });
    stack.push({ x, y: y - 1 });
  }
  
  if (selected.size === 0) return null;
  
  const selWidth = maxX - minX + 1;
  const selHeight = maxY - minY + 1;
  const mask = new Uint8Array(selWidth * selHeight);
  
  for (const index of selected) {
    const gx = index % width;
    const gy = Math.floor(index / width);
    const mx = gx - minX;
    const my = gy - minY;
    mask[my * selWidth + mx] = 1;
  }
  
  return { x: minX, y: minY, width: selWidth, height: selHeight, mask };
};
