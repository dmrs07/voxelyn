/**
 * Represents a 2D pixel buffer with RGBA8888 packed pixels.
 * Core rendering target for all drawing operations.
 */
export type Surface2D = {
  /** Width in pixels */
  readonly width: number;
  /** Height in pixels */
  readonly height: number;
  /** Pixel data as packed RGBA8888 (little-endian) */
  readonly pixels: Uint32Array;
};

/** Options for creating a Surface2D */
export type Surface2DCreateOptions = {
  /** Pre-allocated pixel buffer (must be at least width*height) */
  pixels?: Uint32Array;
};

/**
 * Creates a new 2D surface for pixel rendering.
 * @param width - Surface width in pixels
 * @param height - Surface height in pixels
 * @param options - Optional configuration
 * @returns A new Surface2D instance
 */
export function createSurface2D(
  width: number,
  height: number,
  options: Surface2DCreateOptions = {}
): Surface2D {
  const size = width * height;
  const pixels = options.pixels ?? new Uint32Array(size);
  if (pixels.length < size) {
    throw new Error("pixels length is smaller than width*height");
  }
  return { width, height, pixels };
}

/**
 * Fills the entire surface with a single color.
 * @param surface - Target surface
 * @param color - RGBA8888 packed color value
 */
export function clearSurface(surface: Surface2D, color: number): void {
  surface.pixels.fill(color >>> 0);
}

/**
 * Sets a pixel with bounds checking.
 * @param surface - Target surface
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param color - RGBA8888 packed color value
 */
export function setPixel(
  surface: Surface2D,
  x: number,
  y: number,
  color: number
): void {
  if (x < 0 || y < 0 || x >= surface.width || y >= surface.height) {
    return;
  }
  surface.pixels[y * surface.width + x] = color >>> 0;
}

/**
 * Sets a pixel without bounds checking (faster, unsafe).
 * @param surface - Target surface
 * @param x - X coordinate (must be in bounds)
 * @param y - Y coordinate (must be in bounds)
 * @param color - RGBA8888 packed color value
 */
export function setPixelUnsafe(
  surface: Surface2D,
  x: number,
  y: number,
  color: number
): void {
  surface.pixels[y * surface.width + x] = color >>> 0;
}

/**
 * Gets a pixel value with bounds checking.
 * @param surface - Source surface
 * @param x - X coordinate
 * @param y - Y coordinate
 * @returns RGBA8888 packed color, or 0 if out of bounds
 */
export function getPixel(surface: Surface2D, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= surface.width || y >= surface.height) {
    return 0;
  }
  return surface.pixels[y * surface.width + x]! >>> 0;
}

/**
 * Fills a rectangle with clipping to surface bounds.
 * @param surface - Target surface
 * @param x - Top-left X coordinate
 * @param y - Top-left Y coordinate
 * @param width - Rectangle width
 * @param height - Rectangle height
 * @param color - RGBA8888 packed color value
 */
export function fillRect(
  surface: Surface2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number
): void {
  const x0 = Math.max(0, x) | 0;
  const y0 = Math.max(0, y) | 0;
  const x1 = Math.min(surface.width, x + width) | 0;
  const y1 = Math.min(surface.height, y + height) | 0;
  const w = surface.width | 0;
  const c = color >>> 0;
  for (let yy = y0; yy < y1; yy++) {
    let row = yy * w + x0;
    for (let xx = x0; xx < x1; xx++) {
      surface.pixels[row++] = c;
    }
  }
}
