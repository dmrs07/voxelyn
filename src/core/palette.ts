export type Palette = Uint32Array;

export type PaletteEntry = [index: number, color: number];

export function makePalette(
  size = 256,
  fill = 0x00000000,
  entries: PaletteEntry[] = []
): Palette {
  const pal = new Uint32Array(size);
  pal.fill(fill >>> 0);
  for (let i = 0; i < entries.length; i++) {
    const [idx, color] = entries[i];
    if (idx >= 0 && idx < size) {
      pal[idx] = color >>> 0;
    }
  }
  return pal;
}

// RGBA pack em little-endian (Uint32Array -> Uint8 RGBA em memória)
export function packRGBA(
  r: number,
  g: number,
  b: number,
  a = 255
): number {
  return (
    ((a & 0xff) << 24) |
    ((b & 0xff) << 16) |
    ((g & 0xff) << 8) |
    (r & 0xff)
  ) >>> 0;
}
