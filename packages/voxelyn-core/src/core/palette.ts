/** Color palette as a Uint32Array of RGBA8888 packed colors */
export type Palette = Uint32Array;

/** Palette entry tuple: [index, RGBA8888 color] */
export type PaletteEntry = [index: number, color: number];

/**
 * Material definition with physical and visual properties.
 * This is the foundation type for all voxel-based content in voxelyn.
 */
export type Material = {
  id: number; // 0-255, index in palette
  name: string; // Display name
  color: number; // Packed RGBA8888 color
  density: number; // 0 = floats, 100 = heavy (affects physics simulation)
  friction: number; // 0-1 (affects sliding behavior)
  isLiquid: boolean; // For fluid simulation
  /** @deprecated Use `isGaseous`. Scheduled for removal in v0.6.0. */
  isGas: boolean;
  isGaseous: boolean; // Gas that expands/spreads
  isTransparent: boolean; // Allows visibility through (for rendering)
  flammable: boolean; // Can burn/ignite
  isoHeight?: number; // Override height in iso mode (pixels)
};

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
 * Creates a Material instance with default values.
 */
export function makeMaterial(overrides: Partial<Material>): Material {
  const isGaseous = overrides.isGaseous ?? false;
  const isGas = overrides.isGas ?? isGaseous;
  return {
    id: 0,
    name: 'Unnamed',
    color: 0xffffffff,
    density: 50,
    friction: 0.5,
    isLiquid: false,
    isGaseous,
    // Keep deprecated field for backward compatibility only.
    isGas,
    isTransparent: false,
    flammable: false,
    ...overrides,
  };
}

/** Default materials for voxel content */
export const DEFAULT_MATERIALS: Material[] = [
  makeMaterial({
    id: 0,
    name: 'Air',
    color: packRGBA(200, 220, 255, 0),
    density: 0,
    isGaseous: true,
    isTransparent: true,
  }),
  makeMaterial({
    id: 1,
    name: 'Stone',
    color: packRGBA(128, 128, 128),
    density: 95,
    friction: 0.8,
  }),
  makeMaterial({
    id: 2,
    name: 'Dirt',
    color: packRGBA(139, 90, 43),
    density: 85,
    friction: 0.7,
  }),
  makeMaterial({
    id: 3,
    name: 'Sand',
    color: packRGBA(194, 178, 128),
    density: 80,
    friction: 0.5,
  }),
  makeMaterial({
    id: 4,
    name: 'Water',
    color: packRGBA(0, 100, 200, 180),
    density: 50,
    friction: 0.1,
    isLiquid: true,
    isTransparent: true,
  }),
  makeMaterial({
    id: 5,
    name: 'Lava',
    color: packRGBA(255, 100, 0, 200),
    density: 60,
    friction: 0.2,
    isLiquid: true,
    flammable: true,
  }),
  makeMaterial({
    id: 6,
    name: 'Wood',
    color: packRGBA(139, 69, 19),
    density: 60,
    friction: 0.6,
    flammable: true,
  }),
  makeMaterial({
    id: 7,
    name: 'Grass',
    color: packRGBA(34, 139, 34),
    density: 55,
    friction: 0.7,
    flammable: true,
  }),
  makeMaterial({
    id: 8,
    name: 'Leaves',
    color: packRGBA(34, 170, 34),
    density: 20,
    friction: 0.4,
    isTransparent: true,
    flammable: true,
  }),
  makeMaterial({
    id: 9,
    name: 'Snow',
    color: packRGBA(240, 240, 250),
    density: 30,
    friction: 0.3,
  }),
  makeMaterial({
    id: 10,
    name: 'Gravel',
    color: packRGBA(102, 102, 102),
    density: 75,
    friction: 0.6,
  }),
  makeMaterial({
    id: 11,
    name: 'Cactus',
    color: packRGBA(50, 150, 50),
    density: 40,
    friction: 0.5,
    flammable: true,
  }),
  makeMaterial({
    id: 12,
    name: 'Flower Red',
    color: packRGBA(220, 50, 80),
    density: 10,
    friction: 0.3,
    flammable: true,
  }),
  makeMaterial({
    id: 13,
    name: 'Flower Yellow',
    color: packRGBA(255, 220, 50),
    density: 10,
    friction: 0.3,
    flammable: true,
  }),
  makeMaterial({
    id: 14,
    name: 'Palm Wood',
    color: packRGBA(180, 140, 90),
    density: 55,
    friction: 0.6,
    flammable: true,
  }),
  makeMaterial({
    id: 15,
    name: 'Mushroom',
    color: packRGBA(200, 180, 160),
    density: 20,
    friction: 0.4,
  }),
  makeMaterial({
    id: 16,
    name: 'Moss',
    color: packRGBA(80, 120, 60),
    density: 30,
    friction: 0.5,
  }),
  makeMaterial({
    id: 17,
    name: 'Coral',
    color: packRGBA(255, 120, 150),
    density: 50,
    friction: 0.6,
  }),
  makeMaterial({
    id: 18,
    name: 'Clay',
    color: packRGBA(150, 100, 70),
    density: 70,
    friction: 0.5,
  }),
  makeMaterial({
    id: 19,
    name: 'Ice',
    color: packRGBA(200, 230, 255, 200),
    density: 45,
    friction: 0.05,
    isTransparent: true,
  }),
];

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
