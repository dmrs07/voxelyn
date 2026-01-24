/**
 * Shadow/lighting generation for terrain
 * Uses raycast technique for realistic terrain shadows
 */

import { clamp01 } from "./noise.js";

// ============================================================================
// TYPES
// ============================================================================

export type ShadowParams = {
  /** Enable shadow generation */
  enabled?: boolean;
  /** Light direction (normalized). Default: { x: -0.5, y: -0.5 } */
  lightDirection?: { x: number; y: number };
  /** Shadow intensity (0-1). Default: 0.4 */
  intensity?: number;
  /** Max shadow cast distance in cells. Default: 20 */
  maxDistance?: number;
};

export type LightDirection = {
  x: number;
  y: number;
};

// ============================================================================
// SHADOW GENERATION
// ============================================================================

/**
 * Generate shadow map using raycast technique
 * For each pixel, cast a ray toward the light and check if it hits higher terrain
 * 
 * This creates realistic terrain shadows where mountains block light
 * 
 * @param width - Map width
 * @param height - Map height  
 * @param heightMap - Terrain height values (0-1)
 * @param lightDir - Direction toward light source
 * @param maxDistance - Max raycast distance
 * @param intensity - Shadow darkness (0-1)
 * @returns Shadow map where 1 = fully lit, 0 = fully shadowed
 */
export function generateShadowMap(
  width: number,
  height: number,
  heightMap: Float32Array,
  lightDir: LightDirection = { x: -0.5, y: -0.5 },
  maxDistance: number = 20,
  intensity: number = 0.4
): Float32Array {
  const shadowMap = new Float32Array(width * height);
  shadowMap.fill(1); // Start fully lit

  // Normalize light direction
  const len = Math.sqrt(lightDir.x * lightDir.x + lightDir.y * lightDir.y);
  if (len === 0) return shadowMap;
  
  const lx = lightDir.x / len;
  const ly = lightDir.y / len;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = x + y * width;
      const currentHeight = heightMap[idx] ?? 0;

      // Raycast toward light source
      let inShadow = false;
      for (let d = 1; d <= maxDistance && !inShadow; d++) {
        const sampleX = Math.round(x + lx * d);
        const sampleY = Math.round(y + ly * d);
        
        if (sampleX < 0 || sampleX >= width || sampleY < 0 || sampleY >= height) {
          break;
        }

        const sampleIdx = sampleX + sampleY * width;
        const sampleHeight = heightMap[sampleIdx] ?? 0;

        // Check if sample point is higher (blocking light)
        // The height difference needed increases with distance (perspective)
        const heightNeeded = currentHeight + (d * 0.01);
        if (sampleHeight > heightNeeded) {
          inShadow = true;
          // Softer shadow based on how much higher the blocker is
          const shadowStrength = Math.min(1, (sampleHeight - currentHeight) * 5);
          shadowMap[idx] = 1 - shadowStrength * intensity;
        }
      }
    }
  }

  return shadowMap;
}

/**
 * Update an existing shadow map with a new light direction
 * Useful for dynamic lighting (clicking to change sun position)
 */
export function updateShadowMap(
  shadowMap: Float32Array,
  width: number,
  height: number,
  heightMap: Float32Array,
  lightDir: LightDirection,
  maxDistance: number = 20,
  intensity: number = 0.4
): void {
  const newShadows = generateShadowMap(width, height, heightMap, lightDir, maxDistance, intensity);
  for (let i = 0; i < newShadows.length; i++) {
    shadowMap[i] = newShadows[i]!;
  }
}

/**
 * Generate ambient occlusion based on surrounding height differences
 * Creates soft shadows in valleys and corners
 */
export function generateAmbientOcclusion(
  width: number,
  height: number,
  heightMap: Float32Array,
  radius: number = 3,
  intensity: number = 0.3
): Float32Array {
  const aoMap = new Float32Array(width * height);
  aoMap.fill(1);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = x + y * width;
      const currentHeight = heightMap[idx] ?? 0;
      
      let occlusion = 0;
      let samples = 0;

      // Sample surrounding heights
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx === 0 && dy === 0) continue;
          
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

          const neighborIdx = nx + ny * width;
          const neighborHeight = heightMap[neighborIdx] ?? 0;
          
          // If neighbor is higher, this point is more occluded
          if (neighborHeight > currentHeight) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            const heightDiff = neighborHeight - currentHeight;
            occlusion += (heightDiff / dist) * intensity;
          }
          samples++;
        }
      }

      if (samples > 0) {
        aoMap[idx] = clamp01(1 - occlusion / samples);
      }
    }
  }

  return aoMap;
}

/**
 * Combine shadow map and ambient occlusion
 */
export function combineLighting(
  shadowMap: Float32Array,
  aoMap: Float32Array,
  shadowWeight: number = 0.7,
  aoWeight: number = 0.3
): Float32Array {
  const combined = new Float32Array(shadowMap.length);
  
  for (let i = 0; i < shadowMap.length; i++) {
    const shadow = shadowMap[i] ?? 1;
    const ao = aoMap[i] ?? 1;
    combined[i] = clamp01(shadow * shadowWeight + ao * aoWeight);
  }

  return combined;
}
