import type { AuthoredFacingSet, AuthoredGrid } from './types.js';

export const parseGrid = (raw: string, legend: Record<string, number>): AuthoredGrid =>
  raw.trim().split('\n').map((row) => [...row].map((ch) => legend[ch] ?? 0));

export const mirrorGrid = (grid: AuthoredGrid): AuthoredGrid =>
  grid.map((row) => [...row].reverse());

export const buildFacings = (dr: AuthoredGrid, ur: AuthoredGrid): AuthoredFacingSet => ({
  DR: dr,
  DL: mirrorGrid(dr),
  UR: ur,
  UL: mirrorGrid(ur),
});

export const posesFromFacings = (
  base: string,
  facings: AuthoredFacingSet
): Record<string, AuthoredGrid> => {
  return {
    [`DR:${base}`]: facings.DR,
    [`DL:${base}`]: facings.DL,
    [`UR:${base}`]: facings.UR,
    [`UL:${base}`]: facings.UL,
  };
};
