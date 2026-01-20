/** Color palette as a Uint32Array of RGBA8888 packed colors */
export type Palette = Uint32Array;

/** Palette entry tuple: [index, RGBA8888 color] */
export type PaletteEntry = [index: number, color: number];

/**
 * Creates a color palette for material-to-color mapping.
 * @param size - Number of palette entries (default 256)
 * @param fill - Default fill color for all entries
 * @param entries - Array of [index, color] tuples to set
 * @returns A new Palette instance
 */
export function makePalette(
  size = 256,
  fill = 0x00000000,
  entries: PaletteEntry[] = []
): Palette {
  const pal = new Uint32Array(size);
  pal.fill(fill >>> 0);
  for (const entry of entries) {
    if (!entry) continue; // Skip undefined/sparse entries
    const [idx, color] = entry;
    if (idx >= 0 && idx < size) {
      pal[idx] = color >>> 0;
    }
  }
  return pal;
}

/**
 * Packs RGBA components into a single 32-bit value (little-endian).
 * Memory layout: [R, G, B, A] bytes.
 * @param r - Red component (0-255)
 * @param g - Green component (0-255)
 * @param b - Blue component (0-255)
 * @param a - Alpha component (0-255, default 255)
 * @returns Packed RGBA8888 value
 */
export function packRGBA(
  r: number,
  g: number,
  b: number,
  a = 255
): number {
  return (
    ((a & 0xff) << 24) |
    ((b & 0xff) << 16) |
    ((g & 0xff) << 8) |
    (r & 0xff)
  ) >>> 0;
}

// ============================================================================
// SHADING & TEXTURE UTILITIES
// ============================================================================

/**
 * Unpacks a 32-bit RGBA color into components.
 * @param color - Packed RGBA8888 value
 * @returns Tuple [r, g, b, a]
 */
export function unpackRGBA(color: number): [number, number, number, number] {
  return [
    color & 0xff,
    (color >> 8) & 0xff,
    (color >> 16) & 0xff,
    (color >> 24) & 0xff
  ];
}

/**
 * Adjusts color brightness. Positive = lighter, negative = darker.
 * @param color - Packed RGBA8888 value
 * @param amount - Brightness adjustment (-255 to 255)
 * @returns Adjusted packed color
 */
export function adjustBrightness(color: number, amount: number): number {
  const r = Math.max(0, Math.min(255, (color & 0xff) + amount));
  const g = Math.max(0, Math.min(255, ((color >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, ((color >> 16) & 0xff) + amount));
  const a = (color >> 24) & 0xff;
  return packRGBA(r, g, b, a);
}

/**
 * Multiplies color by a factor (0.0 = black, 1.0 = unchanged, 2.0 = bright).
 * @param color - Packed RGBA8888 value
 * @param factor - Multiplication factor
 * @returns Adjusted packed color
 */
export function multiplyColor(color: number, factor: number): number {
  const r = Math.max(0, Math.min(255, ((color & 0xff) * factor) | 0));
  const g = Math.max(0, Math.min(255, (((color >> 8) & 0xff) * factor) | 0));
  const b = Math.max(0, Math.min(255, (((color >> 16) & 0xff) * factor) | 0));
  const a = (color >> 24) & 0xff;
  return packRGBA(r, g, b, a);
}

/**
 * Linearly interpolates between two colors.
 * @param color1 - First color
 * @param color2 - Second color
 * @param t - Interpolation factor (0.0 = color1, 1.0 = color2)
 * @returns Interpolated packed color
 */
export function lerpColor(color1: number, color2: number, t: number): number {
  const t1 = 1 - t;
  const r = ((color1 & 0xff) * t1 + (color2 & 0xff) * t) | 0;
  const g = (((color1 >> 8) & 0xff) * t1 + ((color2 >> 8) & 0xff) * t) | 0;
  const b = (((color1 >> 16) & 0xff) * t1 + ((color2 >> 16) & 0xff) * t) | 0;
  const a = (((color1 >> 24) & 0xff) * t1 + ((color2 >> 24) & 0xff) * t) | 0;
  return packRGBA(r, g, b, a);
}

/**
 * Creates a palette with automatic light/dark variants for each material.
 * Useful for depth shading without extra memory.
 * 
 * Layout: materialBase * variantsPerMaterial + variantIndex
 * Variant 0 = darkest, middle = base, last = lightest
 * 
 * @param baseMaterials - Array of [materialId, baseColor] tuples
 * @param variantsPerMaterial - Number of variants (default 8)
 * @param darkFactor - How dark the darkest variant is (0.0-1.0, default 0.5)
 * @param lightFactor - How bright the lightest variant is (1.0-2.0, default 1.3)
 * @returns Palette with variants
 */
export function makePaletteWithVariants(
  baseMaterials: PaletteEntry[],
  variantsPerMaterial = 8,
  darkFactor = 0.5,
  lightFactor = 1.3
): Palette {
  const size = 256;
  const pal = new Uint32Array(size);
  
  for (const entry of baseMaterials) {
    if (!entry) continue; // Skip undefined/sparse entries
    const [matId, baseColor] = entry;
    const startIdx = matId * variantsPerMaterial;
    const midVariant = (variantsPerMaterial / 2) | 0;
    
    for (let v = 0; v < variantsPerMaterial; v++) {
      const idx = startIdx + v;
      if (idx >= size) continue;
      
      if (v < midVariant) {
        // Darker variants
        const t = midVariant > 0 ? v / midVariant : 0;
        const factor = darkFactor + (1 - darkFactor) * t;
        pal[idx] = multiplyColor(baseColor, factor);
      } else if (v > midVariant) {
        // Lighter variants
        const divisor = variantsPerMaterial - midVariant - 1;
        const t = divisor > 0 ? (v - midVariant) / divisor : 0;
        const factor = 1 + (lightFactor - 1) * t;
        pal[idx] = multiplyColor(baseColor, factor);
      } else {
        // Base color
        pal[idx] = baseColor >>> 0;
      }
    }
  }
  
  return pal;
}
