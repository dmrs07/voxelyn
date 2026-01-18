/**
 * Traversal2D: Deterministic 2D traversal patterns.
 * Supports row-major, bottom-up, Morton (Z-order), and chunk-based orders.
 * All traversals are allocation-free in the hot path.
 * @module
 */

import { RNG } from "./rng.js";

/** Callback for traversal functions */
export type TraverseFn = (x: number, y: number) => void;

/**
 * Traverses a rectangle in row-major order (top to bottom, left to right).
 * @param width - Rectangle width
 * @param height - Rectangle height
 * @param fn - Callback for each cell
 */
export function forEachRowMajor(
  width: number,
  height: number,
  fn: TraverseFn
): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      fn(x, y);
    }
  }
}

/**
 * Traverses a rectangle bottom-up (bottom to top, left to right).
 * Ideal for falling sand simulations.
 * @param width - Rectangle width
 * @param height - Rectangle height
 * @param fn - Callback for each cell
 */
export function forEachBottomUp(
  width: number,
  height: number,
  fn: TraverseFn
): void {
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      fn(x, y);
    }
  }
}

/** Extracts even bits (de-interleaves Morton code) */
const compact1By1 = (x: number): number => {
  let v = x & 0x55555555;
  v = (v ^ (v >>> 1)) & 0x33333333;
  v = (v ^ (v >>> 2)) & 0x0f0f0f0f;
  v = (v ^ (v >>> 4)) & 0x00ff00ff;
  v = (v ^ (v >>> 8)) & 0x0000ffff;
  return v;
};

/** Decodes a Morton code to 2D coordinates */
const mortonDecode2D = (code: number): { x: number; y: number } => {
  return { x: compact1By1(code), y: compact1By1(code >>> 1) };
};

/**
 * Traverses a rectangle in Morton (Z-order) pattern.
 * Provides better cache locality for hierarchical data.
 * @param width - Rectangle width
 * @param height - Rectangle height
 * @param fn - Callback for each cell
 */
export function forEachMorton(
  width: number,
  height: number,
  fn: TraverseFn
): void {
  const maxSide = Math.max(width, height);
  const bits = Math.max(1, Math.ceil(Math.log2(maxSide)));
  const maxCode = 1 << (2 * bits);
  for (let code = 0; code < maxCode; code++) {
    const { x, y } = mortonDecode2D(code);
    if (x < width && y < height) {
      fn(x, y);
    }
  }
}

/**
 * Traverses a sub-rectangle in row-major order.
 * @param x0 - Top-left X coordinate
 * @param y0 - Top-left Y coordinate
 * @param width - Rectangle width
 * @param height - Rectangle height
 * @param fn - Callback for each cell
 */
export function forEachInRectRowMajor(
  x0: number,
  y0: number,
  width: number,
  height: number,
  fn: TraverseFn
): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      fn(x0 + x, y0 + y);
    }
  }
}

/**
 * Traverses a sub-rectangle bottom-up.
 * @param x0 - Top-left X coordinate
 * @param y0 - Top-left Y coordinate
 * @param width - Rectangle width
 * @param height - Rectangle height
 * @param fn - Callback for each cell
 */
export function forEachInRectBottomUp(
  x0: number,
  y0: number,
  width: number,
  height: number,
  fn: TraverseFn
): void {
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      fn(x0 + x, y0 + y);
    }
  }
}

/**
 * Traverses a sub-rectangle in Morton order.
 * @param x0 - Top-left X coordinate
 * @param y0 - Top-left Y coordinate
 * @param width - Rectangle width
 * @param height - Rectangle height
 * @param fn - Callback for each cell
 */
export function forEachInRectMorton(
  x0: number,
  y0: number,
  width: number,
  height: number,
  fn: TraverseFn
): void {
  const maxSide = Math.max(width, height);
  const bits = Math.max(1, Math.ceil(Math.log2(maxSide)));
  const maxCode = 1 << (2 * bits);
  for (let code = 0; code < maxCode; code++) {
    const { x, y } = mortonDecode2D(code);
    if (x < width && y < height) {
      fn(x0 + x, y0 + y);
    }
  }
}

/** Minimal interface for chunk-based grids */
export type ChunkGridLike = {
  width: number;
  height: number;
  chunkSize: number;
  chunkCountX: number;
  chunkCountY: number;
};

/** Computes greatest common divisor (for coprime step) */
const gcd = (a: number, b: number): number => {
  let x = a | 0;
  let y = b | 0;
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return Math.abs(x);
};

/**
 * Traverses chunks in deterministic pseudo-random order.
 * Uses coprime stepping for full coverage without allocation.
 * @param grid - Grid with chunk info
 * @param seed - RNG seed for reproducible order
 * @param fnChunk - Callback for each chunk
 */
export function forEachChunkOrder(
  grid: ChunkGridLike,
  seed: number,
  fnChunk: (chunkX: number, chunkY: number, chunkIndex: number) => void
): void {
  const count = grid.chunkCountX * grid.chunkCountY;
  if (count <= 0) return;
  const rng = new RNG(seed);
  const start = rng.nextInt(count);
  let step = (rng.nextU32() | 1) >>> 0;
  while (gcd(step, count) !== 1) {
    step = (step + 2) >>> 0;
  }
  for (let i = 0; i < count; i++) {
    const idx = (start + i * step) % count;
    const chunkX = idx % grid.chunkCountX;
    const chunkY = (idx / grid.chunkCountX) | 0;
    fnChunk(chunkX, chunkY, idx);
  }
}
