/**
 * Grid2D: Chunked 2D cellular simulation grid (Noita-like).
 * Cells are packed as u16: low byte = material, high byte = flags.
 * Supports chunk-based activation for sparse updates.
 * @module
 */

import {
  forEachInRectBottomUp,
  forEachInRectMorton,
  forEachInRectRowMajor
} from "./traversal2d.js";
import type { Surface2D } from "./surface2d.js";
import type { Palette } from "./palette.js";

/** Bitmask for extracting material ID from cell value */
export const CELL_MATERIAL_MASK = 0xff;
/** Bit shift for cell flags (high byte) */
export const CELL_FLAG_SHIFT = 8;

/** Chunk is active and should be simulated */
export const CHUNK_ACTIVE = 1;
/** Chunk has been modified and needs processing */
export const CHUNK_DIRTY = 2;

/**
 * Chunked 2D grid for cellular simulation.
 * Optimized for Noita-like falling sand simulations.
 */
export type Grid2D = {
  /** Grid width in cells */
  readonly width: number;
  /** Grid height in cells */
  readonly height: number;
  /** Size of each chunk in cells */
  readonly chunkSize: number;
  /** Number of chunks horizontally */
  readonly chunkCountX: number;
  /** Number of chunks vertically */
  readonly chunkCountY: number;
  /** Cell data (u16: low=material, high=flags) */
  readonly cells: Uint16Array;
  /** Per-chunk active flags */
  readonly activeFlags: Uint8Array;
  /** Per-chunk dirty flags */
  readonly dirtyFlags: Uint8Array;
};

/** Options for creating a Grid2D */
export type Grid2DCreateOptions = {
  /** Chunk size in cells (default 64) */
  chunkSize?: number;
  /** Pre-allocated cell buffer */
  cells?: Uint16Array;
};

/** Traversal order for stepping through cells */
export type StepOrder = "row-major" | "bottom-up" | "morton";

/** Callback for per-cell simulation step */
export type StepCellFn = (i: number, x: number, y: number, grid: Grid2D) => void;

/**
 * Creates a packed cell value from material and flags.
 * @param material - Material ID (0-255)
 * @param flags - Cell flags (0-255)
 * @returns Packed u16 cell value
 */
export const makeCell = (material: number, flags = 0): number =>
  ((flags & 0xff) << CELL_FLAG_SHIFT) | (material & 0xff);

/**
 * Extracts material ID from a cell value.
 * @param cell - Packed cell value
 * @returns Material ID (0-255)
 */
export const getMaterial = (cell: number): number => cell & CELL_MATERIAL_MASK;

/**
 * Extracts flags from a cell value.
 * @param cell - Packed cell value
 * @returns Flags (0-255)
 */
export const getFlags = (cell: number): number => (cell >>> CELL_FLAG_SHIFT) & 0xff;

/**
 * Creates a new chunked 2D grid for cellular simulation.
 * @param width - Grid width in cells
 * @param height - Grid height in cells
 * @param options - Optional configuration
 * @returns A new Grid2D instance
 */
export function createGrid2D(
  width: number,
  height: number,
  options: Grid2DCreateOptions = {}
): Grid2D {
  const chunkSize = options.chunkSize ?? 64;
  const size = width * height;
  const cells = options.cells ?? new Uint16Array(size);
  const chunkCountX = Math.ceil(width / chunkSize);
  const chunkCountY = Math.ceil(height / chunkSize);
  const chunkCount = chunkCountX * chunkCountY;
  const activeFlags = new Uint8Array(chunkCount);
  const dirtyFlags = new Uint8Array(chunkCount);

  if (cells.length < size) {
    throw new Error("cells length is smaller than width*height");
  }

  return {
    width,
    height,
    chunkSize,
    chunkCountX,
    chunkCountY,
    cells,
    activeFlags,
    dirtyFlags
  };
}

/**
 * Converts (x, y) coordinates to linear array index.
 * @param grid - Grid instance
 * @param x - X coordinate
 * @param y - Y coordinate
 * @returns Linear index into cells array
 */
export function index(grid: Grid2D, x: number, y: number): number {
  return y * grid.width + x;
}

/**
 * Checks if coordinates are within grid bounds.
 * @param grid - Grid instance
 * @param x - X coordinate
 * @param y - Y coordinate
 * @returns True if (x, y) is within bounds
 */
export function inBounds(grid: Grid2D, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height;
}

/**
 * Gets cell value by linear index.
 * @param grid - Grid instance
 * @param i - Linear index
 * @returns Cell value, or 0 if out of bounds
 */
export function getCell(grid: Grid2D, i: number): number {
  return grid.cells[i] ?? 0;
}

/**
 * Sets cell value by linear index (no bounds check).
 * @param grid - Grid instance
 * @param i - Linear index
 * @param val - Cell value to set
 */
export function setCell(grid: Grid2D, i: number, val: number): void {
  grid.cells[i] = val & 0xffff;
}

/**
 * Gets cell value by coordinates with bounds checking.
 * @param grid - Grid instance
 * @param x - X coordinate
 * @param y - Y coordinate
 * @returns Cell value, or 0 if out of bounds
 */
export function getXY(grid: Grid2D, x: number, y: number): number {
  if (!inBounds(grid, x, y)) return 0;
  return grid.cells[index(grid, x, y)] ?? 0;
}

/**
 * Sets cell value by coordinates with bounds checking.
 * @param grid - Grid instance
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param val - Cell value to set
 */
export function setXY(grid: Grid2D, x: number, y: number, val: number): void {
  if (!inBounds(grid, x, y)) return;
  grid.cells[index(grid, x, y)] = val & 0xffff;
}

/** Computes chunk index from cell coordinates */
const chunkIndexFromXY = (grid: Grid2D, x: number, y: number): number => {
  const cx = (x / grid.chunkSize) | 0;
  const cy = (y / grid.chunkSize) | 0;
  return cy * grid.chunkCountX + cx;
};

/**
 * Marks the chunk containing cell index as active.
 * @param grid - Grid instance
 * @param i - Linear cell index
 */
export function markChunkActiveByIndex(grid: Grid2D, i: number): void {
  const x = i % grid.width;
  const y = (i / grid.width) | 0;
  const chunkIndex = chunkIndexFromXY(grid, x, y);
  grid.activeFlags[chunkIndex] = CHUNK_ACTIVE;
}

/**
 * Marks the chunk containing cell index as dirty.
 * @param grid - Grid instance
 * @param i - Linear cell index
 */
export function markChunkDirtyByIndex(grid: Grid2D, i: number): void {
  const x = i % grid.width;
  const y = (i / grid.width) | 0;
  const chunkIndex = chunkIndexFromXY(grid, x, y);
  grid.dirtyFlags[chunkIndex] = CHUNK_DIRTY;
}

/**
 * Marks the chunk at (x, y) as active.
 * @param grid - Grid instance
 * @param x - X coordinate
 * @param y - Y coordinate
 */
export function markChunkActiveByXY(grid: Grid2D, x: number, y: number): void {
  if (!inBounds(grid, x, y)) return;
  const idx = chunkIndexFromXY(grid, x, y);
  grid.activeFlags[idx] = CHUNK_ACTIVE;
}

/**
 * Marks the chunk at (x, y) as dirty.
 * @param grid - Grid instance
 * @param x - X coordinate
 * @param y - Y coordinate
 */
export function markChunkDirtyByXY(grid: Grid2D, x: number, y: number): void {
  if (!inBounds(grid, x, y)) return;
  const idx = chunkIndexFromXY(grid, x, y);
  grid.dirtyFlags[idx] = CHUNK_DIRTY;
}

/** Clears all active flags (call after simulation step). */
export function clearActiveFlags(grid: Grid2D): void {
  grid.activeFlags.fill(0);
}

/** Clears all dirty flags. */
export function clearDirtyFlags(grid: Grid2D): void {
  grid.dirtyFlags.fill(0);
}

/**
 * Fills a rectangle with a cell value, marking affected chunks.
 * @param grid - Grid instance
 * @param x - Top-left X coordinate
 * @param y - Top-left Y coordinate
 * @param width - Rectangle width
 * @param height - Rectangle height
 * @param cellVal - Cell value to fill
 */
export function paintRect(
  grid: Grid2D,
  x: number,
  y: number,
  width: number,
  height: number,
  cellVal: number
): void {
  const x0 = Math.max(0, x) | 0;
  const y0 = Math.max(0, y) | 0;
  const x1 = Math.min(grid.width, x + width) | 0;
  const y1 = Math.min(grid.height, y + height) | 0;
  const cell = cellVal & 0xffff;

  const cxs = (x0 / grid.chunkSize) | 0;
  const cxe = ((x1 - 1) / grid.chunkSize) | 0;
  const cys = (y0 / grid.chunkSize) | 0;
  const cye = ((y1 - 1) / grid.chunkSize) | 0;
  for (let cy = cys; cy <= cye; cy++) {
    for (let cx = cxs; cx <= cxe; cx++) {
      const cidx = cy * grid.chunkCountX + cx;
      grid.activeFlags[cidx] = CHUNK_ACTIVE;
      grid.dirtyFlags[cidx] = CHUNK_DIRTY;
    }
  }

  for (let yy = y0; yy < y1; yy++) {
    let row = yy * grid.width + x0;
    for (let xx = x0; xx < x1; xx++) {
      grid.cells[row++] = cell;
    }
  }
}

/**
 * Fills a circle with a cell value, marking affected chunks.
 * @param grid - Grid instance
 * @param cx - Center X coordinate
 * @param cy - Center Y coordinate
 * @param radius - Circle radius
 * @param cellVal - Cell value to fill
 */
export function paintCircle(
  grid: Grid2D,
  cx: number,
  cy: number,
  radius: number,
  cellVal: number
): void {
  const r2 = radius * radius;
  const x0 = Math.max(0, cx - radius) | 0;
  const y0 = Math.max(0, cy - radius) | 0;
  const x1 = Math.min(grid.width - 1, cx + radius) | 0;
  const y1 = Math.min(grid.height - 1, cy + radius) | 0;
  const cell = cellVal & 0xffff;

  const cxs = (x0 / grid.chunkSize) | 0;
  const cxe = (x1 / grid.chunkSize) | 0;
  const cys = (y0 / grid.chunkSize) | 0;
  const cye = (y1 / grid.chunkSize) | 0;
  for (let cy0 = cys; cy0 <= cye; cy0++) {
    for (let cx0 = cxs; cx0 <= cxe; cx0++) {
      const cidx = cy0 * grid.chunkCountX + cx0;
      grid.activeFlags[cidx] = CHUNK_ACTIVE;
      grid.dirtyFlags[cidx] = CHUNK_DIRTY;
    }
  }

  for (let y = y0; y <= y1; y++) {
    const dy = y - cy;
    const row = y * grid.width;
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      if (dx * dx + dy * dy <= r2) {
        grid.cells[row + x] = cell;
      }
    }
  }
}

/**
 * Iterates over all active chunks.
 * @param grid - Grid instance
 * @param fn - Callback receiving chunk info
 */
export function forEachActiveChunk(
  grid: Grid2D,
  fn: (
    chunkX: number,
    chunkY: number,
    startX: number,
    startY: number,
    width: number,
    height: number,
    chunkIndex: number
  ) => void
): void {
  const size = grid.chunkSize;
  for (let cy = 0; cy < grid.chunkCountY; cy++) {
    for (let cx = 0; cx < grid.chunkCountX; cx++) {
      const cidx = cy * grid.chunkCountX + cx;
      if (grid.activeFlags[cidx] !== CHUNK_ACTIVE) continue;
      const startX = cx * size;
      const startY = cy * size;
      const w = Math.min(size, grid.width - startX);
      const h = Math.min(size, grid.height - startY);
      fn(cx, cy, startX, startY, w, h, cidx);
    }
  }
}

/**
 * Simulates all active chunks with the given traversal order.
 * @param grid - Grid instance
 * @param order - Traversal order ("bottom-up" for falling sand)
 * @param perCellFn - Callback for each cell
 */
export function stepActiveChunks(
  grid: Grid2D,
  order: StepOrder,
  perCellFn: StepCellFn
): void {
  forEachActiveChunk(grid, (_cx, _cy, startX, startY, w, h) => {
    const visit = (x: number, y: number): void => {
      const i = y * grid.width + x;
      perCellFn(i, x, y, grid);
    };
    if (order === "bottom-up") {
      forEachInRectBottomUp(startX, startY, w, h, visit);
    } else if (order === "morton") {
      forEachInRectMorton(startX, startY, w, h, visit);
    } else {
      forEachInRectRowMajor(startX, startY, w, h, visit);
    }
  });
}

/**
 * Renders the grid to a surface using a color palette.
 * Maps material IDs to palette colors.
 * @param grid - Source grid
 * @param surface - Target surface
 * @param palette - Color palette for material mapping
 */
export function renderToSurface(
  grid: Grid2D,
  surface: Surface2D,
  palette: Palette
): void {
  const w = Math.min(grid.width, surface.width);
  const h = Math.min(grid.height, surface.height);
  const gw = grid.width;
  const sp = surface.pixels;
  const cells = grid.cells;
  const cellsLen = cells.length;
  for (let y = 0; y < h; y++) {
    let gi = y * gw;
    let si = y * surface.width;
    for (let x = 0; x < w; x++) {
      // Safe access: default to material 0 if index out of bounds
      const mat = gi < cellsLen ? (cells[gi] ?? 0) & CELL_MATERIAL_MASK : 0;
      gi++;
      sp[si++] = palette[mat] ?? 0;
    }
  }
}

/**
 * Shader function type for custom per-pixel coloring.
 * Called for each cell during rendering.
 * @param material - Material ID (0-255)
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param baseColor - Color from palette lookup
 * @param cell - Full cell value (material + flags)
 * @returns Final pixel color (RGBA8888)
 */
export type ShaderFn = (
  material: number,
  x: number,
  y: number,
  baseColor: number,
  cell: number
) => number;

/**
 * Renders the grid to a surface with a custom shader function.
 * Allows per-pixel effects like depth shading, noise textures, etc.
 * 
 * @example
 * // Depth shading: darker pixels further from surface
 * renderToSurfaceShaded(grid, surface, palette, (mat, x, y, color) => {
 *   const depth = calculateDepth(x, y);
 *   return multiplyColor(color, 1 - depth * 0.3);
 * });
 * 
 * @param grid - Source grid
 * @param surface - Target surface
 * @param palette - Color palette for material mapping
 * @param shader - Custom shader function
 */
export function renderToSurfaceShaded(
  grid: Grid2D,
  surface: Surface2D,
  palette: Palette,
  shader: ShaderFn
): void {
  const w = Math.min(grid.width, surface.width);
  const h = Math.min(grid.height, surface.height);
  const gw = grid.width;
  const sp = surface.pixels;
  const cells = grid.cells;
  const cellsLen = cells.length;
  
  for (let y = 0; y < h; y++) {
    let gi = y * gw;
    let si = y * surface.width;
    for (let x = 0; x < w; x++) {
      // Safe access: default to cell 0 if index out of bounds
      const cell = gi < cellsLen ? (cells[gi] ?? 0) : 0;
      gi++;
      const mat = cell & CELL_MATERIAL_MASK;
      const baseColor = palette[mat] ?? 0;
      sp[si++] = shader(mat, x, y, baseColor, cell);
    }
  }
}
