/**
 * Biome definitions for procedural world generation
 * Each biome specifies terrain generation parameters, material distributions, and themes
 */

import { MATERIAL } from "./materials.js";

// ============================================================================
// BIOME TYPES
// ============================================================================

export type BiomeType = 
  | "cavern"      // Default underground caves
  | "desert"      // Sandy with sandstone
  | "frozen"      // Ice and snow
  | "volcanic"    // Lava and obsidian
  | "fungal"      // Mushroom caves
  | "flooded"     // Water-filled caves
  | "toxic"       // Acid pools
  | "surface";    // Open air with sky

// ============================================================================
// BIOME CONFIGURATION
// ============================================================================

export type BiomeConfig = {
  name: string;
  type: BiomeType;
  
  // Terrain generation parameters
  terrain: {
    /** Primary solid material */
    baseMaterial: number;
    /** Secondary solid material for variety */
    secondaryMaterial: number;
    /** Surface/top layer material */
    surfaceMaterial: number;
    /** Cave fill material (usually empty) */
    caveFill: number;
    
    /** Noise frequency for caves (higher = more detailed caves) */
    caveFrequency: number;
    /** Threshold for cave carving (higher = fewer caves) */
    caveThreshold: number;
    /** Octaves for cave noise */
    caveOctaves: number;
    
    /** Noise frequency for terrain surface */
    surfaceFrequency: number;
    /** Surface height variation in pixels */
    surfaceVariation: number;
  };

  // Fluid pools
  fluids: {
    /** Primary fluid type */
    primaryFluid: number;
    /** Secondary fluid type */
    secondaryFluid: number | null;
    /** Chance of fluid pool spawning (0-1) */
    poolChance: number;
    /** Average pool size */
    poolSize: number;
  };

  // Decorations and features
  features: {
    /** Chance of stalactites/stalagmites */
    stalactiteChance: number;
    /** Chance of material veins */
    veinChance: number;
    /** Vein material */
    veinMaterial: number;
    /** Chance of platforms/bridges */
    platformChance: number;
    /** Platform material */
    platformMaterial: number;
  };

  // Difficulty scaling
  difficulty: {
    /** Base difficulty level (1-10) */
    level: number;
    /** Hazard density multiplier */
    hazardMultiplier: number;
  };
};

// ============================================================================
// BIOME DEFINITIONS
// ============================================================================

export const BIOMES: Record<BiomeType, BiomeConfig> = {
  cavern: {
    name: "Stone Caverns",
    type: "cavern",
    terrain: {
      baseMaterial: MATERIAL.ROCK,
      secondaryMaterial: MATERIAL.DIRT,
      surfaceMaterial: MATERIAL.SAND,
      caveFill: MATERIAL.EMPTY,
      caveFrequency: 0.08,
      caveThreshold: 0.58,
      caveOctaves: 4,
      surfaceFrequency: 0.05,
      surfaceVariation: 12,
    },
    fluids: {
      primaryFluid: MATERIAL.WATER,
      secondaryFluid: MATERIAL.OIL,
      poolChance: 0.3,
      poolSize: 6,
    },
    features: {
      stalactiteChance: 0.08,
      veinChance: 0.02,
      veinMaterial: MATERIAL.COAL,
      platformChance: 0.05,
      platformMaterial: MATERIAL.WOOD,
    },
    difficulty: {
      level: 1,
      hazardMultiplier: 1.0,
    },
  },

  desert: {
    name: "Desert Wastes",
    type: "desert",
    terrain: {
      baseMaterial: MATERIAL.SILICA,
      secondaryMaterial: MATERIAL.ROCK,
      surfaceMaterial: MATERIAL.SAND,
      caveFill: MATERIAL.EMPTY,
      caveFrequency: 0.06,
      caveThreshold: 0.65, // Fewer caves
      caveOctaves: 3,
      surfaceFrequency: 0.03,
      surfaceVariation: 8,
    },
    fluids: {
      primaryFluid: MATERIAL.OIL, // Oil instead of water
      secondaryFluid: null,
      poolChance: 0.15,
      poolSize: 5,
    },
    features: {
      stalactiteChance: 0.03,
      veinChance: 0.04,
      veinMaterial: MATERIAL.GLASS,
      platformChance: 0.02,
      platformMaterial: MATERIAL.CERAMIC,
    },
    difficulty: {
      level: 2,
      hazardMultiplier: 1.2,
    },
  },

  frozen: {
    name: "Frozen Depths",
    type: "frozen",
    terrain: {
      baseMaterial: MATERIAL.ICE,
      secondaryMaterial: MATERIAL.ROCK,
      surfaceMaterial: MATERIAL.SNOW,
      caveFill: MATERIAL.EMPTY,
      caveFrequency: 0.07,
      caveThreshold: 0.60,
      caveOctaves: 4,
      surfaceFrequency: 0.04,
      surfaceVariation: 10,
    },
    fluids: {
      primaryFluid: MATERIAL.WATER,
      secondaryFluid: null,
      poolChance: 0.25,
      poolSize: 8,
    },
    features: {
      stalactiteChance: 0.12, // Ice stalactites
      veinChance: 0.01,
      veinMaterial: MATERIAL.SILICA,
      platformChance: 0.03,
      platformMaterial: MATERIAL.ICE,
    },
    difficulty: {
      level: 3,
      hazardMultiplier: 0.8, // Less hazards but slippery
    },
  },

  volcanic: {
    name: "Volcanic Depths",
    type: "volcanic",
    terrain: {
      baseMaterial: MATERIAL.OBSIDIAN,
      secondaryMaterial: MATERIAL.ROCK,
      surfaceMaterial: MATERIAL.COAL,
      caveFill: MATERIAL.EMPTY,
      caveFrequency: 0.09,
      caveThreshold: 0.55,
      caveOctaves: 5,
      surfaceFrequency: 0.06,
      surfaceVariation: 15,
    },
    fluids: {
      primaryFluid: MATERIAL.LAVA,
      secondaryFluid: MATERIAL.WATER, // Steam interactions!
      poolChance: 0.4,
      poolSize: 7,
    },
    features: {
      stalactiteChance: 0.1,
      veinChance: 0.05,
      veinMaterial: MATERIAL.COAL,
      platformChance: 0.04,
      platformMaterial: MATERIAL.ROCK,
    },
    difficulty: {
      level: 5,
      hazardMultiplier: 1.8,
    },
  },

  fungal: {
    name: "Fungal Caverns",
    type: "fungal",
    terrain: {
      baseMaterial: MATERIAL.DIRT,
      secondaryMaterial: MATERIAL.ROCK,
      surfaceMaterial: MATERIAL.FUNGUS,
      caveFill: MATERIAL.EMPTY,
      caveFrequency: 0.1,
      caveThreshold: 0.52, // Many caves
      caveOctaves: 4,
      surfaceFrequency: 0.08,
      surfaceVariation: 14,
    },
    fluids: {
      primaryFluid: MATERIAL.WATER,
      secondaryFluid: MATERIAL.ACID,
      poolChance: 0.35,
      poolSize: 5,
    },
    features: {
      stalactiteChance: 0.15,
      veinChance: 0.08,
      veinMaterial: MATERIAL.FUNGUS,
      platformChance: 0.08,
      platformMaterial: MATERIAL.WOOD,
    },
    difficulty: {
      level: 4,
      hazardMultiplier: 1.4,
    },
  },

  flooded: {
    name: "Flooded Caves",
    type: "flooded",
    terrain: {
      baseMaterial: MATERIAL.ROCK,
      secondaryMaterial: MATERIAL.DIRT,
      surfaceMaterial: MATERIAL.SAND,
      caveFill: MATERIAL.WATER, // Caves filled with water!
      caveFrequency: 0.07,
      caveThreshold: 0.60,
      caveOctaves: 4,
      surfaceFrequency: 0.04,
      surfaceVariation: 10,
    },
    fluids: {
      primaryFluid: MATERIAL.WATER,
      secondaryFluid: null,
      poolChance: 0.6, // Many pools
      poolSize: 10,
    },
    features: {
      stalactiteChance: 0.06,
      veinChance: 0.02,
      veinMaterial: MATERIAL.CERAMIC,
      platformChance: 0.06,
      platformMaterial: MATERIAL.WOOD,
    },
    difficulty: {
      level: 3,
      hazardMultiplier: 1.0,
    },
  },

  toxic: {
    name: "Toxic Depths",
    type: "toxic",
    terrain: {
      baseMaterial: MATERIAL.CERAMIC, // Acid resistant
      secondaryMaterial: MATERIAL.GLASS,
      surfaceMaterial: MATERIAL.SILICA,
      caveFill: MATERIAL.EMPTY,
      caveFrequency: 0.08,
      caveThreshold: 0.56,
      caveOctaves: 4,
      surfaceFrequency: 0.05,
      surfaceVariation: 12,
    },
    fluids: {
      primaryFluid: MATERIAL.ACID,
      secondaryFluid: MATERIAL.WATER,
      poolChance: 0.45,
      poolSize: 6,
    },
    features: {
      stalactiteChance: 0.05,
      veinChance: 0.03,
      veinMaterial: MATERIAL.GLASS,
      platformChance: 0.04,
      platformMaterial: MATERIAL.CERAMIC,
    },
    difficulty: {
      level: 6,
      hazardMultiplier: 2.0,
    },
  },

  surface: {
    name: "Surface",
    type: "surface",
    terrain: {
      baseMaterial: MATERIAL.ROCK,
      secondaryMaterial: MATERIAL.DIRT,
      surfaceMaterial: MATERIAL.GRASS,
      caveFill: MATERIAL.EMPTY,
      caveFrequency: 0.05,
      caveThreshold: 0.70, // Fewer caves on surface
      caveOctaves: 3,
      surfaceFrequency: 0.03,
      surfaceVariation: 20, // More rolling hills
    },
    fluids: {
      primaryFluid: MATERIAL.WATER,
      secondaryFluid: null,
      poolChance: 0.2,
      poolSize: 8,
    },
    features: {
      stalactiteChance: 0,
      veinChance: 0.01,
      veinMaterial: MATERIAL.COAL,
      platformChance: 0.03,
      platformMaterial: MATERIAL.WOOD,
    },
    difficulty: {
      level: 1,
      hazardMultiplier: 0.5,
    },
  },
};

// ============================================================================
// BIOME SELECTION
// ============================================================================

/**
 * Select a biome based on depth and random seed
 * Deeper = harder biomes
 */
export function selectBiomeByDepth(depth: number, seed: number): BiomeType {
  // Pseudo-random based on depth and seed
  const hash = ((depth * 127 + seed * 311) % 1000) / 1000;

  if (depth < 0.2) {
    return "surface";
  } else if (depth < 0.4) {
    return hash < 0.5 ? "cavern" : "desert";
  } else if (depth < 0.6) {
    return hash < 0.33 ? "frozen" : hash < 0.66 ? "fungal" : "flooded";
  } else if (depth < 0.8) {
    return hash < 0.5 ? "toxic" : "volcanic";
  } else {
    return "volcanic";
  }
}

/**
 * Get a random biome for variety
 */
export function getRandomBiome(seed: number): BiomeType {
  const types: BiomeType[] = Object.keys(BIOMES) as BiomeType[];
  const index = Math.abs(seed) % types.length;
  return types[index]!;
}

/**
 * Blend two biome configs for smooth transitions
 */
export function blendBiomes(a: BiomeConfig, b: BiomeConfig, t: number): BiomeConfig {
  // For now, just pick based on threshold
  // In future, could interpolate noise parameters
  return t < 0.5 ? a : b;
}
