import type { AnimationFacing } from '../types.js';

export type Direction = 'DR' | 'DL' | 'UR' | 'UL';

export const DIRECTIONS: readonly Direction[] = ['DR', 'DL', 'UR', 'UL'];

const FACING_BY_DIRECTION: Record<Direction, AnimationFacing> = {
  DR: 'dr',
  DL: 'dl',
  UR: 'ur',
  UL: 'ul',
};

export const toEngineFacing = (direction: Direction): AnimationFacing =>
  FACING_BY_DIRECTION[direction];
