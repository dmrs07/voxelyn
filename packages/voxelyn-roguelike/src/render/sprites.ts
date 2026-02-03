import { packRGBA } from '@voxelyn/core';
import type { EnemyArchetype } from '../game/types';

export const COLORS = {
  bgTop: packRGBA(9, 13, 24),
  bgBottom: packRGBA(5, 8, 14),
  hudBg: packRGBA(14, 22, 36, 220),
  text: packRGBA(230, 236, 255),
  player: packRGBA(94, 220, 248),
  healthBarBg: packRGBA(46, 48, 68),
  healthBarFill: packRGBA(110, 226, 138),
  overlay: packRGBA(8, 10, 18, 180),
  menuCard: packRGBA(24, 33, 52, 235),
  menuAccent: packRGBA(96, 166, 255),
} as const;

export const ENEMY_COLORS: Record<EnemyArchetype, number> = {
  stalker: packRGBA(222, 108, 138),
  bruiser: packRGBA(205, 86, 70),
  spitter: packRGBA(236, 176, 90),
  guardian: packRGBA(196, 94, 255),
};

export const shadeColor = (color: number, delta: number): number => {
  const r = Math.max(0, Math.min(255, (color & 0xff) + delta));
  const g = Math.max(0, Math.min(255, ((color >> 8) & 0xff) + delta));
  const b = Math.max(0, Math.min(255, ((color >> 16) & 0xff) + delta));
  const a = (color >> 24) & 0xff;
  return packRGBA(r, g, b, a);
};
