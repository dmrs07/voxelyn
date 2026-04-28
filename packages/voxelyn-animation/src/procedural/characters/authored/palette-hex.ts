import { packRGBA } from '@voxelyn/core';

const parseHex = (hex: string): number => {
  const clean = hex.startsWith('#') ? hex.slice(1) : hex;
  if (clean.length !== 6) {
    throw new Error(`Cor hex invalida (esperado #rrggbb): ${hex}`);
  }
  const n = Number.parseInt(clean, 16);
  const r = (n >>> 16) & 0xff;
  const g = (n >>> 8) & 0xff;
  const b = n & 0xff;
  return packRGBA(r, g, b, 255);
};

export const buildPalette = (hexes: Array<string | null>): number[] =>
  hexes.map((h) => (h === null ? 0 : parseHex(h)));

export const tintFromHex = (hex: string): number => parseHex(hex);
