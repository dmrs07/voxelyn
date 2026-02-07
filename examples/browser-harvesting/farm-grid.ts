// farm-grid.ts - Farm tile grid and crop management
// 8x8 isometric farm with tile states and crop data

import { forEachIsoOrder, projectIso } from "../../packages/voxelyn-core/src/index.js";

// ============================================================================
// TYPES
// ============================================================================
export type TileType = 'grass' | 'tilled' | 'watered';

export type CropData = {
  type: 'wheat';
  stage: 0 | 1 | 2 | 3; // seed, sprout, growing, mature
  plantedDay: number;
  wateredToday: boolean;
};

export type Tile = {
  type: TileType;
  crop: CropData | null;
};

// ============================================================================
// CONSTANTS
// ============================================================================
export const GRID_SIZE = 8;
export const TILE_W = 32;
export const TILE_H = 16;
export const Z_STEP = 8;

// Offset to center the grid on screen
export const GRID_OFFSET_X = 160; // center of 320px width
export const GRID_OFFSET_Y = 40;  // top padding

// ============================================================================
// FARM GRID STATE
// ============================================================================
const grid: Tile[][] = [];

export function initGrid(): void {
  grid.length = 0;
  for (let y = 0; y < GRID_SIZE; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      row.push({ type: 'grass', crop: null });
    }
    grid.push(row);
  }
}

export function getTile(x: number, y: number): Tile | null {
  if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) return null;
  return grid[y]![x]!;
}

export function setTileType(x: number, y: number, type: TileType): void {
  const tile = getTile(x, y);
  if (tile) tile.type = type;
}

// ============================================================================
// CROP ACTIONS
// ============================================================================

/** Till a grass tile to prepare for planting */
export function tillTile(x: number, y: number): boolean {
  const tile = getTile(x, y);
  if (!tile || tile.type !== 'grass') return false;
  tile.type = 'tilled';
  return true;
}

/** Plant seeds on a tilled tile */
export function plantCrop(x: number, y: number, currentDay: number): boolean {
  const tile = getTile(x, y);
  if (!tile || tile.type === 'grass' || tile.crop) return false;
  tile.crop = {
    type: 'wheat',
    stage: 0,
    plantedDay: currentDay,
    wateredToday: false,
  };
  return true;
}

/** Water a tile with crop */
export function waterTile(x: number, y: number): boolean {
  const tile = getTile(x, y);
  if (!tile || tile.type === 'grass') return false;
  tile.type = 'watered';
  if (tile.crop) {
    tile.crop.wateredToday = true;
  }
  return true;
}

/** Harvest a mature crop, returns true if successful */
export function harvestCrop(x: number, y: number): boolean {
  const tile = getTile(x, y);
  if (!tile || !tile.crop || tile.crop.stage !== 3) return false;
  tile.crop = null;
  tile.type = 'tilled'; // Returns to tilled after harvest
  return true;
}

// ============================================================================
// DAY CYCLE - Crop Growth & Tile Reset
// ============================================================================

/** Called when night ends - grow crops that were watered */
export function advanceDay(): void {
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const tile = grid[y]![x]!;
      
      // Grow watered crops
      if (tile.crop && tile.crop.wateredToday && tile.crop.stage < 3) {
        tile.crop.stage = (tile.crop.stage + 1) as 0 | 1 | 2 | 3;
      }
      
      // Reset watered state and tile appearance
      if (tile.crop) {
        tile.crop.wateredToday = false;
      }
      if (tile.type === 'watered') {
        tile.type = 'tilled'; // Dries out overnight
      }
    }
  }
}

// ============================================================================
// ISOMETRIC HELPERS
// ============================================================================

/** Convert world grid coords to screen position */
export function gridToScreen(gx: number, gy: number, gz = 0): { sx: number; sy: number } {
  const { sx, sy } = projectIso(gx, gy, gz, TILE_W, TILE_H, Z_STEP);
  return {
    sx: sx + GRID_OFFSET_X,
    sy: sy + GRID_OFFSET_Y,
  };
}

/** Iterate all tiles in painter's order (back to front) */
export function forEachTile(fn: (x: number, y: number, tile: Tile, screenX: number, screenY: number) => void): void {
  forEachIsoOrder(GRID_SIZE, GRID_SIZE, (x, y) => {
    const tile = grid[y]![x]!;
    const { sx, sy } = gridToScreen(x, y);
    fn(x, y, tile, sx, sy);
  });
}

/** Check if a grid position is walkable */
export function isWalkable(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE;
}

// Initialize grid on module load
initGrid();
