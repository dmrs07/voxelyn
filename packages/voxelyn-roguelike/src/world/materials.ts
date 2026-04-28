import { packRGBA } from '@voxelyn/core';
import {
  MATERIAL_AIR,
  MATERIAL_CORE,
  MATERIAL_ENTRY,
  MATERIAL_EXIT,
  MATERIAL_FUNGAL_FLOOR,
  MATERIAL_METAL_ORE,
  MATERIAL_ROCK,
  PASSABLE_MATERIALS,
} from '../game/constants';
import type { MaterialId } from '../game/types';

export type MaterialVisual = {
  id: MaterialId;
  name: string;
  colorTop: number;
  colorLeft: number;
  colorRight: number;
  colorFlat: number;
  blocks: boolean;
};

export const MATERIALS = {
  0: {
    id: MATERIAL_AIR,
    name: 'Ar',
    colorTop: packRGBA(0, 0, 0, 0),
    colorLeft: packRGBA(0, 0, 0, 0),
    colorRight: packRGBA(0, 0, 0, 0),
    colorFlat: packRGBA(0, 0, 0, 0),
    blocks: false,
  },
  1: {
    id: MATERIAL_ROCK,
    name: 'Rocha',
    colorTop: packRGBA(107, 122, 147),
    colorLeft: packRGBA(83, 95, 114),
    colorRight: packRGBA(68, 78, 94),
    colorFlat: packRGBA(91, 103, 124),
    blocks: true,
  },
  2: {
    id: MATERIAL_FUNGAL_FLOOR,
    name: 'Chao Fungico',
    colorTop: packRGBA(78, 138, 90),
    colorLeft: packRGBA(60, 107, 70),
    colorRight: packRGBA(50, 88, 57),
    colorFlat: packRGBA(66, 117, 76),
    blocks: false,
  },
  3: {
    id: MATERIAL_METAL_ORE,
    name: 'Metal',
    colorTop: packRGBA(74, 107, 142),
    colorLeft: packRGBA(57, 83, 110),
    colorRight: packRGBA(47, 68, 90),
    colorFlat: packRGBA(62, 90, 120),
    blocks: true,
  },
  4: {
    id: MATERIAL_EXIT,
    name: 'Saida',
    colorTop: packRGBA(246, 196, 83),
    colorLeft: packRGBA(191, 152, 64),
    colorRight: packRGBA(157, 125, 53),
    colorFlat: packRGBA(209, 166, 70),
    blocks: false,
  },
  5: {
    id: MATERIAL_ENTRY,
    name: 'Entrada',
    colorTop: packRGBA(94, 208, 236),
    colorLeft: packRGBA(73, 162, 184),
    colorRight: packRGBA(60, 133, 151),
    colorFlat: packRGBA(80, 177, 200),
    blocks: false,
  },
  6: {
    id: MATERIAL_CORE,
    name: 'Nucleo',
    colorTop: packRGBA(200, 107, 255),
    colorLeft: packRGBA(156, 83, 199),
    colorRight: packRGBA(128, 68, 163),
    colorFlat: packRGBA(170, 91, 217),
    blocks: false,
  },
} satisfies Record<MaterialId, MaterialVisual>;

export const isPassableMaterial = (material: number): boolean =>
  PASSABLE_MATERIALS.has((material & 0xffff) as MaterialId);
