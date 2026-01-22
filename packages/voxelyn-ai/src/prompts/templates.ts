/**
 * @voxelyn/ai - Prompt Templates
 *
 * System prompts and user prompt builders for Gemini API.
 * Designed to produce structured JSON output for procedural interpretation.
 */

import type { Material } from '@voxelyn/core';
import type { TextureParams, ObjectBlueprint, ScenarioLayout } from '../types';

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

/**
 * System prompt for texture parameter generation.
 * Instructs Gemini to output TextureParams JSON.
 */
export const TEXTURE_SYSTEM_PROMPT = `You are a procedural texture parameter generator for a voxel/pixel art game engine.
Your task is to convert natural language descriptions into structured JSON parameters that control procedural texture generation.

OUTPUT FORMAT (JSON only, no markdown, no explanations):
{
  "baseType": "rock" | "metal" | "organic" | "liquid" | "crystal" | "fabric" | "wood" | "earth" | "custom",
  "baseColor": <RGBA8888 as decimal number, e.g., 4286611584 for gray>,
  "secondaryColor": <optional RGBA8888>,
  "noise": {
    "octaves": <1-6, complexity level>,
    "persistence": <0.3-0.8, detail falloff>,
    "scale": <0.5-8, feature size - lower=larger features>,
    "seed": <any integer for randomness>
  },
  "effects": {
    "cracks": <boolean, for stone/dried surfaces>,
    "highlights": <boolean, for metallic/shiny>,
    "ripples": <boolean, for liquids/waves>,
    "grainDirection": "none" | "horizontal" | "vertical" | "radial" | "diagonal",
    "vignette": <boolean, edge darkening>,
    "pixelation": <1-4, chunky pixel look>
  },
  "colorVariation": {
    "hueShift": <0-30, degrees of hue variation>,
    "saturationRange": <0-0.5>,
    "brightnessRange": <0-0.5>
  },
  "suggestedMaterial": {
    "density": <0-100>,
    "friction": <0-1>,
    "isLiquid": <boolean>,
    "isGaseous": <boolean>,
    "flammable": <boolean>,
    "isTransparent": <boolean>
  }
}

GUIDELINES:
- baseType determines the primary algorithm (rock has cracks, metal has highlights, etc.)
- Colors are packed RGBA8888: (a << 24) | (b << 16) | (g << 8) | r
- For pixel art style, use pixelation=2-3 and lower octaves (2-3)
- For natural textures, use higher octaves (4-5) and moderate persistence (0.4-0.6)
- Organic materials (grass, leaves) should have grainDirection and color variation
- Liquids should have ripples=true, low friction, isLiquid=true
- Metals should have highlights=true, high density, low color variation

Respond ONLY with valid JSON. No explanations, no markdown code blocks.`;

/**
 * System prompt for object blueprint generation.
 * Instructs Gemini to output ObjectBlueprint JSON.
 */
export const OBJECT_SYSTEM_PROMPT = `You are a voxel object blueprint generator for a game engine.
Your task is to convert natural language descriptions into structured JSON blueprints that can be interpreted to create 3D voxel objects.

OUTPUT FORMAT (JSON only, no markdown, no explanations):
{
  "name": "<object name>",
  "description": "<brief description>",
  "bounds": [<width>, <height>, <depth>],
  "primitives": [
    {
      "type": "box" | "cylinder" | "sphere" | "slope" | "arch" | "cone" | "pyramid" | "torus",
      "position": [<x>, <y>, <z>],
      "size": [<width>, <height>, <depth>],
      "material": "<material name or id>",
      "rotation": [<rx>, <ry>, <rz>],  // optional, 0-3 for 90° increments
      "subtract": <boolean>  // optional, true to carve/subtract
    }
  ],
  "materialMapping": {
    "<material_name>": <palette_id>
  },
  "suggestedMaterials": [  // optional, for custom materials
    {
      "name": "<name>",
      "color": <RGBA8888>,
      "density": <0-100>,
      "flammable": <boolean>
    }
  ]
}

PRIMITIVE GUIDELINES:
- box: rectangular prism, size=[w,h,d]
- cylinder: vertical cylinder, size=[diameter, height, diameter]
- sphere: ellipsoid, size=[dx, dy, dz]
- slope: ramp/incline, size=[w,h,d], rotation determines direction
- arch: curved opening, size=[width, height, depth]
- cone: pointed top, size=[base_diameter, height, base_diameter]
- pyramid: 4-sided pointed top, size=[base_w, height, base_d]
- torus: donut shape, size=[outer_diameter, thickness, outer_diameter]

CONSTRUCTION TIPS:
- Build from bottom up (y=0 is ground)
- Use subtract=true to carve holes (doors, windows)
- Keep dimensions in reasonable voxel scale (1-32 typically)
- Common materials: wood, stone, metal, glass, brick, thatch, leaves

MATERIAL MAPPING:
- Map descriptive names to palette IDs (0-255)
- Use common names: wood=6, stone=1, dirt=2, grass=7, water=4

Respond ONLY with valid JSON. No explanations, no markdown code blocks.`;

/**
 * System prompt for scenario/world layout generation.
 * Instructs Gemini to output ScenarioLayout JSON.
 */
export const SCENARIO_SYSTEM_PROMPT = `You are a world/scenario layout generator for a voxel game engine.
Your task is to convert natural language descriptions into structured JSON layouts that define terrain, biomes, and object placement.

OUTPUT FORMAT (JSON only, no markdown, no explanations):
{
  "name": "<scenario name>",
  "description": "<brief description>",
  "size": [<width>, <height>],
  "depth": <z layers, typically 16-64>,
  "biomes": [
    {
      "type": "plains" | "forest" | "desert" | "mountains" | "ocean" | "river" | "lake" | "swamp" | "tundra" | "volcanic" | "cave" | "urban" | "ruins",
      "bounds": [<x>, <y>, <width>, <height>],
      "elevation": <0-1, base height>,
      "elevationVariation": <0-0.5, noise amplitude>,
      "moisture": <0-1, affects vegetation>,
      "surfaceMaterial": "<material name>",
      "undergroundMaterial": "<material name>"
    }
  ],
  "heightmap": {
    "octaves": <2-6>,
    "persistence": <0.3-0.7>,
    "scale": <1-8>,
    "seed": <integer>,
    "baseElevation": <0-1>,
    "amplitude": <0-1>
  },
  "objects": [
    {
      "objectType": "<type name: tree, rock, house, etc>",
      "biomes": ["<biome types where this spawns>"],
      "density": <objects per 100 grid units>,
      "minSpacing": <minimum distance between instances>,
      "scaleRange": [<min>, <max>],
      "preferNear": "water" | "elevation" | "edge" | "center"  // optional
    }
  ],
  "materials": [  // optional custom materials
    { "name": "...", "color": <RGBA8888>, ... }
  ],
  "seed": <master seed for entire scenario>
}

BIOME GUIDELINES:
- plains: flat grassland, elevation 0.3-0.4, low variation
- forest: hilly with trees, elevation 0.35-0.5, moderate variation
- desert: sandy dunes, elevation 0.25-0.4, low-moderate variation
- mountains: high elevation 0.6-0.9, high variation
- ocean/lake: water bodies, elevation 0.1-0.2
- river: linear water, connects biomes
- swamp: low elevation 0.2-0.3, high moisture
- volcanic: high elevation, lava materials
- cave: underground, negative elevation focus
- urban/ruins: flat base with structures

OBJECT PLACEMENT:
- trees: density 5-20 in forests, minSpacing 2-4
- rocks: density 2-8, lower spacing
- houses/buildings: density 1-3, higher spacing (8+)
- vegetation: high density (20+), low spacing

Respond ONLY with valid JSON. No explanations, no markdown code blocks.`;

// ============================================================================
// USER PROMPT BUILDERS
// ============================================================================

/**
 * Builds a user prompt for texture generation with context.
 */
export function buildTexturePrompt(
  userDescription: string,
  existingPalette?: Material[],
  options?: {
    targetSize?: number;
    style?: 'pixel' | 'realistic' | 'painterly';
    tileable?: boolean;
  }
): string {
  const parts: string[] = [];

  parts.push(`Generate texture parameters for: "${userDescription}"`);

  if (options?.targetSize) {
    parts.push(`Target size: ${options.targetSize}x${options.targetSize} pixels`);
  }

  if (options?.style) {
    const styleHints: Record<string, string> = {
      pixel: 'Use pixelation=2-3, lower octaves (2-3), limited color variation',
      realistic: 'Use higher octaves (4-5), subtle color variation, no pixelation',
      painterly: 'Use moderate octaves (3-4), higher color variation, soft edges',
    };
    parts.push(`Style: ${options.style}. ${styleHints[options.style]}`);
  }

  if (options?.tileable) {
    parts.push('Must be seamlessly tileable (edges should match)');
  }

  if (existingPalette && existingPalette.length > 0) {
    const materialNames = existingPalette
      .filter((m) => m.id !== 0) // Skip air
      .slice(0, 10)
      .map((m) => `${m.name}(id:${m.id})`)
      .join(', ');
    parts.push(`Available materials for reference: ${materialNames}`);
  }

  return parts.join('\n');
}

/**
 * Builds a user prompt for object generation with context.
 */
export function buildObjectPrompt(
  userDescription: string,
  existingPalette?: Material[],
  options?: {
    maxSize?: [number, number, number];
    detailLevel?: 'low' | 'medium' | 'high';
  }
): string {
  const parts: string[] = [];

  parts.push(`Generate voxel object blueprint for: "${userDescription}"`);

  if (options?.maxSize) {
    const [w, h, d] = options.maxSize;
    parts.push(`Maximum dimensions: ${w}x${h}x${d} voxels`);
  }

  if (options?.detailLevel) {
    const detailHints: Record<string, string> = {
      low: 'Use few large primitives (3-5), simple shapes',
      medium: 'Use moderate primitives (5-10), some detail',
      high: 'Use many primitives (10-20), fine details allowed',
    };
    parts.push(`Detail level: ${options.detailLevel}. ${detailHints[options.detailLevel]}`);
  }

  if (existingPalette && existingPalette.length > 0) {
    const mapping = existingPalette
      .filter((m) => m.id !== 0)
      .slice(0, 15)
      .map((m) => `"${m.name.toLowerCase()}": ${m.id}`)
      .join(', ');
    parts.push(`Use this materialMapping: { ${mapping} }`);
  }

  return parts.join('\n');
}

/**
 * Builds a user prompt for scenario generation with context.
 */
export function buildScenarioPrompt(
  userDescription: string,
  existingPalette?: Material[],
  options?: {
    targetSize?: [number, number];
    depth?: number;
    theme?: string;
  }
): string {
  const parts: string[] = [];

  parts.push(`Generate world/scenario layout for: "${userDescription}"`);

  if (options?.targetSize) {
    const [w, h] = options.targetSize;
    parts.push(`World size: ${w}x${h} grid units`);
  }

  if (options?.depth) {
    parts.push(`Vertical depth: ${options.depth} layers`);
  }

  if (options?.theme) {
    parts.push(`Theme/setting: ${options.theme}`);
  }

  if (existingPalette && existingPalette.length > 0) {
    const materials = existingPalette
      .filter((m) => m.id !== 0)
      .slice(0, 10)
      .map((m) => m.name.toLowerCase())
      .join(', ');
    parts.push(`Available surface materials: ${materials}`);
  }

  return parts.join('\n');
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validates that a parsed object has required TextureParams fields.
 */
export function validateTextureParams(obj: unknown): obj is TextureParams {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;

  return (
    typeof o.baseType === 'string' &&
    typeof o.baseColor === 'number' &&
    o.noise !== null &&
    typeof o.noise === 'object' &&
    o.effects !== null &&
    typeof o.effects === 'object' &&
    o.colorVariation !== null &&
    typeof o.colorVariation === 'object'
  );
}

/**
 * Validates that a parsed object has required ObjectBlueprint fields.
 */
export function validateObjectBlueprint(obj: unknown): obj is ObjectBlueprint {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;

  return (
    typeof o.name === 'string' &&
    Array.isArray(o.bounds) &&
    o.bounds.length === 3 &&
    Array.isArray(o.primitives) &&
    o.materialMapping !== null &&
    typeof o.materialMapping === 'object'
  );
}

/**
 * Validates that a parsed object has required ScenarioLayout fields.
 */
export function validateScenarioLayout(obj: unknown): obj is ScenarioLayout {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;

  return (
    typeof o.name === 'string' &&
    Array.isArray(o.size) &&
    o.size.length === 2 &&
    typeof o.depth === 'number' &&
    Array.isArray(o.biomes) &&
    o.heightmap !== null &&
    typeof o.heightmap === 'object' &&
    typeof o.seed === 'number'
  );
}
