import {
  forEachInRectBottomUp,
  forEachInRectMorton,
  forEachInRectRowMajor
} from "./traversal2d";
import type { Surface2D } from "./surface2d";
import type { Palette } from "./palette";

export const CELL_MATERIAL_MASK = 0xff;
export const CELL_FLAG_SHIFT = 8;

export const CHUNK_ACTIVE = 1;
export const CHUNK_DIRTY = 2;

export type Grid2D = {
  width: number;
  height: number;
  chunkSize: number;
  chunkCountX: number;
  chunkCountY: number;
  cells: Uint16Array;
  activeFlags: Uint8Array;
  dirtyFlags: Uint8Array;
};

export type Grid2DCreateOptions = {
  chunkSize?: number;
  cells?: Uint16Array;
};

export type StepOrder = "row-major" | "bottom-up" | "morton";

export type StepCellFn = (i: number, x: number, y: number, grid: Grid2D) => void;

export const makeCell = (material: number, flags = 0): number =>
  ((flags & 0xff) << CELL_FLAG_SHIFT) | (material & 0xff);

export const getMaterial = (cell: number): number => cell & CELL_MATERIAL_MASK;

export const getFlags = (cell: number): number => (cell >>> CELL_FLAG_SHIFT) & 0xff;

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

export function index(grid: Grid2D, x: number, y: number): number {
  return y * grid.width + x;
}

export function inBounds(grid: Grid2D, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height;
}

export function getCell(grid: Grid2D, i: number): number {
  return grid.cells[i] ?? 0;
}

export function setCell(grid: Grid2D, i: number, val: number): void {
  grid.cells[i] = val & 0xffff;
}

export function getXY(grid: Grid2D, x: number, y: number): number {
  if (!inBounds(grid, x, y)) return 0;
  return grid.cells[index(grid, x, y)] ?? 0;
}

export function setXY(grid: Grid2D, x: number, y: number, val: number): void {
  if (!inBounds(grid, x, y)) return;
  grid.cells[index(grid, x, y)] = val & 0xffff;
}

const chunkIndexFromXY = (grid: Grid2D, x: number, y: number): number => {
  const cx = (x / grid.chunkSize) | 0;
  const cy = (y / grid.chunkSize) | 0;
  return cy * grid.chunkCountX + cx;
};

export function markChunkActiveByIndex(grid: Grid2D, i: number): void {
  const x = i % grid.width;
  const y = (i / grid.width) | 0;
  const chunkIndex = chunkIndexFromXY(grid, x, y);
  grid.activeFlags[chunkIndex] = CHUNK_ACTIVE;
}

export function markChunkDirtyByIndex(grid: Grid2D, i: number): void {
  const x = i % grid.width;
  const y = (i / grid.width) | 0;
  const chunkIndex = chunkIndexFromXY(grid, x, y);
  grid.dirtyFlags[chunkIndex] = CHUNK_DIRTY;
}

export function markChunkActiveByXY(grid: Grid2D, x: number, y: number): void {
  if (!inBounds(grid, x, y)) return;
  const idx = chunkIndexFromXY(grid, x, y);
  grid.activeFlags[idx] = CHUNK_ACTIVE;
}

export function markChunkDirtyByXY(grid: Grid2D, x: number, y: number): void {
  if (!inBounds(grid, x, y)) return;
  const idx = chunkIndexFromXY(grid, x, y);
  grid.dirtyFlags[idx] = CHUNK_DIRTY;
}

export function clearActiveFlags(grid: Grid2D): void {
  grid.activeFlags.fill(0);
}

export function clearDirtyFlags(grid: Grid2D): void {
  grid.dirtyFlags.fill(0);
}

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
  for (let y = 0; y < h; y++) {
    let gi = y * gw;
    let si = y * surface.width;
    for (let x = 0; x < w; x++) {
      const mat = cells[gi++] & CELL_MATERIAL_MASK;
      sp[si++] = palette[mat] ?? 0;
    }
  }
}
