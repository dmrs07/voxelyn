/**
 * Materials module for Noita-like simulation
 * Defines all material types, their properties, and colors
 */

import { makePalette, packRGBA } from "../../packages/voxelyn-core/src/index.js";

// ============================================================================
// MATERIAL DEFINITIONS
// ============================================================================

export const MATERIAL = {
  EMPTY: 0,
  SAND: 1,
  WATER: 2,
  OIL: 3,
  ROCK: 4,
  WOOD: 5,
  FIRE: 6,
  SMOKE: 7,
  ACID: 8,
  STEAM: 9,
  GLASS: 10,
  CERAMIC: 11,
  SILICA: 12,
  PLAYER: 13,
  // New materials for biomes
  DIRT: 14,
  GRASS: 15,
  SNOW: 16,
  ICE: 17,
  LAVA: 18,
  OBSIDIAN: 19,
  FUNGUS: 20,
  COAL: 21,
} as const;

export type MaterialType = (typeof MATERIAL)[keyof typeof MATERIAL];

// ============================================================================
// MATERIAL LABELS
// ============================================================================

export const MATERIAL_LABEL: Record<number, string> = {
  [MATERIAL.SAND]: "Sand",
  [MATERIAL.WATER]: "Water",
  [MATERIAL.OIL]: "Oil",
  [MATERIAL.ROCK]: "Rock",
  [MATERIAL.WOOD]: "Wood",
  [MATERIAL.ACID]: "Acid",
  [MATERIAL.STEAM]: "Steam",
  [MATERIAL.GLASS]: "Glass",
  [MATERIAL.CERAMIC]: "Ceramic",
  [MATERIAL.SILICA]: "Silica",
  [MATERIAL.DIRT]: "Dirt",
  [MATERIAL.GRASS]: "Grass",
  [MATERIAL.SNOW]: "Snow",
  [MATERIAL.ICE]: "Ice",
  [MATERIAL.LAVA]: "Lava",
  [MATERIAL.OBSIDIAN]: "Obsidian",
  [MATERIAL.FUNGUS]: "Fungus",
  [MATERIAL.COAL]: "Coal",
};

// ============================================================================
// MATERIAL PROPERTIES
// ============================================================================

export const IS_SOLID: Record<number, boolean> = {
  [MATERIAL.ROCK]: true,
  [MATERIAL.WOOD]: true,
  [MATERIAL.SILICA]: true,
  [MATERIAL.CERAMIC]: true,
  [MATERIAL.GLASS]: true,
  [MATERIAL.ICE]: true,
  [MATERIAL.OBSIDIAN]: true,
  [MATERIAL.DIRT]: true,
  [MATERIAL.GRASS]: true,
};

export const IS_FLUID: Record<number, boolean> = {
  [MATERIAL.WATER]: true,
  [MATERIAL.OIL]: true,
  [MATERIAL.ACID]: true,
  [MATERIAL.LAVA]: true,
};

export const IS_GAS: Record<number, boolean> = {
  [MATERIAL.SMOKE]: true,
  [MATERIAL.FIRE]: true,
  [MATERIAL.STEAM]: true,
};

export const IS_POWDER: Record<number, boolean> = {
  [MATERIAL.SAND]: true,
  [MATERIAL.SNOW]: true,
  [MATERIAL.COAL]: true,
};

export const IS_FLAMMABLE: Record<number, boolean> = {
  [MATERIAL.WOOD]: true,
  [MATERIAL.OIL]: true,
  [MATERIAL.COAL]: true,
  [MATERIAL.FUNGUS]: true,
  [MATERIAL.GRASS]: true,
};

export const IS_ACID_RESISTANT: Record<number, boolean> = {
  [MATERIAL.ROCK]: true,
  [MATERIAL.SILICA]: true,
  [MATERIAL.CERAMIC]: true,
  [MATERIAL.GLASS]: true,
  [MATERIAL.OBSIDIAN]: true,
  [MATERIAL.PLAYER]: true,
};

// Material density (higher = heavier, sinks below lighter fluids)
export const DENSITY: Record<number, number> = {
  [MATERIAL.EMPTY]: 0,
  [MATERIAL.STEAM]: 1,
  [MATERIAL.SMOKE]: 2,
  [MATERIAL.FIRE]: 3,
  [MATERIAL.OIL]: 40,
  [MATERIAL.WATER]: 50,
  [MATERIAL.ACID]: 55,
  [MATERIAL.LAVA]: 100,
  [MATERIAL.SAND]: 80,
  [MATERIAL.SNOW]: 30,
  [MATERIAL.COAL]: 70,
};

// Viscosity (higher = slower horizontal spread)
export const VISCOSITY: Record<number, number> = {
  [MATERIAL.WATER]: 1,
  [MATERIAL.OIL]: 2,
  [MATERIAL.ACID]: 1,
  [MATERIAL.LAVA]: 8,
};

// ============================================================================
// PALETTE
// ============================================================================

export const createPalette = () => makePalette(256, 0x00000000, [
  [MATERIAL.EMPTY, packRGBA(0, 0, 0, 0)],
  [MATERIAL.SAND, packRGBA(212, 182, 92, 255)],
  [MATERIAL.WATER, packRGBA(40, 100, 210, 200)],
  [MATERIAL.OIL, packRGBA(50, 45, 35, 220)],
  [MATERIAL.ROCK, packRGBA(90, 90, 96, 255)],
  [MATERIAL.WOOD, packRGBA(140, 94, 45, 255)],
  [MATERIAL.FIRE, packRGBA(255, 120, 30, 220)],
  [MATERIAL.SMOKE, packRGBA(110, 110, 110, 120)],
  [MATERIAL.ACID, packRGBA(120, 240, 120, 220)],
  [MATERIAL.STEAM, packRGBA(220, 220, 230, 120)],
  [MATERIAL.GLASS, packRGBA(140, 200, 230, 140)],
  [MATERIAL.CERAMIC, packRGBA(210, 210, 220, 255)],
  [MATERIAL.SILICA, packRGBA(170, 170, 180, 255)],
  [MATERIAL.PLAYER, packRGBA(240, 200, 70, 255)],
  // New biome materials
  [MATERIAL.DIRT, packRGBA(120, 80, 50, 255)],
  [MATERIAL.GRASS, packRGBA(70, 150, 60, 255)],
  [MATERIAL.SNOW, packRGBA(245, 245, 250, 255)],
  [MATERIAL.ICE, packRGBA(180, 220, 250, 255)],
  [MATERIAL.LAVA, packRGBA(255, 90, 0, 255)],
  [MATERIAL.OBSIDIAN, packRGBA(30, 20, 35, 255)],
  [MATERIAL.FUNGUS, packRGBA(180, 120, 200, 255)],
  [MATERIAL.COAL, packRGBA(35, 35, 40, 255)],
]);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export const isSolid = (mat: number): boolean => IS_SOLID[mat] ?? false;
export const isFluid = (mat: number): boolean => IS_FLUID[mat] ?? false;
export const isGas = (mat: number): boolean => IS_GAS[mat] ?? false;
export const isPowder = (mat: number): boolean => IS_POWDER[mat] ?? false;
export const isFlammable = (mat: number): boolean => IS_FLAMMABLE[mat] ?? false;
export const isAcidResistant = (mat: number): boolean => IS_ACID_RESISTANT[mat] ?? false;
export const getDensity = (mat: number): number => DENSITY[mat] ?? 50;
export const getViscosity = (mat: number): number => VISCOSITY[mat] ?? 1;

// Can a material pass through another?
export const canPassThrough = (mat: number): boolean => {
  return mat === MATERIAL.EMPTY || isGas(mat);
};

// Can a heavier material displace a lighter one?
export const canDisplace = (heavyMat: number, lightMat: number): boolean => {
  if (lightMat === MATERIAL.EMPTY) return true;
  if (isGas(lightMat)) return true;
  if (isFluid(heavyMat) && isFluid(lightMat)) {
    return getDensity(heavyMat) > getDensity(lightMat);
  }
  return false;
};
