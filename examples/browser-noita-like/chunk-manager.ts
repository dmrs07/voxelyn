/**
 * Chunk Manager for infinite world streaming
 * Handles loading/unloading chunks as player moves
 * Implements floating origin (grid shifting) for true infinite worlds
 */

import type { Grid2D } from "../../packages/voxelyn-core/src/core/grid2d.js";
import { 
  makeCell,
  markChunkActiveByXY, 
  markChunkDirtyByXY 
} from "../../packages/voxelyn-core/src/index.js";
import { generateChunk, selectChunkBiome, clearNoiseCache } from "./terrain-gen.js";
import { MATERIAL } from "./materials.js";
import type { BiomeType } from "./biomes.js";

// ============================================================================
// TYPES
// ============================================================================

export type ChunkState = {
  /** Chunk X coordinate (in world chunks, not grid chunks) */
  worldChunkX: number;
  /** Chunk Y coordinate (in world chunks) */
  worldChunkY: number;
  /** Biome assigned to this chunk */
  biome: BiomeType;
  /** Whether terrain has been generated */
  generated: boolean;
  /** Frame number when last accessed */
  lastAccess: number;
};

export type InfiniteWorldConfig = {
  /** Base seed for world generation */
  seed: number;
  /** Chunk size in pixels/cells */
  chunkSize: number;
  /** Number of chunks to keep loaded around player */
  loadRadius: number;
  /** Unload chunks beyond this radius */
  unloadRadius: number;
  /** Direction of infinite scrolling */
  scrollDirection: "horizontal" | "vertical" | "both";
};

export type ShiftResult = {
  /** Whether a shift occurred */
  shifted: boolean;
  /** Pixels shifted in X (positive = world moved left, player effectively moved right) */
  deltaX: number;
  /** Pixels shifted in Y */
  deltaY: number;
};

// ============================================================================
// CHUNK MANAGER CLASS
// ============================================================================

export class ChunkManager {
  private grid: Grid2D;
  private config: InfiniteWorldConfig;
  
  /** Tracks which world chunks have been generated */
  private generatedChunks: Map<string, ChunkState> = new Map();
  
  /** Current world origin - which world chunk is at grid position (0,0) */
  private worldOriginChunkX: number = 0;
  private worldOriginChunkY: number = 0;
  
  /** Player's position in world chunk coordinates */
  private playerWorldChunkX: number = 0;
  private playerWorldChunkY: number = 0;
  
  /** Frame counter for LRU tracking */
  private frameCount: number = 0;

  constructor(grid: Grid2D, config: InfiniteWorldConfig) {
    this.grid = grid;
    this.config = config;
    
    // Initialize origin to center the player in the grid
    const gridChunksX = Math.floor(grid.width / config.chunkSize);
    const gridChunksY = Math.floor(grid.height / config.chunkSize);
    this.worldOriginChunkX = -Math.floor(gridChunksX / 2);
    this.worldOriginChunkY = -Math.floor(gridChunksY / 2);
  }

  // ==========================================================================
  // COORDINATE CONVERSION
  // ==========================================================================

  /** Get chunk key for Map storage */
  private getChunkKey(worldChunkX: number, worldChunkY: number): string {
    return `${worldChunkX},${worldChunkY}`;
  }

  /** Convert world position (pixels) to world chunk coordinates */
  worldPosToWorldChunk(worldX: number, worldY: number): { cx: number; cy: number } {
    return {
      cx: Math.floor(worldX / this.config.chunkSize),
      cy: Math.floor(worldY / this.config.chunkSize),
    };
  }

  /** Convert grid position to world chunk coordinates */
  gridPosToWorldChunk(gridX: number, gridY: number): { cx: number; cy: number } {
    const gridChunkX = Math.floor(gridX / this.config.chunkSize);
    const gridChunkY = Math.floor(gridY / this.config.chunkSize);
    return {
      cx: this.worldOriginChunkX + gridChunkX,
      cy: this.worldOriginChunkY + gridChunkY,
    };
  }

  /** Convert world chunk to grid chunk coordinates */
  worldChunkToGridChunk(worldChunkX: number, worldChunkY: number): { gx: number; gy: number } {
    return {
      gx: worldChunkX - this.worldOriginChunkX,
      gy: worldChunkY - this.worldOriginChunkY,
    };
  }

  /** Convert world chunk to grid pixel position (top-left of chunk) */
  worldChunkToGridPos(worldChunkX: number, worldChunkY: number): { x: number; y: number } {
    const { gx, gy } = this.worldChunkToGridChunk(worldChunkX, worldChunkY);
    return {
      x: gx * this.config.chunkSize,
      y: gy * this.config.chunkSize,
    };
  }

  /** Check if a world chunk maps to a valid grid position */
  isWorldChunkInGrid(worldChunkX: number, worldChunkY: number): boolean {
    const { x, y } = this.worldChunkToGridPos(worldChunkX, worldChunkY);
    const { chunkSize } = this.config;
    return (
      x >= 0 && x + chunkSize <= this.grid.width &&
      y >= 0 && y + chunkSize <= this.grid.height
    );
  }

  // ==========================================================================
  // CHUNK GENERATION
  // ==========================================================================

  /** Regenerate a chunk at a specific grid position from world coordinates */
  private regenerateChunkAt(gridChunkX: number, gridChunkY: number): void {
    const worldChunkX = this.worldOriginChunkX + gridChunkX;
    const worldChunkY = this.worldOriginChunkY + gridChunkY;
    
    const biome = selectChunkBiome(worldChunkX, worldChunkY, this.config.seed);
    const gridX = gridChunkX * this.config.chunkSize;
    const gridY = gridChunkY * this.config.chunkSize;

    // Generate terrain using world coordinates for noise, but write to grid position
    generateChunk(this.grid, {
      x: worldChunkX,
      y: worldChunkY,
      width: this.config.chunkSize,
      height: this.config.chunkSize,
      seed: this.config.seed,
      biome,
      gridOffsetX: gridX,
      gridOffsetY: gridY,
    });

    // Mark as active
    markChunkActiveByXY(this.grid, gridX, gridY);
    markChunkDirtyByXY(this.grid, gridX, gridY);
  }

  // ==========================================================================
  // GRID SHIFTING (FLOATING ORIGIN)
  // ==========================================================================

  /**
   * Shift grid contents by one chunk in the specified direction
   * This implements the "floating origin" pattern for infinite worlds
   */
  private shiftGrid(directionX: number, directionY: number): void {
    const { chunkSize } = this.config;
    const { width, height, cells } = this.grid;

    // Shift horizontally
    if (directionX !== 0) {
      if (directionX > 0) {
        // Player moved right - shift grid contents LEFT, load new chunk on RIGHT
        // Copy columns from right to left
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width - chunkSize; x++) {
            const srcIdx = y * width + (x + chunkSize);
            const dstIdx = y * width + x;
            cells[dstIdx] = cells[srcIdx];
          }
          // Clear rightmost column (will be regenerated)
          for (let x = width - chunkSize; x < width; x++) {
            const idx = y * width + x;
            cells[idx] = makeCell(MATERIAL.ROCK);
          }
        }
        this.worldOriginChunkX += 1;
      } else {
        // Player moved left - shift grid contents RIGHT, load new chunk on LEFT
        for (let y = 0; y < height; y++) {
          for (let x = width - 1; x >= chunkSize; x--) {
            const srcIdx = y * width + (x - chunkSize);
            const dstIdx = y * width + x;
            cells[dstIdx] = cells[srcIdx];
          }
          // Clear leftmost column
          for (let x = 0; x < chunkSize; x++) {
            const idx = y * width + x;
            cells[idx] = makeCell(MATERIAL.ROCK);
          }
        }
        this.worldOriginChunkX -= 1;
      }
    }

    // Shift vertically
    if (directionY !== 0) {
      if (directionY > 0) {
        // Player moved down - shift grid contents UP, load new chunk on BOTTOM
        for (let y = 0; y < height - chunkSize; y++) {
          for (let x = 0; x < width; x++) {
            const srcIdx = (y + chunkSize) * width + x;
            const dstIdx = y * width + x;
            cells[dstIdx] = cells[srcIdx];
          }
        }
        // Clear bottom rows
        for (let y = height - chunkSize; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            cells[idx] = makeCell(MATERIAL.ROCK);
          }
        }
        this.worldOriginChunkY += 1;
      } else {
        // Player moved up - shift grid contents DOWN, load new chunk on TOP
        for (let y = height - 1; y >= chunkSize; y--) {
          for (let x = 0; x < width; x++) {
            const srcIdx = (y - chunkSize) * width + x;
            const dstIdx = y * width + x;
            cells[dstIdx] = cells[srcIdx];
          }
        }
        // Clear top rows
        for (let y = 0; y < chunkSize; y++) {
          for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            cells[idx] = makeCell(MATERIAL.ROCK);
          }
        }
        this.worldOriginChunkY -= 1;
      }
    }
  }

  /**
   * Generate new chunks for the edges exposed by a shift
   */
  private generateEdgeChunks(directionX: number, directionY: number): void {
    const gridChunksX = Math.floor(this.grid.width / this.config.chunkSize);
    const gridChunksY = Math.floor(this.grid.height / this.config.chunkSize);

    if (directionX > 0) {
      // Generate rightmost column of chunks
      const gx = gridChunksX - 1;
      for (let gy = 0; gy < gridChunksY; gy++) {
        this.regenerateChunkAt(gx, gy);
      }
    } else if (directionX < 0) {
      // Generate leftmost column of chunks
      for (let gy = 0; gy < gridChunksY; gy++) {
        this.regenerateChunkAt(0, gy);
      }
    }

    if (directionY > 0) {
      // Generate bottom row of chunks
      const gy = gridChunksY - 1;
      for (let gx = 0; gx < gridChunksX; gx++) {
        this.regenerateChunkAt(gx, gy);
      }
    } else if (directionY < 0) {
      // Generate top row of chunks
      for (let gx = 0; gx < gridChunksX; gx++) {
        this.regenerateChunkAt(gx, 0);
      }
    }
  }

  // ==========================================================================
  // MAIN UPDATE
  // ==========================================================================

  /**
   * Update chunk loading based on player grid position
   * Returns info about any grid shift that occurred
   */
  update(playerGridX: number, playerGridY: number): ShiftResult {
    this.frameCount++;
    
    const { chunkSize, scrollDirection } = this.config;
    const result: ShiftResult = { shifted: false, deltaX: 0, deltaY: 0 };

    // Calculate grid dimensions in chunks
    const gridChunksX = Math.floor(this.grid.width / chunkSize);
    const gridChunksY = Math.floor(this.grid.height / chunkSize);

    // Check if player is too far from grid center (trigger shift)
    const playerGridChunkX = Math.floor(playerGridX / chunkSize);
    const playerGridChunkY = Math.floor(playerGridY / chunkSize);
    const centerGridChunkX = Math.floor(gridChunksX / 2);
    const centerGridChunkY = Math.floor(gridChunksY / 2);

    let shiftX = 0;
    let shiftY = 0;

    // Check horizontal shift
    if (scrollDirection === "horizontal" || scrollDirection === "both") {
      const chunkDistX = playerGridChunkX - centerGridChunkX;
      if (chunkDistX > 0) {
        shiftX = 1;  // Player is right of center, shift world left
      } else if (chunkDistX < -1) {
        shiftX = -1; // Player is left of center, shift world right
      }
    }

    // Check vertical shift
    if (scrollDirection === "vertical" || scrollDirection === "both") {
      const chunkDistY = playerGridChunkY - centerGridChunkY;
      if (chunkDistY > 0) {
        shiftY = 1;
      } else if (chunkDistY < -1) {
        shiftY = -1;
      }
    }

    // Perform grid shift if needed
    if (shiftX !== 0 || shiftY !== 0) {
      // Shift one direction at a time to handle diagonals
      if (shiftX !== 0) {
        this.shiftGrid(shiftX, 0);
        this.generateEdgeChunks(shiftX, 0);
        result.deltaX = shiftX * chunkSize;
      }
      if (shiftY !== 0) {
        this.shiftGrid(0, shiftY);
        this.generateEdgeChunks(0, shiftY);
        result.deltaY = shiftY * chunkSize;
      }
      result.shifted = true;

      // Mark all chunks as active after shift
      for (let y = 0; y < this.grid.height; y += chunkSize) {
        for (let x = 0; x < this.grid.width; x += chunkSize) {
          markChunkActiveByXY(this.grid, x, y);
          markChunkDirtyByXY(this.grid, x, y);
        }
      }
    }

    // Update player's world chunk position
    this.playerWorldChunkX = this.worldOriginChunkX + playerGridChunkX;
    this.playerWorldChunkY = this.worldOriginChunkY + playerGridChunkY;

    return result;
  }

  // ==========================================================================
  // PUBLIC GETTERS
  // ==========================================================================

  /** Get the world origin offset in pixels */
  getWorldOrigin(): { x: number; y: number } {
    return {
      x: this.worldOriginChunkX * this.config.chunkSize,
      y: this.worldOriginChunkY * this.config.chunkSize,
    };
  }

  /** Get debug info */
  getDebugInfo(): { 
    loadedChunks: number; 
    playerWorldChunk: string; 
    worldOrigin: string;
    gridChunks: string;
  } {
    const gridChunksX = Math.floor(this.grid.width / this.config.chunkSize);
    const gridChunksY = Math.floor(this.grid.height / this.config.chunkSize);
    return {
      loadedChunks: this.generatedChunks.size,
      playerWorldChunk: `${this.playerWorldChunkX},${this.playerWorldChunkY}`,
      worldOrigin: `${this.worldOriginChunkX},${this.worldOriginChunkY}`,
      gridChunks: `${gridChunksX}x${gridChunksY}`,
    };
  }

  /** Get the biome at a grid position */
  getBiomeAtGrid(gridX: number, gridY: number): BiomeType {
    const { cx, cy } = this.gridPosToWorldChunk(gridX, gridY);
    return selectChunkBiome(cx, cy, this.config.seed);
  }

  /** Get player's position in world coordinates */
  getPlayerWorldPos(playerGridX: number, playerGridY: number): { worldX: number; worldY: number } {
    const origin = this.getWorldOrigin();
    return {
      worldX: origin.x + playerGridX,
      worldY: origin.y + playerGridY,
    };
  }

  /** Convert world position to grid position */
  worldToGrid(worldX: number, worldY: number): { gridX: number; gridY: number } {
    const origin = this.getWorldOrigin();
    return {
      gridX: worldX - origin.x,
      gridY: worldY - origin.y,
    };
  }

  /** Reset the chunk manager (new world) */
  reset(newSeed?: number): void {
    this.generatedChunks.clear();
    this.frameCount = 0;
    
    // Reset origin to center player in grid
    const gridChunksX = Math.floor(this.grid.width / this.config.chunkSize);
    const gridChunksY = Math.floor(this.grid.height / this.config.chunkSize);
    this.worldOriginChunkX = -Math.floor(gridChunksX / 2);
    this.worldOriginChunkY = -Math.floor(gridChunksY / 2);
    
    if (newSeed !== undefined) {
      this.config.seed = newSeed;
    }
    clearNoiseCache();
  }

  /** Pre-generate the initial world */
  pregenerate(): void {
    const gridChunksX = Math.floor(this.grid.width / this.config.chunkSize);
    const gridChunksY = Math.floor(this.grid.height / this.config.chunkSize);
    
    // Generate all chunks visible in the grid
    for (let gy = 0; gy < gridChunksY; gy++) {
      for (let gx = 0; gx < gridChunksX; gx++) {
        this.regenerateChunkAt(gx, gy);
      }
    }
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createChunkManager(
  grid: Grid2D,
  seed: number,
  options?: Partial<InfiniteWorldConfig>
): ChunkManager {
  const config: InfiniteWorldConfig = {
    seed,
    chunkSize: options?.chunkSize ?? 32,
    loadRadius: options?.loadRadius ?? 3,
    unloadRadius: options?.unloadRadius ?? 5,
    scrollDirection: options?.scrollDirection ?? "horizontal",
  };

  return new ChunkManager(grid, config);
}
