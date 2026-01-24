/**
 * Noise generators for procedural terrain generation
 * Extracted for reusability across the terrain system
 */

import { RNG } from "../rng.js";

// ============================================================================
// TYPES
// ============================================================================

export type NoiseDetailConfig = {
  /** Number of octaves (layers of noise). More = more detail but slower. Default: 6 */
  octaves?: number;
  /** How much each octave contributes (0-1). Lower = smoother. Default: 0.5 */
  falloff?: number;
  /** Lacunarity - frequency multiplier per octave. Default: 2 */
  lacunarity?: number;
};

// ============================================================================
// MATH UTILITIES
// ============================================================================

/** Fast hash for 2D coordinates */
export const hash2D = (x: number, y: number, seed: number): number => {
  let h = (x * 374761393 + y * 668265263) ^ seed;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 0xffffffff;
};

/** Fast hash for 3D coordinates */
export const hash3D = (x: number, y: number, z: number, seed: number): number => {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) ^ seed;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 0xffffffff;
};

/** Smoothstep interpolation */
export const smoothstep = (t: number): number => t * t * (3 - 2 * t);

/** Quintic interpolation for smoother results */
export const quintic = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

/** Linear interpolation */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Clamp value to [0, 1] */
export const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/** Remap value from one range to another */
export const remap = (value: number, inMin: number, inMax: number, outMin: number, outMax: number): number => {
  return outMin + (value - inMin) * (outMax - outMin) / (inMax - inMin);
};

// ============================================================================
// GRADIENT NOISE (Perlin-like)
// ============================================================================

/**
 * Gradient noise (Perlin-like) with configurable interpolation
 * 
 * Key techniques from procedural terrain generation:
 * - Zoom factor: divide coordinates to "zoom in" on noise (smoother terrain)
 * - Octaves: layer multiple frequencies for natural detail
 * - Falloff: control how much each octave contributes
 * 
 * @example
 * ```ts
 * const noise = new GradientNoise(12345, { octaves: 6, falloff: 0.5 });
 * 
 * // Simple sample
 * const value = noise.sample(x, y);
 * 
 * // With zoom (key technique from p5.js terrain tutorials)
 * const smoothValue = noise.sampleZoomed(x, y, 100);
 * 
 * // Fractal brownian motion for natural terrain
 * const terrainHeight = noise.fbm(x * 0.01, y * 0.01, 6);
 * ```
 */
export class GradientNoise {
  private permutation: Uint8Array;
  private gradients: Float32Array;
  private _octaves: number;
  private _falloff: number;
  private _lacunarity: number;

  constructor(seed: number, detail?: NoiseDetailConfig) {
    const rng = new RNG(seed);
    this._octaves = detail?.octaves ?? 6;
    this._falloff = detail?.falloff ?? 0.5;
    this._lacunarity = detail?.lacunarity ?? 2;
    
    // Generate permutation table
    this.permutation = new Uint8Array(512);
    for (let i = 0; i < 256; i++) {
      this.permutation[i] = i;
    }
    
    // Fisher-Yates shuffle
    for (let i = 255; i > 0; i--) {
      const j = rng.nextInt(i + 1);
      const tmp = this.permutation[i]!;
      this.permutation[i] = this.permutation[j]!;
      this.permutation[j] = tmp;
    }
    
    // Duplicate for wrapping
    for (let i = 0; i < 256; i++) {
      this.permutation[256 + i] = this.permutation[i]!;
    }
    
    // Generate unit gradients
    this.gradients = new Float32Array(256 * 2);
    for (let i = 0; i < 256; i++) {
      const angle = rng.nextFloat01() * Math.PI * 2;
      this.gradients[i * 2] = Math.cos(angle);
      this.gradients[i * 2 + 1] = Math.sin(angle);
    }
  }

  /** Set noise detail (octaves and falloff) - like p5.js noiseDetail() */
  setDetail(octaves: number, falloff: number = 0.5): void {
    this._octaves = Math.max(1, Math.min(16, octaves));
    this._falloff = Math.max(0, Math.min(1, falloff));
  }

  get octaves(): number { return this._octaves; }
  get falloff(): number { return this._falloff; }
  get lacunarity(): number { return this._lacunarity; }

  private grad(hash: number, x: number, y: number): number {
    const idx = (hash & 255) * 2;
    return this.gradients[idx]! * x + this.gradients[idx + 1]! * y;
  }

  /** 
   * Sample raw noise at position (returns 0-1)
   * This is the basic Perlin noise sample - like calling noise(x, y) in p5.js
   */
  sample(x: number, y: number): number {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;

    const u = quintic(xf);
    const v = quintic(yf);

    const p = this.permutation;
    const aa = p[(p[xi & 255]! + yi) & 511]!;
    const ab = p[(p[xi & 255]! + yi + 1) & 511]!;
    const ba = p[(p[(xi + 1) & 255]! + yi) & 511]!;
    const bb = p[(p[(xi + 1) & 255]! + yi + 1) & 511]!;

    const g00 = this.grad(aa, xf, yf);
    const g10 = this.grad(ba, xf - 1, yf);
    const g01 = this.grad(ab, xf, yf - 1);
    const g11 = this.grad(bb, xf - 1, yf - 1);

    const x1 = lerp(g00, g10, u);
    const x2 = lerp(g01, g11, u);

    return lerp(x1, x2, v) * 0.5 + 0.5; // Normalize to [0, 1]
  }

  /**
   * Sample noise with zoom factor - the key technique from terrain tutorials!
   * Dividing x,y by zoomFactor "zooms in" on the noise, making it smoother
   * 
   * @param x - X coordinate
   * @param y - Y coordinate  
   * @param zoomFactor - How much to zoom in (higher = smoother). Default: 100
   */
  sampleZoomed(x: number, y: number, zoomFactor: number = 100): number {
    return this.fbm(x / zoomFactor, y / zoomFactor, this._octaves, this._lacunarity, this._falloff);
  }

  /** 
   * Fractal Brownian Motion - combines multiple octaves of noise
   * This adds detail and makes terrain look more natural
   * Like using noiseDetail() in p5.js to add more layers
   */
  fbm(x: number, y: number, octaves?: number, lacunarity?: number, persistence?: number): number {
    const oct = octaves ?? this._octaves;
    const lac = lacunarity ?? this._lacunarity;
    const pers = persistence ?? this._falloff;
    
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < oct; i++) {
      value += amplitude * this.sample(x * frequency, y * frequency);
      maxValue += amplitude;
      amplitude *= pers;  // Each octave contributes less (falloff)
      frequency *= lac;   // Each octave has higher frequency (more detail)
    }

    return value / maxValue;
  }

  /** Ridged noise for mountain-like features */
  ridged(x: number, y: number, octaves?: number, lacunarity?: number, persistence?: number): number {
    const oct = octaves ?? this._octaves;
    const lac = lacunarity ?? this._lacunarity;
    const pers = persistence ?? this._falloff;
    
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < oct; i++) {
      // Ridged: invert and square the noise for sharp peaks
      const n = 1 - Math.abs(this.sample(x * frequency, y * frequency) * 2 - 1);
      value += amplitude * n * n;
      maxValue += amplitude;
      amplitude *= pers;
      frequency *= lac;
    }

    return value / maxValue;
  }

  /** Domain-warped noise for organic distortion */
  warped(x: number, y: number, warpScale: number = 0.5, octaves?: number): number {
    const oct = octaves ?? Math.max(3, this._octaves - 1);
    const warpX = this.fbm(x + 5.2, y + 1.3, oct) * warpScale;
    const warpY = this.fbm(x + 9.7, y + 2.8, oct) * warpScale;
    return this.fbm(x + warpX * 10, y + warpY * 10, oct);
  }

  /** Turbulence noise - absolute value creates cloud-like patterns */
  turbulence(x: number, y: number, octaves?: number): number {
    const oct = octaves ?? this._octaves;
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < oct; i++) {
      value += amplitude * Math.abs(this.sample(x * frequency, y * frequency) * 2 - 1);
      maxValue += amplitude;
      amplitude *= this._falloff;
      frequency *= this._lacunarity;
    }

    return value / maxValue;
  }

  /** Billowy noise - inverse of ridged, creates soft round hills */
  billowy(x: number, y: number, octaves?: number): number {
    const oct = octaves ?? this._octaves;
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < oct; i++) {
      const n = this.sample(x * frequency, y * frequency);
      value += amplitude * (n * n);  // Square for soft bumps
      maxValue += amplitude;
      amplitude *= this._falloff;
      frequency *= this._lacunarity;
    }

    return value / maxValue;
  }
}

// ============================================================================
// CELLULAR NOISE (Worley)
// ============================================================================

/** Result of cellular noise sampling */
export type CellularSample = {
  /** Distance to nearest cell center */
  f1: number;
  /** Distance to second nearest cell center */
  f2: number;
  /** ID of the nearest cell */
  cellId: number;
};

/**
 * Cellular/Worley noise for organic cell patterns
 * Useful for biome boundaries, stone textures, etc.
 */
export class CellularNoise {
  private points: Float32Array;
  private gridSize: number;

  constructor(seed: number, density: number = 1) {
    const rng = new RNG(seed);
    this.gridSize = Math.ceil(density);
    const pointCount = this.gridSize * this.gridSize;
    this.points = new Float32Array(pointCount * 2);

    for (let i = 0; i < pointCount; i++) {
      this.points[i * 2] = rng.nextFloat01();
      this.points[i * 2 + 1] = rng.nextFloat01();
    }
  }

  /** Get distance to nearest cell center */
  sample(x: number, y: number): CellularSample {
    const cellX = Math.floor(x);
    const cellY = Math.floor(y);
    const fracX = x - cellX;
    const fracY = y - cellY;

    let f1 = 999;
    let f2 = 999;
    let cellId = 0;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const neighborX = cellX + dx;
        const neighborY = cellY + dy;
        const hash = Math.abs((neighborX * 127 + neighborY * 311) % (this.gridSize * this.gridSize));
        const pointX = dx + this.points[hash * 2]!;
        const pointY = dy + this.points[hash * 2 + 1]!;
        const distX = pointX - fracX;
        const distY = pointY - fracY;
        const dist = Math.sqrt(distX * distX + distY * distY);

        if (dist < f1) {
          f2 = f1;
          f1 = dist;
          cellId = hash;
        } else if (dist < f2) {
          f2 = dist;
        }
      }
    }

    return { f1, f2, cellId };
  }

  /** Get cell boundary value (f2 - f1), useful for edges */
  sampleEdge(x: number, y: number): number {
    const { f1, f2 } = this.sample(x, y);
    return f2 - f1;
  }
}

// ============================================================================
// HEIGHT MAP GENERATION
// ============================================================================

/**
 * Generate a height map using the technique from terrain tutorials:
 * 1. Use Perlin noise with zoom factor
 * 2. Apply octaves for detail
 * 3. Result is a smooth height map (0-1) for terrain generation
 */
export function generateHeightMap(
  width: number,
  height: number,
  seed: number,
  zoomFactor: number = 100,
  noiseDetail?: NoiseDetailConfig
): Float32Array {
  const noise = new GradientNoise(seed, noiseDetail);
  const heightMap = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = x + y * width;
      // The key technique: divide by zoom factor to "zoom in" on the noise
      // This makes values closer together, creating smoother terrain
      heightMap[idx] = noise.sampleZoomed(x, y, zoomFactor);
    }
  }

  return heightMap;
}

/**
 * Generate a combined height map with multiple noise types
 * Blends gradient noise, ridged noise, and domain warping
 */
export function generateDetailedHeightMap(
  width: number,
  height: number,
  seed: number,
  options?: {
    zoomFactor?: number;
    noiseDetail?: NoiseDetailConfig;
    /** Weight for base fbm noise (default: 0.5) */
    fbmWeight?: number;
    /** Weight for ridged noise (default: 0.3) */
    ridgedWeight?: number;
    /** Weight for warped noise (default: 0.2) */
    warpedWeight?: number;
  }
): Float32Array {
  const zoom = options?.zoomFactor ?? 100;
  const detail = options?.noiseDetail ?? { octaves: 6, falloff: 0.5 };
  const fbmW = options?.fbmWeight ?? 0.5;
  const ridgedW = options?.ridgedWeight ?? 0.3;
  const warpedW = options?.warpedWeight ?? 0.2;

  const noise = new GradientNoise(seed, detail);
  const heightMap = new Float32Array(width * height);
  const scale = 1 / zoom;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = x + y * width;
      const nx = x * scale;
      const ny = y * scale;

      const base = noise.fbm(nx, ny);
      const ridges = noise.ridged(nx * 0.5, ny * 0.5, 3);
      const warp = noise.warped(nx * 0.3, ny * 0.3, 0.3, 3);

      heightMap[idx] = clamp01(base * fbmW + ridges * ridgedW + warp * warpedW);
    }
  }

  return heightMap;
}
