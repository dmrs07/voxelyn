export type IsoPoint = { sx: number; sy: number };

export function projectIso(
  x: number,
  y: number,
  z: number,
  tileW: number,
  tileH: number,
  zStep: number
): IsoPoint {
  const sx = (x - y) * (tileW >> 1);
  const sy = (x + y) * (tileH >> 1) - z * zStep;
  return { sx, sy };
}

export function forEachIsoOrder(
  mapW: number,
  mapH: number,
  fn: (x: number, y: number, order: number) => void
): void {
  let order = 0;
  const max = mapW + mapH - 2;
  for (let s = 0; s <= max; s++) {
    const xStart = Math.max(0, s - (mapH - 1));
    const xEnd = Math.min(mapW - 1, s);
    for (let x = xStart; x <= xEnd; x++) {
      const y = s - x;
      fn(x, y, order++);
    }
  }
}

export type DrawCommand = {
  key: number;
  draw: () => void;
};

export function sortDrawCommands(commands: DrawCommand[]): void {
  commands.sort((a, b) => a.key - b.key);
}

export function makeDrawKey(x: number, y: number, z: number, layer: number): number {
  return ((x + y) << 16) | ((z & 0xff) << 8) | (layer & 0xff);
}
