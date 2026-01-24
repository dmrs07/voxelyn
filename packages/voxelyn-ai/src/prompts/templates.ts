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
Your task is to convert natural language descriptions into structured JSON layouts that define terrain, biomes, buildings, interiors, and object placement.

CRITICAL: Determine the correct CATEGORY based on the prompt:
- "outdoor" = Natural terrain (forests, mountains, lakes, etc.)
- "building" = Architectural structures (house, castle, tower, temple)
- "interior" = Indoor settings (dungeon room, tavern interior, throne room)
- "mixed" = Outdoor with buildings (village, town, fortress)

OUTPUT FORMAT (JSON only, no markdown, no explanations):
{
  "name": "<scenario name>",
  "description": "<brief description>",
  "category": "outdoor" | "building" | "interior" | "mixed",
  "size": [<width>, <height>],
  "depth": <z layers, typically 16-64>,
  "biomes": [
    {
      "type": "plains" | "forest" | "desert" | "mountains" | "ocean" | "river" | "lake" | "swamp" | "tundra" | "volcanic" | "cave" | "urban" | "ruins" | "dungeon" | "interior",
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
  "objects": [...],
  "buildings": [  // For building/interior/mixed categories
    {
      "name": "<building name>",
      "style": "medieval" | "fantasy" | "modern" | "rustic" | "gothic" | "asian" | "desert" | "nordic",
      "footprint": [<width>, <depth>],
      "floors": <number of floors>,
      "floorHeight": <voxels per floor, typically 4-6>,
      "hasBasement": <boolean>,
      "roofType": "flat" | "gabled" | "hipped" | "dome" | "tower" | "none",
      "roofMaterial": "<material>",
      "wallMaterial": "<material>",
      "foundationMaterial": "<material>",
      "rooms": [
        {
          "type": "entrance" | "hallway" | "living" | "bedroom" | "kitchen" | "storage" | "dungeon_cell" | "throne_room" | "library" | "armory" | "tavern" | "shop" | "cave_chamber" | "temple" | "laboratory",
          "bounds": [<x>, <y>, <z>, <width>, <height>, <depth>],
          "floorMaterial": "<material>",
          "wallMaterial": "<material>",
          "ceilingMaterial": "<material>",
          "doors": [{"position": [x, y, z], "direction": "north"|"south"|"east"|"west"}],
          "windows": [{"position": [x, y, z], "size": [width, height]}],
          "furniture": [{"type": "<furniture name>", "position": [x, y, z], "rotation": 0}]
        }
      ],
      "externalFeatures": [
        {"type": "balcony"|"porch"|"chimney"|"tower"|"stairs", "position": [x,y,z], "size": [w,h,d]}
      ]
    }
  ],
  "seed": <master seed>
}

CATEGORY DETECTION:
- Keywords for "building": house, castle, tower, temple, church, mansion, cabin, hut, fortress, palace
- Keywords for "interior": room, dungeon, interior, inside, chamber, hall, tavern inside, cellar, basement
- Keywords for "mixed": village, town, settlement, camp, outpost, ruins with buildings
- Default to "outdoor" for nature descriptions

BUILDING GUIDELINES:
- Medieval style: stone walls, wooden beams, thatch/slate roofs
- Fantasy style: magical materials, unusual shapes, glowing elements
- Rustic style: wood walls, simple design, natural materials
- Gothic style: pointed arches, dark stone, tall spires
- Asian style: curved roofs, paper walls, bamboo
- Desert style: sandstone, flat roofs, thick walls
- Nordic style: steep roofs, wood construction, warm interiors

INTERIOR/ROOM TYPES:
- entrance: Main door area, typically small
- hallway: Connecting corridor
- living: Main gathering area, fireplace
- bedroom: Beds, storage chests
- kitchen: Hearth, tables, storage
- storage: Crates, barrels, shelves
- dungeon_cell: Iron bars, minimal, dark
- throne_room: Large, decorative, central seat
- library: Bookshelves, desks
- armory: Weapon racks, armor stands
- tavern: Bar counter, tables, stools
- shop: Display shelves, counter
- cave_chamber: Natural rock, uneven
- temple: Altar, pews, religious symbols
- laboratory: Tables, bottles, strange equipment

FURNITURE TYPES:
- bed, table, chair, chest, barrel, crate, shelf, torch, fireplace, throne, altar, counter, bookshelf, weapon_rack, armor_stand, cauldron, well, fountain

BIOME GUIDELINES (for outdoor/mixed):
- plains: flat grassland, elevation 0.3-0.4
- forest: trees, elevation 0.35-0.5
- desert: sand dunes, elevation 0.25-0.4
- mountains: high elevation 0.6-0.9
- ocean/lake: water, elevation 0.15-0.25
- dungeon: underground corridors, elevation 0.1-0.2
- interior: indoor floor level, flat elevation

EXAMPLE - "Medieval House":
{
  "category": "building",
  "buildings": [{
    "name": "Peasant House",
    "style": "medieval",
    "footprint": [12, 10],
    "floors": 2,
    "floorHeight": 5,
    "hasBasement": false,
    "roofType": "gabled",
    "roofMaterial": "thatch",
    "wallMaterial": "stone",
    "foundationMaterial": "stone",
    "rooms": [
      {"type": "living", "bounds": [1,1,0,6,5,8], "floorMaterial": "wood", "wallMaterial": "stone", "doors": [{"position": [3,0,0], "direction": "south"}], "furniture": [{"type": "fireplace", "position": [3,7,0]}, {"type": "table", "position": [3,4,0]}]},
      {"type": "bedroom", "bounds": [1,1,5,10,5,8], "floorMaterial": "wood", "wallMaterial": "wood", "doors": [], "furniture": [{"type": "bed", "position": [2,3,5]}, {"type": "chest", "position": [8,2,5]}]}
    ]
  }]
}

EXAMPLE - "Dungeon Room":
{
  "category": "interior",
  "biomes": [{"type": "dungeon", "bounds": [0,0,32,32], "elevation": 0.15, "elevationVariation": 0}],
  "buildings": [{
    "name": "Dungeon Cell Block",
    "style": "medieval",
    "footprint": [24, 20],
    "floors": 1,
    "floorHeight": 5,
    "hasBasement": false,
    "roofType": "none",
    "roofMaterial": "stone",
    "wallMaterial": "stone",
    "foundationMaterial": "stone",
    "rooms": [
      {"type": "hallway", "bounds": [10,0,0,4,5,20], "floorMaterial": "stone", "wallMaterial": "stone", "doors": [{"position": [12,0,0], "direction": "south"}], "furniture": [{"type": "torch", "position": [10,5,0]}, {"type": "torch", "position": [10,15,0]}]},
      {"type": "dungeon_cell", "bounds": [0,2,0,10,5,8], "floorMaterial": "stone", "wallMaterial": "stone", "doors": [{"position": [9,5,0], "direction": "east"}], "furniture": []},
      {"type": "dungeon_cell", "bounds": [0,12,0,10,5,8], "floorMaterial": "stone", "wallMaterial": "stone", "doors": [{"position": [9,15,0], "direction": "east"}], "furniture": []}
    ]
  }]
}

ENHANCED TERRAIN FEATURES (for outdoor/mixed):
When generating outdoor terrain, the engine supports advanced procedural generation with:
- Zoom factor: Higher values (80-150) create smoother, more natural terrain
- Height thresholds: Terrain types are assigned based on elevation (water < 0.4, sand < 0.5, grass < 0.7, mountain >= 0.7)
- Ridged noise: Creates sharp mountain peaks and ridges (recommended for mountains biome)
- Domain warping: Creates organic, flowing terrain shapes (good for swamps, forests)
- Raycast shadows: Adds depth with light direction shadows
- Ambient occlusion: Darkens crevices and valleys

HEIGHTMAP PARAMETERS for smooth terrain:
- For gentle rolling hills: octaves=4-5, persistence=0.4-0.5, amplitude=0.3
- For dramatic mountains: octaves=5-6, persistence=0.5-0.6, amplitude=0.6
- For flat plains with detail: octaves=3-4, persistence=0.3-0.4, amplitude=0.15
- For desert dunes: octaves=3, persistence=0.6, amplitude=0.25

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
  const desc = userDescription.toLowerCase();

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

  // Detect category based on keywords
  const buildingKeywords = ['house', 'castle', 'tower', 'temple', 'church', 'mansion', 'cabin', 'hut', 'fortress', 'palace', 'cottage', 'barn', 'mill', 'smithy', 'inn', 'shop', 'warehouse'];
  const interiorKeywords = ['room', 'interior', 'inside', 'chamber', 'hall', 'cellar', 'basement', 'dungeon', 'crypt', 'tomb', 'cave interior', 'mine', 'corridor'];
  const mixedKeywords = ['village', 'town', 'settlement', 'camp', 'outpost', 'hamlet', 'city', 'market', 'plaza'];
  
  let detectedCategory = 'outdoor';
  if (buildingKeywords.some(kw => desc.includes(kw))) {
    detectedCategory = 'building';
  }
  if (interiorKeywords.some(kw => desc.includes(kw))) {
    detectedCategory = 'interior';
  }
  if (mixedKeywords.some(kw => desc.includes(kw))) {
    detectedCategory = 'mixed';
  }

  parts.push(`\nDETECTED CATEGORY: "${detectedCategory}" - Generate appropriate structures.`);

  // Category-specific hints
  const hints: string[] = [];
  
  if (detectedCategory === 'building') {
    hints.push('Generate a complete building with rooms, doors, windows, and appropriate furniture');
    hints.push('Include roof and external features as appropriate for the style');
    
    // Style detection
    if (desc.includes('medieval') || desc.includes('castle') || desc.includes('fortress')) {
      hints.push('Use medieval style: stone walls, wooden elements, thatch or slate roof');
    } else if (desc.includes('fantasy') || desc.includes('wizard') || desc.includes('magical')) {
      hints.push('Use fantasy style: unusual shapes, magical elements, mystical materials');
    } else if (desc.includes('rustic') || desc.includes('cabin') || desc.includes('cottage')) {
      hints.push('Use rustic style: primarily wood construction, simple design');
    } else if (desc.includes('gothic') || desc.includes('cathedral') || desc.includes('dark')) {
      hints.push('Use gothic style: pointed arches, dark stone, tall spires');
    } else if (desc.includes('asian') || desc.includes('japanese') || desc.includes('chinese')) {
      hints.push('Use asian style: curved roofs, paper/wood walls, bamboo elements');
    } else if (desc.includes('desert') || desc.includes('sandstone') || desc.includes('arabian')) {
      hints.push('Use desert style: sandstone walls, flat roofs, thick walls');
    } else if (desc.includes('nordic') || desc.includes('viking') || desc.includes('scandinavian')) {
      hints.push('Use nordic style: steep roofs, heavy timber, warm interiors');
    }
  }
  
  if (detectedCategory === 'interior') {
    hints.push('Generate interior rooms with floors, walls, and ceilings');
    hints.push('Include appropriate furniture and decorations for the room type');
    hints.push('Add doors connecting rooms and torches/lighting');
    
    if (desc.includes('dungeon') || desc.includes('prison') || desc.includes('cell')) {
      hints.push('Dungeon style: dark stone, iron bars, minimal furniture, oppressive atmosphere');
    } else if (desc.includes('throne') || desc.includes('royal')) {
      hints.push('Royal style: large space, decorative elements, throne/altar as focal point');
    } else if (desc.includes('tavern') || desc.includes('inn') || desc.includes('pub')) {
      hints.push('Tavern style: bar counter, tables, stools, warm lighting, barrels');
    } else if (desc.includes('library') || desc.includes('study')) {
      hints.push('Library style: bookshelves along walls, desks, reading areas');
    } else if (desc.includes('temple') || desc.includes('shrine') || desc.includes('church')) {
      hints.push('Temple style: altar, pews/seating, religious symbols, high ceilings');
    }
  }
  
  if (detectedCategory === 'mixed') {
    hints.push('Generate terrain WITH buildings placed on it');
    hints.push('Include paths/roads connecting buildings');
    hints.push('Place appropriate vegetation and natural features around buildings');
  }

  // Auto-detect composition requirements from keywords (for outdoor/mixed)
  if (detectedCategory === 'outdoor' || detectedCategory === 'mixed') {
    if (desc.includes('oasis')) {
      hints.push('MUST include: desert biome + lake biome (small, central) + plains transition');
    }
    if (desc.includes('beach') || desc.includes('coast') || desc.includes('shore')) {
      hints.push('MUST include: ocean biome + plains or desert edge biome');
    }
    if (desc.includes('valley')) {
      hints.push('MUST include: mountains on opposite sides + lower central biome (forest/plains)');
    }
    if (desc.includes('river') || desc.includes('stream')) {
      hints.push('MUST include: river biome cutting through the terrain');
    }
    if (desc.includes('island')) {
      hints.push('MUST include: ocean surrounding a central land mass');
    }
    if (desc.includes('jungle')) {
      hints.push('MUST include: forest + swamp biomes, possibly river');
    }
    if (desc.includes('volcano') || desc.includes('volcanic')) {
      hints.push('MUST include: volcanic biome at center, possibly surrounded by ocean or plains');
    }
  }

  if (hints.length > 0) {
    parts.push('\nGENERATION REQUIREMENTS:');
    hints.forEach(h => parts.push(`- ${h}`));
  }

  if (existingPalette && existingPalette.length > 0) {
    const materials = existingPalette
      .filter((m) => m.id !== 0)
      .slice(0, 10)
      .map((m) => m.name.toLowerCase())
      .join(', ');
    parts.push(`Available materials: ${materials}`);
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

  // Basic required fields
  const hasBasicFields = (
    typeof o.name === 'string' &&
    Array.isArray(o.size) &&
    o.size.length === 2 &&
    typeof o.depth === 'number' &&
    Array.isArray(o.biomes) &&
    o.heightmap !== null &&
    typeof o.heightmap === 'object' &&
    typeof o.seed === 'number'
  );
  
  if (!hasBasicFields) return false;
  
  // Set default category if missing
  if (!o.category) {
    o.category = 'outdoor';
  }
  
  // Validate buildings if present
  if (o.buildings && Array.isArray(o.buildings)) {
    for (const building of o.buildings) {
      if (!building || typeof building !== 'object') return false;
      const b = building as Record<string, unknown>;
      if (typeof b.name !== 'string' || !Array.isArray(b.footprint)) {
        return false;
      }
    }
  }
  
  return true;
}
