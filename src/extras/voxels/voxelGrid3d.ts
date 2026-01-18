/**
 * Dense 3D voxel grid for volumetric data.
 * Stores voxel values as u16 (material + flags).
 * @module
 */

/**
 * Dense 3D voxel grid structure.
 */
export type VoxelGrid3D = {
  /** Grid width (X dimension) */
  readonly width: number;
  /** Grid height (Y dimension) */
  readonly height: number;
  /** Grid depth (Z dimension) */
  readonly depth: number;
  /** Voxel data as packed u16 values */
  readonly data: Uint16Array;
};

/** Options for creating a VoxelGrid3D */
export type VoxelGrid3DCreateOptions = {
  /** Pre-allocated data buffer */
  data?: Uint16Array;
};

/**
 * Creates a new dense 3D voxel grid.
 * @param width - Grid width (X dimension)
 * @param height - Grid height (Y dimension)
 * @param depth - Grid depth (Z dimension)
 * @param options - Optional configuration
 * @returns A new VoxelGrid3D instance
 */
export function createVoxelGrid3D(
  width: number,
  height: number,
  depth: number,
  options: VoxelGrid3DCreateOptions = {}
): VoxelGrid3D {
  const size = width * height * depth;
  const data = options.data ?? new Uint16Array(size);
  if (data.length < size) {
    throw new Error("data length is smaller than width*height*depth");
  }
  return { width, height, depth, data };
}

/**
 * Converts 3D coordinates to linear array index.
 * @param grid - Grid instance
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param z - Z coordinate
 * @returns Linear index into data array
 */
export function index3D(
  grid: VoxelGrid3D,
  x: number,
  y: number,
  z: number
): number {
  return (z * grid.height + y) * grid.width + x;
}

/**
 * Checks if 3D coordinates are within grid bounds.
 * @param grid - Grid instance
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param z - Z coordinate
 * @returns True if (x, y, z) is within bounds
 */
export function inBounds3D(
  grid: VoxelGrid3D,
  x: number,
  y: number,
  z: number
): boolean {
  return (
    x >= 0 &&
    y >= 0 &&
    z >= 0 &&
    x < grid.width &&
    y < grid.height &&
    z < grid.depth
  );
}

/**
 * Gets voxel value with bounds checking.
 * @param grid - Grid instance
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param z - Z coordinate
 * @returns Voxel value, or 0 if out of bounds
 */
export function getVoxel(
  grid: VoxelGrid3D,
  x: number,
  y: number,
  z: number
): number {
  if (!inBounds3D(grid, x, y, z)) return 0;
  return grid.data[index3D(grid, x, y, z)] ?? 0;
}

/**
 * Sets voxel value with bounds checking.
 * @param grid - Grid instance
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param z - Z coordinate
 * @param val - Voxel value to set
 */
export function setVoxel(
  grid: VoxelGrid3D,
  x: number,
  y: number,
  z: number,
  val: number
): void {
  if (!inBounds3D(grid, x, y, z)) return;
  grid.data[index3D(grid, x, y, z)] = val & 0xffff;
}
