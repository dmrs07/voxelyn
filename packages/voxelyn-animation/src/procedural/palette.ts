import { packRGBA } from '@voxelyn/core';

export const proceduralPalette = {
  transparent: packRGBA(0, 0, 0, 0),
  shadow: packRGBA(28, 22, 39, 255),
  playerPrimary: packRGBA(94, 220, 248, 255),
  playerSecondary: packRGBA(45, 113, 160, 255),
  playerAccent: packRGBA(138, 240, 111, 255),
  enemyStalkerPrimary: packRGBA(218, 122, 154, 255),
  enemyBruiserPrimary: packRGBA(207, 107, 86, 255),
  enemySpitterPrimary: packRGBA(231, 175, 89, 255),
  enemyGuardianPrimary: packRGBA(189, 114, 255, 255),
  enemyBomberPrimary: packRGBA(118, 221, 138, 255),
  highlight: packRGBA(233, 246, 255, 255),
  hitTint: packRGBA(255, 180, 180, 255),
  castGlow: packRGBA(144, 231, 255, 255),
};

export type ProceduralPalette = typeof proceduralPalette;
