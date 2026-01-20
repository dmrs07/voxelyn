/**
 * Procedural Texture Generator for Materials
 * Generates realistic textures for different material types.
 */

import { packRGBA, unpackRGBA, adjustBrightness, multiplyColor } from './palette';
import type { Material } from './palette';

// ============================================================================
// NOISE GENERATORS
// ============================================================================

/**
 * Simple 2D Perlin-like noise using gradient vectors.
 * Deterministic based on seed for consistent generation.
 */
export class ProceduralNoise {
  private permutation: number[];
  
  constructor(seed: number = 42) {
    // Initialize permutation table with seed
    this.permutation = [];
    for (let i = 0; i < 256; i++) {
      this.permutation[i] = i;
    }
    // Fisher-Yates shuffle with seed
    let rng = seed;
    for (let i = 255; i > 0; i--) {
      rng = (rng * 1103515245 + 12345) & 0x7fffffff;
      const j = (rng % (i + 1)) | 0;
      const tmp = this.permutation[i];
      if (tmp !== undefined && this.permutation[j] !== undefined) {
        this.permutation[i] = this.permutation[j];
        this.permutation[j] = tmp;
      }
    }
  }

  /**
   * Generate smooth noise value at given coordinates.
   * Returns value between 0 and 1.
   */
  noise(x: number, y: number): number {
    // Simple hash-based noise
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    
    // Get fractional parts
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    
    // Smooth interpolation curves
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    
    // Hash corners
    const p = this.permutation;
    const a = (p[xi] ?? 0) + yi;
    const aa = p[a & 255] ?? 0;
    const ab = p[(a + 1) & 255] ?? 0;
    const b = ((p[(xi + 1) & 255] ?? 0) + yi);
    const ba = p[b & 255] ?? 0;
    const bb = p[(b + 1) & 255] ?? 0;
    
    // Gradients and lerp
    const g00 = this.gradient(aa, xf, yf);
    const g10 = this.gradient(ba, xf - 1, yf);
    const g01 = this.gradient(ab, xf, yf - 1);
    const g11 = this.gradient(bb, xf - 1, yf - 1);
    
    const x1 = g00 + u * (g10 - g00);
    const x2 = g01 + u * (g11 - g01);
    const result = x1 + v * (x2 - x1);
    
    return Math.max(0, Math.min(1, (result + 1) / 2));
  }

  private gradient(hash: number, x: number, y: number): number {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 8 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  /**
   * Fractal Brownian motion (fBm) for natural-looking patterns.
   */
  fbm(x: number, y: number, octaves: number = 4, persistence: number = 0.5): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += amplitude * this.noise(x * frequency, y * frequency);
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }

    return value / maxValue;
  }
}

// ============================================================================
// TEXTURE GENERATORS FOR SPECIFIC MATERIALS
// ============================================================================

export interface TextureOptions {
  width?: number;
  height?: number;
  seed?: number;
  scale?: number;
}

/**
 * Generate rocky/stone texture with cracks and irregularities.
 */
export function generateRockTexture(baseColor: number, options: TextureOptions = {}): Uint32Array {
  const width = options.width ?? 16;
  const height = options.height ?? 16;
  const seed = options.seed ?? 42;
  const scale = options.scale ?? 2;

  const noise = new ProceduralNoise(seed);
  const texture = new Uint32Array(width * height);
  const [r, g, b, a] = unpackRGBA(baseColor) as [number, number, number, number];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Use fBm for natural rock pattern
      const n = noise.fbm(x / scale, y / scale, 3, 0.6);
      
      // Add cracks (darker lines)
      const crackNoise = noise.noise(x / (scale * 0.5), y / (scale * 0.5));
      const hasCrack = crackNoise > 0.7 ? 1 : 0;
      
      // Blend noise with base color
      let brightness = n * 0.6 + 0.4; // Keep some base color
      brightness -= hasCrack * 0.3; // Darken cracks
      
      const idx = y * width + x;
      texture[idx] = packRGBA(
        Math.max(0, Math.min(255, r * brightness | 0)),
        Math.max(0, Math.min(255, g * brightness | 0)),
        Math.max(0, Math.min(255, b * brightness | 0)),
        a
      );
    }
  }

  return texture;
}

/**
 * Generate lava texture with glowing orange/red/yellow glow.
 */
export function generateLavaTexture(baseColor: number, options: TextureOptions = {}): Uint32Array {
  const width = options.width ?? 16;
  const height = options.height ?? 16;
  const seed = options.seed ?? 42;
  const scale = options.scale ?? 2.5;

  const noise = new ProceduralNoise(seed);
  const texture = new Uint32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Use multiple octaves for flowing lava pattern
      const n1 = noise.fbm(x / scale, y / scale + Date.now() * 0.0001, 3, 0.65);
      const n2 = noise.noise(x / (scale * 0.3), y / (scale * 0.3));
      
      // Combine for swirly effect
      const pattern = n1 * 0.7 + n2 * 0.3;
      
      // Create glowing color variation (orange -> yellow -> red)
      const glow = n1 * 0.6 + 0.4;
      
      // Lava colors: dark red -> orange -> yellow
      const hue = pattern; // 0-1, maps to color gradient
      let lavR = 255;
      let lavG = 100 + (hue * 155) | 0; // 100 (orange) to 255 (yellow)
      let lavB = 0 + (hue * 50) | 0; // Slight blue tint for yellow
      
      // Apply glow
      lavR = Math.max(255, lavR * (0.8 + glow * 0.4) | 0);
      lavG = Math.max(100, Math.min(255, lavG * (0.8 + glow * 0.4) | 0));
      lavB = Math.max(0, Math.min(255, lavB * (0.8 + glow * 0.2) | 0));
      
      const idx = y * width + x;
      texture[idx] = packRGBA(lavR, lavG, lavB, 200);
    }
  }

  return texture;
}

/**
 * Generate foliage/grass texture with fluffy, organic appearance.
 */
export function generateFoliageTexture(baseColor: number, options: TextureOptions = {}): Uint32Array {
  const width = options.width ?? 16;
  const height = options.height ?? 16;
  const seed = options.seed ?? 42;
  const scale = options.scale ?? 1.5;

  const noise = new ProceduralNoise(seed);
  const texture = new Uint32Array(width * height);
  const [r, g, b, a] = unpackRGBA(baseColor) as [number, number, number, number];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Use multiple scales for fluffy appearance
      const n1 = noise.fbm(x / scale, y / scale, 4, 0.55);
      const n2 = noise.noise(x / (scale * 0.7), y / (scale * 0.7));
      
      // Create organic, bumpy pattern
      const fluffiness = n1 * 0.6 + n2 * 0.3 + 0.1;
      
      // Vary green tones
      const greenVar = noise.noise(x * 0.3, y * 0.3) * 40 - 20;
      
      const idx = y * width + x;
      texture[idx] = packRGBA(
        Math.max(0, Math.min(255, r * (0.7 + fluffiness * 0.3) | 0)),
        Math.max(0, Math.min(255, (g + greenVar) * (0.8 + fluffiness * 0.2) | 0)),
        Math.max(0, Math.min(255, b * (0.6 + fluffiness * 0.4) | 0)),
        a
      );
    }
  }

  return texture;
}

/**
 * Generate water texture with ripples and transparency variation.
 */
export function generateWaterTexture(baseColor: number, options: TextureOptions = {}): Uint32Array {
  const width = options.width ?? 16;
  const height = options.height ?? 16;
  const seed = options.seed ?? 42;
  const scale = options.scale ?? 3;

  const noise = new ProceduralNoise(seed);
  const texture = new Uint32Array(width * height);
  const [r, g, b] = unpackRGBA(baseColor);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Ripple pattern
      const ripples = Math.sin(x * 0.5) * 0.1 + Math.cos(y * 0.5) * 0.1;
      const n = noise.fbm((x + ripples * 5) / scale, (y + ripples * 5) / scale, 2, 0.6);
      
      // Vary blue channel for depth
      const depth = n * 0.4 + 0.6;
      
      const idx = y * width + x;
      texture[idx] = packRGBA(
        Math.max(0, Math.min(255, r * depth | 0)),
        Math.max(0, Math.min(255, g * depth | 0)),
        Math.max(0, Math.min(255, b * (depth + 0.2) | 0)),
        Math.max(100, Math.min(200, 150 + (n * 50) | 0)) // Varying alpha
      );
    }
  }

  return texture;
}

/**
 * Generate metal/ore texture with shine and edge highlights.
 */
export function generateMetalTexture(baseColor: number, options: TextureOptions = {}): Uint32Array {
  const width = options.width ?? 16;
  const height = options.height ?? 16;
  const seed = options.seed ?? 42;
  const scale = options.scale ?? 4;

  const noise = new ProceduralNoise(seed);
  const texture = new Uint32Array(width * height);
  const [r, g, b, a] = unpackRGBA(baseColor);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Create metallic streaks
      const n1 = noise.fbm(x / scale, y / (scale * 2), 2, 0.7);
      
      // Edges and highlights
      const dx = x - width / 2;
      const dy = y - height / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const edgeHighlight = Math.max(0, 1 - dist / (width / 2)) * 0.3;
      
      const brightness = n1 * 0.5 + 0.5 + edgeHighlight;
      
      const idx = y * width + x;
      texture[idx] = packRGBA(
        Math.max(0, Math.min(255, r * brightness | 0)),
        Math.max(0, Math.min(255, g * brightness | 0)),
        Math.max(0, Math.min(255, b * brightness | 0)),
        a
      );
    }
  }

  return texture;
}

/**
 * Generate custom texture based on name/type.
 */
export function generateTextureForMaterial(
  material: Material,
  options: TextureOptions = {}
): Uint32Array {
  const name = material.name.toLowerCase();

  if (name.includes('lava') || name.includes('magma')) {
    return generateLavaTexture(material.color, options);
  } else if (name.includes('grass') || name.includes('foliage') || name.includes('leaf')) {
    return generateFoliageTexture(material.color, options);
  } else if (name.includes('water') || name.includes('liquid')) {
    return generateWaterTexture(material.color, options);
  } else if (name.includes('metal') || name.includes('ore') || name.includes('iron') || name.includes('gold')) {
    return generateMetalTexture(material.color, options);
  } else if (name.includes('stone') || name.includes('rock')) {
    return generateRockTexture(material.color, options);
  } else {
    // Default to rock for unknown
    return generateRockTexture(material.color, options);
  }
}

// ============================================================================
// TEXTURE SHEET SYSTEM
// ============================================================================

/**
 * A texture sheet represents a grid of material textures.
 * Can be generated procedurally or loaded from external sources.
 */
export type TextureSheet = {
  name: string;
  width: number; // Tile width
  height: number; // Tile height
  columns: number; // Tiles per row
  rows: number; // Number of rows
  data: Uint32Array; // Full texture atlas (width * height * columns * rows pixels)
  materials: Material[]; // Materials this sheet represents
};

/**
 * Create a texture sheet from a list of materials.
 * Each material gets a procedurally generated texture.
 */
export function createProceduralTextureSheet(
  materials: Material[],
  tileWidth: number = 32,
  tileHeight: number = 32
): TextureSheet {
  const columns = Math.max(1, Math.ceil(Math.sqrt(materials.length)));
  const rows = Math.max(1, Math.ceil(materials.length / columns));
  
  const atlasWidth = tileWidth * columns;
  const atlasHeight = tileHeight * rows;
  const data = new Uint32Array(atlasWidth * atlasHeight);

  for (let i = 0; i < materials.length; i++) {
    const material = materials[i];
    if (!material) continue;
    const col = i % columns;
    const row = Math.floor(i / columns);
    
    // Generate texture for this material
    const matTexture = generateTextureForMaterial(material, {
      width: tileWidth,
      height: tileHeight,
      seed: material.id * 1000,
      scale: 2,
    });

    // Place in atlas
    for (let y = 0; y < tileHeight; y++) {
      for (let x = 0; x < tileWidth; x++) {
        const atlasX = col * tileWidth + x;
        const atlasY = row * tileHeight + y;
        const atlasIdx = atlasY * atlasWidth + atlasX;
        const matIdx = y * tileWidth + x;
        const texColor = matTexture[matIdx];
        if (texColor !== undefined) {
          data[atlasIdx] = texColor;
        }
      }
    }
  }

  return {
    name: 'Procedural Texture Sheet',
    width: tileWidth,
    height: tileHeight,
    columns,
    rows,
    data,
    materials: [...materials],
  };
}

/**
 * Get a single tile from a texture sheet as a Uint32Array.
 */
export function getTextureSheetTile(
  sheet: TextureSheet,
  materialIndex: number
): Uint32Array | null {
  if (materialIndex < 0 || materialIndex >= sheet.materials.length) {
    return null;
  }

  const col = Math.max(0, materialIndex % sheet.columns);
  const row = Math.max(0, Math.floor(materialIndex / sheet.columns));
  
  const tile = new Uint32Array(sheet.width * sheet.height);
  const atlasWidth = sheet.width * sheet.columns;

  for (let y = 0; y < sheet.height; y++) {
    for (let x = 0; x < sheet.width; x++) {
      const atlasX = col * sheet.width + x;
      const atlasY = row * sheet.height + y;
      const atlasIdx = atlasY * atlasWidth + atlasX;
      const tileIdx = y * sheet.width + x;
      const sheetColor = sheet.data[atlasIdx];
      if (sheetColor !== undefined) {
        tile[tileIdx] = sheetColor;
      }
    }
  }

  return tile;
}
