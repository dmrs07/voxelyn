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
    colorTop: packRGBA(118, 126, 146),
    colorLeft: packRGBA(88, 95, 112),
    colorRight: packRGBA(72, 79, 94),
    colorFlat: packRGBA(83, 91, 108),
    blocks: true,
  },
  2: {
    id: MATERIAL_FUNGAL_FLOOR,
    name: 'Chao Fungico',
    colorTop: packRGBA(112, 146, 92),
    colorLeft: packRGBA(89, 120, 70),
    colorRight: packRGBA(73, 99, 57),
    colorFlat: packRGBA(95, 126, 79),
    blocks: false,
  },
  3: {
    id: MATERIAL_METAL_ORE,
    name: 'Metal',
    colorTop: packRGBA(123, 143, 170),
    colorLeft: packRGBA(92, 109, 132),
    colorRight: packRGBA(79, 94, 115),
    colorFlat: packRGBA(106, 124, 149),
    blocks: true,
  },
  4: {
    id: MATERIAL_EXIT,
    name: 'Saida',
    colorTop: packRGBA(218, 184, 92),
    colorLeft: packRGBA(187, 151, 66),
    colorRight: packRGBA(165, 130, 51),
    colorFlat: packRGBA(204, 168, 81),
    blocks: false,
  },
  5: {
    id: MATERIAL_ENTRY,
    name: 'Entrada',
    colorTop: packRGBA(96, 202, 218),
    colorLeft: packRGBA(69, 169, 183),
    colorRight: packRGBA(54, 142, 156),
    colorFlat: packRGBA(79, 185, 200),
    blocks: false,
  },
  6: {
    id: MATERIAL_CORE,
    name: 'Nucleo',
    colorTop: packRGBA(225, 82, 255),
    colorLeft: packRGBA(178, 58, 208),
    colorRight: packRGBA(146, 44, 174),
    colorFlat: packRGBA(199, 64, 226),
    blocks: false,
  },
} satisfies Record<MaterialId, MaterialVisual>;

export const isPassableMaterial = (material: number): boolean =>
  PASSABLE_MATERIALS.has((material & 0xffff) as MaterialId);
