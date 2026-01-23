/**
 * @voxelyn/ai - Texture Generator
 *
 * Generates procedural textures from AI-predicted parameters.
 * Uses the same noise system as @voxelyn/core but with AI-guided configuration.
 */

import { packRGBA, unpackRGBA } from '@voxelyn/core';
import type { TextureParams, TextureBaseType, TextureEffects, ColorVariation } from '../types';

// ============================================================================
// NOISE CLASS (matches @voxelyn/core for consistency)
// ============================================================================

class Noise {
  private permutation: number[];

  constructor(seed: number = 42) {
    this.permutation = [];
    for (let i = 0; i < 256; i++) {
      this.permutation[i] = i;
    }
    let rng = seed;
    for (let i = 255; i > 0; i--) {
      rng = (rng * 1103515245 + 12345) & 0x7fffffff;
      const j = (rng % (i + 1)) | 0;
      const tmp = this.permutation[i];
      if (tmp !== undefined && this.permutation[j] !== undefined) {
        this.permutation[i] = this.permutation[j]!;
        this.permutation[j] = tmp;
      }
    }
  }

  noise(x: number, y: number): number {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);

    const p = this.permutation;
    const a = (p[xi] ?? 0) + yi;
    const aa = p[a & 255] ?? 0;
    const ab = p[(a + 1) & 255] ?? 0;
    const b = (p[(xi + 1) & 255] ?? 0) + yi;
    const ba = p[b & 255] ?? 0;
    const bb = p[(b + 1) & 255] ?? 0;

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
    const uh = h < 8 ? x : y;
    const vh = h < 8 ? y : x;
    return ((h & 1) === 0 ? uh : -uh) + ((h & 2) === 0 ? vh : -vh);
  }

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
// COLOR UTILITIES
// ============================================================================

/**
 * Convert RGB to HSL.
 */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return [h * 360, s, l];
}

/**
 * Convert HSL to RGB.
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360;

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Apply color variation to a base color.
 */
function applyColorVariation(
  r: number,
  g: number,
  b: number,
  variation: ColorVariation,
  noise: Noise,
  x: number,
  y: number
): [number, number, number] {
  const [h, s, l] = rgbToHsl(r, g, b);

  // Noise-based variation
  const n1 = noise.noise(x * 0.2, y * 0.2);
  const n2 = noise.noise(x * 0.15 + 100, y * 0.15 + 100);
  const n3 = noise.noise(x * 0.1 + 200, y * 0.1 + 200);

  // Apply variations
  const newH = h + (n1 - 0.5) * variation.hueShift * 2;
  const newS = Math.max(0, Math.min(1, s + (n2 - 0.5) * variation.saturationRange * 2));
  const newL = Math.max(0, Math.min(1, l + (n3 - 0.5) * variation.brightnessRange * 2));

  return hslToRgb(newH, newS, newL);
}

// ============================================================================
// EFFECT FUNCTIONS
// ============================================================================

/**
 * Apply crack effect (darker lines for rock/earth).
 */
function applyCracks(
  brightness: number,
  noise: Noise,
  x: number,
  y: number,
  scale: number
): number {
  const crackNoise = noise.noise(x / (scale * 0.3), y / (scale * 0.3));
  if (crackNoise > 0.72) {
    return brightness * 0.6;
  }
  if (crackNoise > 0.68) {
    return brightness * 0.8;
  }
  return brightness;
}

/**
 * Apply metallic highlight effect.
 */
function applyHighlights(
  brightness: number,
  x: number,
  y: number,
  width: number,
  height: number,
  noise: Noise,
  scale: number
): number {
  // Edge-based highlight
  const dx = x - width / 2;
  const dy = y - height / 2;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const edgeHighlight = Math.max(0, 1 - dist / (Math.min(width, height) / 2)) * 0.25;

  // Noise-based streaks
  const streakNoise = noise.fbm(x / scale, y / (scale * 2), 2, 0.7);

  return brightness + edgeHighlight + streakNoise * 0.15;
}

/**
 * Apply ripple effect (water/liquid).
 */
function applyRipples(
  x: number,
  y: number,
  noise: Noise,
  _scale: number
): number {
  const ripple = Math.sin(x * 0.5 + noise.noise(x * 0.1, y * 0.1) * 3) * 0.1 +
                 Math.cos(y * 0.5 + noise.noise(x * 0.1 + 50, y * 0.1 + 50) * 3) * 0.1;
  return ripple;
}

/**
 * Apply directional grain (wood/fabric).
 */
function applyGrain(
  brightness: number,
  x: number,
  y: number,
  direction: TextureEffects['grainDirection'],
  noise: Noise,
  scale: number
): number {
  let grainValue = 0;

  switch (direction) {
    case 'horizontal':
      grainValue = Math.sin(y / scale * 8 + noise.noise(x * 0.1, y * 0.05) * 2) * 0.1;
      break;
    case 'vertical':
      grainValue = Math.sin(x / scale * 8 + noise.noise(x * 0.05, y * 0.1) * 2) * 0.1;
      break;
    case 'diagonal':
      grainValue = Math.sin((x + y) / scale * 6 + noise.noise(x * 0.08, y * 0.08) * 2) * 0.1;
      break;
    case 'radial': {
      const cx = x - 8;
      const cy = y - 8;
      const angle = Math.atan2(cy, cx);
      grainValue = Math.sin(angle * 8 + noise.noise(x * 0.1, y * 0.1) * 3) * 0.08;
      break;
    }
    default:
      grainValue = 0;
  }

  return brightness + grainValue;
}

/**
 * Apply vignette (edge darkening).
 */
function applyVignette(
  brightness: number,
  x: number,
  y: number,
  width: number,
  height: number
): number {
  const cx = (x - width / 2) / (width / 2);
  const cy = (y - height / 2) / (height / 2);
  const dist = Math.sqrt(cx * cx + cy * cy);
  const vignette = Math.max(0, 1 - dist * 0.5);
  return brightness * (0.7 + vignette * 0.3);
}

/**
 * Apply pixelation effect.
 */
function pixelate(x: number, y: number, level: number): [number, number] {
  if (level <= 1) return [x, y];
  return [Math.floor(x / level) * level, Math.floor(y / level) * level];
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generate a texture from AI-predicted parameters.
 *
 * @param params - TextureParams from Gemini prediction
 * @param width - Output texture width (default 32)
 * @param height - Output texture height (default 32)
 * @returns RGBA8888 texture as Uint32Array
 */
export function generateTextureFromParams(
  params: TextureParams,
  width: number = 32,
  height: number = 32
): Uint32Array {
  const { baseType, baseColor, secondaryColor, noise: noiseConfig, effects, colorVariation } = params;

  const noiseGen = new Noise(noiseConfig.seed);
  const texture = new Uint32Array(width * height);

  const [baseR, baseG, baseB, baseA] = unpackRGBA(baseColor);
  const [secR, secG, secB] = secondaryColor
    ? unpackRGBA(secondaryColor)
    : [baseR, baseG, baseB];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Apply pixelation
      const [px, py] = pixelate(x, y, effects.pixelation);

      // Base noise pattern
      const n = noiseGen.fbm(
        px / noiseConfig.scale,
        py / noiseConfig.scale,
        noiseConfig.octaves,
        noiseConfig.persistence
      );

      // Start with noise-based brightness
      let brightness = n * 0.4 + 0.6;

      // Apply type-specific base processing
      brightness = applyBaseTypeEffect(baseType, brightness, noiseGen, px, py, noiseConfig.scale);

      // Apply effects
      if (effects.cracks) {
        brightness = applyCracks(brightness, noiseGen, px, py, noiseConfig.scale);
      }

      if (effects.highlights) {
        brightness = applyHighlights(brightness, px, py, width, height, noiseGen, noiseConfig.scale);
      }

      if (effects.ripples) {
        const ripple = applyRipples(px, py, noiseGen, noiseConfig.scale);
        brightness += ripple;
      }

      if (effects.grainDirection !== 'none') {
        brightness = applyGrain(brightness, px, py, effects.grainDirection, noiseGen, noiseConfig.scale);
      }

      if (effects.vignette) {
        brightness = applyVignette(brightness, px, py, width, height);
      }

      // Clamp brightness
      brightness = Math.max(0.2, Math.min(1.3, brightness));

      // Blend base and secondary color based on noise
      const blend = noiseGen.noise(px * 0.15, py * 0.15);
      let r = baseR + (secR - baseR) * blend * 0.3;
      let g = baseG + (secG - baseG) * blend * 0.3;
      let b = baseB + (secB - baseB) * blend * 0.3;

      // Apply color variation
      [r, g, b] = applyColorVariation(r, g, b, colorVariation, noiseGen, px, py);

      // Apply brightness
      r = Math.max(0, Math.min(255, (r * brightness) | 0));
      g = Math.max(0, Math.min(255, (g * brightness) | 0));
      b = Math.max(0, Math.min(255, (b * brightness) | 0));

      // Handle liquid alpha variation
      let a = baseA;
      if (baseType === 'liquid') {
        a = Math.max(100, Math.min(220, baseA + (n - 0.5) * 60));
      }

      texture[y * width + x] = packRGBA(r, g, b, a);
    }
  }

  return texture;
}

/**
 * Apply base type-specific effects.
 */
function applyBaseTypeEffect(
  baseType: TextureBaseType,
  brightness: number,
  noise: Noise,
  x: number,
  y: number,
  scale: number
): number {
  switch (baseType) {
    case 'rock':
    case 'earth': {
      // Add subtle irregularity
      const rockNoise = noise.noise(x / (scale * 0.5), y / (scale * 0.5));
      return brightness * (0.85 + rockNoise * 0.3);
    }

    case 'metal': {
      // Smoother with directional streaks
      const metalStreak = noise.fbm(x / scale, y / (scale * 2), 2, 0.6);
      return brightness * 0.9 + metalStreak * 0.2;
    }

    case 'organic': {
      // Fluffy, varied
      const organicN1 = noise.fbm(x / scale, y / scale, 4, 0.55);
      const organicN2 = noise.noise(x / (scale * 0.7), y / (scale * 0.7));
      return brightness * 0.8 + (organicN1 * 0.15 + organicN2 * 0.1);
    }

    case 'liquid':
      // Flowing, smooth
      return brightness * 0.95;

    case 'crystal': {
      // Sharp facets
      const crystalNoise = Math.abs(noise.noise(x / (scale * 0.4), y / (scale * 0.4)) - 0.5) * 2;
      return brightness * (0.7 + crystalNoise * 0.5);
    }

    case 'fabric': {
      // Woven pattern
      const weavex = Math.sin(x / scale * 12) * 0.05;
      const weavey = Math.sin(y / scale * 12) * 0.05;
      return brightness + weavex + weavey;
    }

    case 'wood': {
      // Ring/grain patterns
      const woodRings = Math.sin(Math.sqrt((x - 8) ** 2 + (y - 8) ** 2) / scale * 3) * 0.1;
      return brightness + woodRings;
    }

    default:
      return brightness;
  }
}

/**
 * Generate a preview thumbnail from params (smaller, faster).
 */
export function generateTexturePreview(params: TextureParams, size: number = 16): Uint32Array {
  return generateTextureFromParams(params, size, size);
}

/**
 * Create a tileable version of texture params by adjusting noise settings.
 */
export function makeTileable(params: TextureParams): TextureParams {
  return {
    ...params,
    noise: {
      ...params.noise,
      // Use scale that produces seamless edges
      scale: Math.round(params.noise.scale),
    },
    effects: {
      ...params.effects,
      // Disable vignette for tileable
      vignette: false,
    },
  };
}
