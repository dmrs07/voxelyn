/**
 * @voxelyn/ai - Premium AI Module Types
 *
 * Type definitions for AI-generated content parameters.
 * These schemas are designed for JSON serialization and Gemini output parsing.
 */

import type { Material } from '@voxelyn/core';

// ============================================================================
// TEXTURE GENERATION TYPES
// ============================================================================

/**
 * Base texture type determines the primary generator algorithm.
 */
export type TextureBaseType =
  | 'rock'
  | 'metal'
  | 'organic'
  | 'liquid'
  | 'crystal'
  | 'fabric'
  | 'wood'
  | 'earth'
  | 'custom';

/**
 * Noise configuration for procedural texture generation.
 */
export type NoiseConfig = {
  /** Number of noise octaves (1-6). Higher = more detail complexity. */
  octaves: number;
  /** Detail falloff per octave (0.3-0.8). Lower = sharper features. */
  persistence: number;
  /** Base feature scale (0.5-8). Lower = larger features. */
  scale: number;
  /** Random seed for deterministic generation. */
  seed: number;
};

/**
 * Visual effects to apply to the texture.
 */
export type TextureEffects = {
  /** Add crack-like patterns (rocks, dried earth). */
  cracks: boolean;
  /** Add metallic highlights/reflections. */
  highlights: boolean;
  /** Add ripple patterns (liquids, waves). */
  ripples: boolean;
  /** Directional grain (wood, fabric, brushed metal). */
  grainDirection: 'none' | 'horizontal' | 'vertical' | 'radial' | 'diagonal';
  /** Edge darkening for depth. */
  vignette: boolean;
  /** Pixelation level (1 = no pixelation, higher = more chunky). */
  pixelation: number;
};

/**
 * Color variation settings for natural-looking textures.
 */
export type ColorVariation = {
  /** Hue shift range in degrees (±value). */
  hueShift: number;
  /** Saturation variation range (0-0.5). */
  saturationRange: number;
  /** Brightness variation range (0-0.5). */
  brightnessRange: number;
};

/**
 * Complete parameters for AI-guided texture generation.
 * Gemini predicts these from natural language prompts.
 */
export type TextureParams = {
  /** Primary texture algorithm type. */
  baseType: TextureBaseType;
  /** Base color in RGBA8888 format. */
  baseColor: number;
  /** Secondary color for gradients/details (optional). */
  secondaryColor?: number;
  /** Noise layer configuration. */
  noise: NoiseConfig;
  /** Visual effects to apply. */
  effects: TextureEffects;
  /** Color variation for natural look. */
  colorVariation: ColorVariation;
  /** Suggested material properties based on texture type. */
  suggestedMaterial?: Partial<Material>;
  /** User's original prompt (for caching/regeneration). */
  originalPrompt?: string;
};

/**
 * Default texture parameters for fallback.
 */
export const DEFAULT_TEXTURE_PARAMS: TextureParams = {
  baseType: 'rock',
  baseColor: 0xff808080, // Gray
  noise: {
    octaves: 4,
    persistence: 0.5,
    scale: 2,
    seed: 12345,
  },
  effects: {
    cracks: false,
    highlights: false,
    ripples: false,
    grainDirection: 'none',
    vignette: false,
    pixelation: 1,
  },
  colorVariation: {
    hueShift: 10,
    saturationRange: 0.1,
    brightnessRange: 0.15,
  },
};

// ============================================================================
// OBJECT GENERATION TYPES
// ============================================================================

/**
 * Primitive shape types for voxel object construction.
 */
export type PrimitiveType =
  | 'box'
  | 'cylinder'
  | 'sphere'
  | 'slope'
  | 'arch'
  | 'cone'
  | 'pyramid'
  | 'torus';

/**
 * A single primitive shape in an object blueprint.
 */
export type Primitive = {
  /** Shape type. */
  type: PrimitiveType;
  /** Position offset from object origin [x, y, z]. */
  position: [number, number, number];
  /** Size/dimensions [width, height, depth]. */
  size: [number, number, number];
  /** Material ID or name to use. */
  material: number | string;
  /** Rotation in 90° increments [rx, ry, rz] (0-3 each). */
  rotation?: [number, number, number];
  /** Whether this primitive subtracts (carves) instead of adds. */
  subtract?: boolean;
};

/**
 * Complete blueprint for constructing a voxel object.
 * Interpreted by the object-interpreter to build actual voxels.
 */
export type ObjectBlueprint = {
  /** Human-readable object name. */
  name: string;
  /** Brief description of the object. */
  description: string;
  /** Overall bounding box [width, height, depth]. */
  bounds: [number, number, number];
  /** List of primitives that compose the object. */
  primitives: Primitive[];
  /** Material palette references (name -> id mapping). */
  materialMapping: Record<string, number>;
  /** Suggested new materials if object needs custom ones. */
  suggestedMaterials?: Partial<Material>[];
  /** User's original prompt. */
  originalPrompt?: string;
  /** Generation seed for variations. */
  seed?: number;
};

/**
 * Default empty blueprint.
 */
export const DEFAULT_OBJECT_BLUEPRINT: ObjectBlueprint = {
  name: 'Empty Object',
  description: 'An empty object blueprint',
  bounds: [1, 1, 1],
  primitives: [],
  materialMapping: {},
};

// ============================================================================
// SCENARIO GENERATION TYPES
// ============================================================================

/**
 * Biome types for terrain generation.
 */
export type BiomeType =
  | 'plains'
  | 'forest'
  | 'desert'
  | 'mountains'
  | 'ocean'
  | 'river'
  | 'lake'
  | 'swamp'
  | 'tundra'
  | 'volcanic'
  | 'cave'
  | 'urban'
  | 'ruins';

/**
 * A region in the scenario layout.
 */
export type BiomeRegion = {
  /** Biome type for this region. */
  type: BiomeType;
  /** Bounding area [x, y, width, height] in grid units. */
  bounds: [number, number, number, number];
  /** Base elevation (0-1 normalized). */
  elevation: number;
  /** Elevation variation (noise amplitude). */
  elevationVariation: number;
  /** Moisture level (affects vegetation). */
  moisture: number;
  /** Primary surface material. */
  surfaceMaterial: string;
  /** Material for underground/depth. */
  undergroundMaterial: string;
};

/**
 * Object placement rule for scenario population.
 */
export type ObjectPlacement = {
  /** Object type/name to place. */
  objectType: string;
  /** Which biome(s) to place in. */
  biomes: BiomeType[];
  /** Density (objects per 100 grid units). */
  density: number;
  /** Minimum distance between instances. */
  minSpacing: number;
  /** Random scale variation [min, max]. */
  scaleRange: [number, number];
  /** Prefer placement near specific features. */
  preferNear?: 'water' | 'elevation' | 'edge' | 'center';
};

/**
 * Heightmap generation parameters.
 */
export type HeightmapParams = {
  /** Base noise octaves. */
  octaves: number;
  /** Noise persistence. */
  persistence: number;
  /** Feature scale. */
  scale: number;
  /** Seed for determinism. */
  seed: number;
  /** Global elevation offset (0-1). */
  baseElevation: number;
  /** Maximum elevation amplitude. */
  amplitude: number;
};

/**
 * Complete scenario/world layout definition.
 */
export type ScenarioLayout = {
  /** Scenario name. */
  name: string;
  /** Brief description. */
  description: string;
  /** World size [width, height] in voxels. */
  size: [number, number];
  /** World depth (Z layers). */
  depth: number;
  /** Biome regions that compose the world. */
  biomes: BiomeRegion[];
  /** Heightmap generation parameters. */
  heightmap: HeightmapParams;
  /** Object placement rules. */
  objects: ObjectPlacement[];
  /** Custom material definitions for this scenario. */
  materials?: Partial<Material>[];
  /** User's original prompt. */
  originalPrompt?: string;
  /** Generation seed. */
  seed: number;
};

/**
 * Default scenario layout.
 */
export const DEFAULT_SCENARIO_LAYOUT: ScenarioLayout = {
  name: 'Empty World',
  description: 'A flat empty world',
  size: [128, 128],
  depth: 32,
  biomes: [
    {
      type: 'plains',
      bounds: [0, 0, 128, 128],
      elevation: 0.3,
      elevationVariation: 0.1,
      moisture: 0.5,
      surfaceMaterial: 'grass',
      undergroundMaterial: 'dirt',
    },
  ],
  heightmap: {
    octaves: 4,
    persistence: 0.5,
    scale: 4,
    seed: 42,
    baseElevation: 0.3,
    amplitude: 0.4,
  },
  objects: [],
  seed: 42,
};

// ============================================================================
// API TYPES
// ============================================================================

/**
 * Generation request types.
 */
export type GenerationType = 'texture' | 'object' | 'scenario';

/**
 * Result from AI generation.
 */
export type AIGenerationResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
  /** Tokens used (for cost tracking). */
  tokensUsed?: number;
  /** Generation time in ms. */
  generationTimeMs?: number;
};

/**
 * Configuration for the AI client.
 */
export type AIClientConfig = {
  /** Google Gemini API key. */
  apiKey: string;
  /** Model to use (default: gemini-2.0-flash). */
  model?: 'gemini-2.0-flash' | 'gemini-2.0-flash-lite' | 'gemini-1.5-pro' | 'gemini-pro';
  /** Maximum retries on failure. */
  maxRetries?: number;
  /** Request timeout in ms. */
  timeoutMs?: number;
  /** Enable debug logging. */
  debug?: boolean;
};

/**
 * Stored AI parameters in document for regeneration.
 */
export type AIGeneratedParams = {
  textures: Record<number, TextureParams>; // materialId -> params
  objects: Record<string, ObjectBlueprint>; // objectName -> blueprint
  scenarios: Record<string, ScenarioLayout>; // scenarioName -> layout
};
