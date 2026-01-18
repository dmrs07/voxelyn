export type Surface2D = {
  width: number;
  height: number;
  pixels: Uint32Array;
};

export type Surface2DCreateOptions = {
  pixels?: Uint32Array;
};

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

export function clearSurface(surface: Surface2D, color: number): void {
  surface.pixels.fill(color >>> 0);
}

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

export function setPixelUnsafe(
  surface: Surface2D,
  x: number,
  y: number,
  color: number
): void {
  surface.pixels[y * surface.width + x] = color >>> 0;
}

export function getPixel(surface: Surface2D, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= surface.width || y >= surface.height) {
    return 0;
  }
  return surface.pixels[y * surface.width + x] >>> 0;
}

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
