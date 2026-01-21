/**
 * Isometric projection and rendering utilities.
 * Supports faux-3D Diablo-like rendering with painter's algorithm.
 * @module
 */

/** Screen coordinates from isometric projection */
export type IsoPoint = { sx: number; sy: number };

/**
 * Projects world coordinates to screen using isometric projection.
 * @param x - World X coordinate
 * @param y - World Y coordinate
 * @param z - World Z coordinate (height)
 * @param tileW - Tile width in pixels
 * @param tileH - Tile height in pixels
 * @param zStep - Pixels per Z unit
 * @returns Screen coordinates
 */
export function projectIso(
  x: number,
  y: number,
  z: number,
  tileW: number,
  tileH: number,
  zStep: number
): IsoPoint {
  const sx = (x - y) * (tileW >> 1);
  const sy = (x + y) * (tileH >> 1) - z * zStep;
  return { sx, sy };
}

/**
 * Iterates tiles in painter's order (back to front) for isometric rendering.
 * Order is based on (x + y) diagonal, suitable for correct depth sorting.
 * @param mapW - Map width in tiles
 * @param mapH - Map height in tiles
 * @param fn - Callback for each tile with (x, y, order)
 */
export function forEachIsoOrder(
  mapW: number,
  mapH: number,
  fn: (x: number, y: number, order: number) => void
): void {
  let order = 0;
  const max = mapW + mapH - 2;
  for (let s = 0; s <= max; s++) {
    const xStart = Math.max(0, s - (mapH - 1));
    const xEnd = Math.min(mapW - 1, s);
    for (let x = xStart; x <= xEnd; x++) {
      const y = s - x;
      fn(x, y, order++);
    }
  }
}

/** Draw command for deferred rendering with sorting */
export type DrawCommand = {
  /** Sort key (higher = drawn later) */
  key: number;
  /** Draw function to execute */
  draw: () => void;
};

/**
 * Sorts draw commands by key (painter's algorithm).
 * Note: This allocates; use sparingly or with pooling.
 * @param commands - Array of draw commands to sort in-place
 */
export function sortDrawCommands(commands: DrawCommand[]): void {
  commands.sort((a, b) => a.key - b.key);
}

/**
 * Creates a sort key for isometric draw commands.
 * @param x - World X coordinate
 * @param y - World Y coordinate
 * @param z - World Z coordinate
 * @param layer - Layer within same position (0-255)
 * @returns Sort key for painter's algorithm
 */
export function makeDrawKey(x: number, y: number, z: number, layer: number): number {
  return ((x + y) << 16) | ((z & 0xff) << 8) | (layer & 0xff);
}
