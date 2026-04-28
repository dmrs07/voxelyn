import { buildPalette, tintFromHex } from './palette-hex.js';
import type { AuthoredClipId, AuthoredGrid, AuthoredSpriteDef, AuthoredState } from './types.js';

const SIZE = 32;
const FACINGS = ['DR', 'DL', 'UR', 'UL'] as const;
const POSES = [
  'idle_a',
  'idle_b',
  'walk_a',
  'walk_b',
  'atk_wind',
  'atk_strike',
  'hit',
  'die',
] as const;

type Facing = (typeof FACINGS)[number];
type Pose = (typeof POSES)[number];
type SpriteKind = 'hero' | 'stalker' | 'bruiser' | 'spitter' | 'bomber' | 'guardian';

type Dir = {
  x: -1 | 1;
  y: -1 | 1;
};

type SpriteColors = {
  edge: number;
  dark: number;
  mid: number;
  light: number;
  top: number;
  accent: number;
  glow: number;
  face: number;
  shine: number;
  hit: number;
};

type SpriteSpec = {
  name: string;
  id: string;
  kind: SpriteKind;
  palette: number[];
  colors: SpriteColors;
  hitTint: number;
};

type Point = {
  x: number;
  y: number;
};

const DIR: Record<Facing, Dir> = {
  DR: { x: 1, y: 1 },
  DL: { x: -1, y: 1 },
  UR: { x: 1, y: -1 },
  UL: { x: -1, y: -1 },
};

const TINT_WHITE = tintFromHex('#ffffff');
const TINT_BLOOD = tintFromHex('#e04f5f');
const TINT_STALKER = tintFromHex('#e04f5f');
const TINT_BRUISER = tintFromHex('#b56aff');
const TINT_SPITTER = tintFromHex('#6fe19a');
const TINT_BOMBER = tintFromHex('#f6c453');
const TINT_GUARDIAN = tintFromHex('#c86bff');

const blank = (): AuthoredGrid =>
  Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => 0));

const put = (grid: AuthoredGrid, x: number, y: number, color: number): void => {
  const px = Math.round(x);
  const py = Math.round(y);
  if (color !== 0 && px >= 0 && px < SIZE && py >= 0 && py < SIZE) {
    grid[py]![px] = color;
  }
};

const dot = (grid: AuthoredGrid, x: number, y: number, color: number, radius = 0): void => {
  const px = Math.round(x);
  const py = Math.round(y);
  for (let yy = -radius; yy <= radius; yy += 1) {
    for (let xx = -radius; xx <= radius; xx += 1) {
      if (Math.abs(xx) + Math.abs(yy) <= radius + 0.1) {
        put(grid, px + xx, py + yy, color);
      }
    }
  }
};

const line = (
  grid: AuthoredGrid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: number,
  thick = 0,
): void => {
  const steps = Math.max(Math.ceil(Math.abs(x1 - x0)), Math.ceil(Math.abs(y1 - y0)), 1);
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    dot(grid, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, color, thick);
  }
};

const flatDiamond = (
  grid: AuthoredGrid,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fill: number,
  edge = fill,
): void => {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const n = Math.abs((x - cx) / rx) + Math.abs((y - cy) / ry);
      if (n <= 1.02) put(grid, x, y, n > 0.72 ? edge : fill);
    }
  }
};

const diamondRing = (
  grid: AuthoredGrid,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: number,
): void => {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const n = Math.abs((x - cx) / rx) + Math.abs((y - cy) / ry);
      if (n >= 0.78 && n <= 1.05) put(grid, x, y, color);
    }
  }
};

const rect = (
  grid: AuthoredGrid,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number,
  edge = fill,
): void => {
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  const x1 = Math.round(x + w);
  const y1 = Math.round(y + h);
  for (let yy = y0; yy < y1; yy += 1) {
    for (let xx = x0; xx < x1; xx += 1) {
      const isEdge = yy === y0 || yy === y1 - 1 || xx === x0 || xx === x1 - 1;
      put(grid, xx, yy, isEdge ? edge : fill);
    }
  }
};

const oval = (
  grid: AuthoredGrid,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fill: number,
  edge = fill,
): void => {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const nx = (x - cx) / Math.max(1, rx);
      const ny = (y - cy) / Math.max(1, ry);
      const n = nx * nx + ny * ny;
      if (n <= 1.08) put(grid, x, y, n > 0.72 ? edge : fill);
    }
  }
};

const drawBoot = (
  grid: AuthoredGrid,
  x: number,
  y: number,
  colors: SpriteColors,
  dir: Dir,
  bright = false,
): void => {
  const sole = bright ? colors.mid : colors.dark;
  flatDiamond(grid, x, y, 3, 1.25, sole, colors.edge);
  dot(grid, x + dir.x, y - 1, bright ? colors.light : colors.mid, 0);
};

const facetedDiamond = (
  grid: AuthoredGrid,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  colors: SpriteColors,
  dir: Dir,
  opts: Partial<Pick<SpriteColors, 'edge' | 'top' | 'dark'>> & {
    left?: number;
    right?: number;
    front?: number;
  } = {},
): void => {
  const edge = opts.edge ?? colors.edge;
  const top = opts.top ?? colors.light;
  const left = opts.left ?? colors.mid;
  const right = opts.right ?? colors.light;
  const front = opts.front ?? colors.dark;

  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const n = Math.abs((x - cx) / rx) + Math.abs((y - cy) / ry);
      if (n > 1.02) continue;
      let color = edge;
      if (n <= 0.82) {
        if (y < cy - ry * 0.28) color = top;
        else if (y > cy + ry * 0.34) color = front;
        else color = (dir.x > 0 ? x >= cx : x <= cx) ? right : left;
      }
      put(grid, x, y, color);
    }
  }
};

const drawLegs = (
  grid: AuthoredGrid,
  cx: number,
  hipY: number,
  baseY: number,
  colors: SpriteColors,
  dir: Dir,
  pose: Pose,
  size = 1,
): void => {
  const walk = pose === 'walk_a' ? 1 : pose === 'walk_b' ? -1 : 0;
  const stride = 1.8 * size;
  const front: Point = {
    x: cx + dir.x * (2.5 + walk * stride),
    y: baseY + (dir.y > 0 ? 1 : -2) + walk * dir.y,
  };
  const back: Point = {
    x: cx - dir.x * (2.5 - walk * stride),
    y: baseY - (dir.y > 0 ? 2 : 0) - walk * dir.y,
  };

  const thick = size > 1 ? 1 : 0;
  line(grid, cx - dir.x * 2, hipY, back.x, back.y, colors.dark, thick);
  line(grid, cx - dir.x * 1, hipY + 1, back.x, back.y - 1, colors.edge, 0);
  line(grid, cx + dir.x * 2, hipY, front.x, front.y, colors.mid, thick);
  line(grid, cx + dir.x * 1, hipY + 1, front.x, front.y - 1, colors.light, 0);
  drawBoot(grid, back.x, back.y, colors, dir);
  drawBoot(grid, front.x, front.y, colors, dir, true);
};

const drawFace = (
  grid: AuthoredGrid,
  cx: number,
  cy: number,
  colors: SpriteColors,
  dir: Dir,
  mode: 'visor' | 'eyes' = 'visor',
): void => {
  if (dir.y < 0) {
    line(grid, cx - dir.x * 4, cy - 1, cx + dir.x * 3, cy - 2, colors.top, 0);
    line(grid, cx - dir.x * 3, cy + 1, cx + dir.x * 2, cy, colors.dark, 0);
    dot(grid, cx - dir.x * 4, cy + 1, colors.glow, 0);
    return;
  }

  if (mode === 'eyes') {
    dot(grid, cx + dir.x * 1.5, cy, colors.glow, 0);
    dot(grid, cx + dir.x * 3.5, cy + 1, colors.glow, 0);
    dot(grid, cx + dir.x * 2.5, cy + 1, colors.face, 0);
    return;
  }

  line(grid, cx - dir.x * 2, cy, cx + dir.x * 4, cy + 1, colors.face, 0);
  line(grid, cx - dir.x, cy - 1, cx + dir.x * 3, cy, colors.shine, 0);
  dot(grid, cx + dir.x * 4, cy + 1, colors.glow, 0);
};

const drawHitMarks = (
  grid: AuthoredGrid,
  cx: number,
  cy: number,
  colors: SpriteColors,
  dir: Dir,
): void => {
  line(grid, cx - dir.x * 5, cy - 4, cx + dir.x * 4, cy + 1, colors.hit, 0);
  line(grid, cx + dir.x * 2, cy - 5, cx - dir.x * 3, cy + 3, colors.shine, 0);
};

const drawDowned = (grid: AuthoredGrid, kind: SpriteKind, colors: SpriteColors, dir: Dir): void => {
  if (kind === 'bomber') {
    flatDiamond(grid, 16, 25, 10, 4, colors.dark, colors.edge);
    flatDiamond(grid, 16 + dir.x * 2, 23, 5, 2, colors.accent, colors.edge);
    return;
  }

  if (kind === 'guardian') {
    diamondRing(grid, 16, 22, 12, 6, colors.glow);
    flatDiamond(grid, 16, 24, 10, 4, colors.mid, colors.edge);
    flatDiamond(grid, 16 + dir.x * 3, 22, 4, 2, colors.accent, colors.glow);
    return;
  }

  flatDiamond(
    grid,
    15,
    25,
    kind === 'bruiser' ? 12 : 9,
    kind === 'bruiser' ? 4 : 3,
    colors.mid,
    colors.edge,
  );
  flatDiamond(grid, 18 + dir.x * 2, 22, kind === 'bruiser' ? 7 : 5, 3, colors.light, colors.edge);
  if (kind === 'hero') line(grid, 21 + dir.x * 2, 22, 28, 20 + dir.y, colors.accent, 0);
};

const drawHero = (grid: AuthoredGrid, dir: Dir, pose: Pose, colors: SpriteColors): void => {
  if (pose === 'die') {
    drawDowned(grid, 'hero', colors, dir);
    return;
  }

  const bob = pose === 'idle_b' ? -1 : 0;
  const lean = pose === 'atk_strike' ? 2 : pose === 'atk_wind' ? -1 : 0;
  const cx = 16 + dir.x * lean;
  const bodyY = 18 + bob;
  const headY = bodyY - 8;

  flatDiamond(grid, cx, 30 + bob, 9, 2, colors.edge, colors.edge);
  drawLegs(grid, cx, 23 + bob, 29 + bob, colors, dir, pose);

  // Backpack / far shoulder, visible on all facings.
  flatDiamond(grid, cx - dir.x * 5, bodyY - 2, 3, 4, colors.dark, colors.edge);
  dot(grid, cx - dir.x * 6, bodyY - 4, colors.glow, 0);

  facetedDiamond(grid, cx, bodyY, 6, 6.5, colors, dir, {
    top: colors.light,
    left: colors.mid,
    right: colors.light,
    front: colors.dark,
  });
  line(grid, cx - 5, bodyY, cx + 5, bodyY, colors.edge, 0);
  line(grid, cx - 5, bodyY + 2, cx + 5, bodyY + 2, colors.accent, 1);
  dot(grid, cx + dir.x * 4, bodyY - 2, colors.glow, 0);

  oval(grid, cx + dir.x, headY, 5, 4, colors.light, colors.edge);
  facetedDiamond(grid, cx + dir.x, headY, 5, 4, colors, dir, {
    top: colors.top,
    left: colors.mid,
    right: colors.light,
    front: colors.dark,
  });
  drawFace(grid, cx + dir.x, headY, colors, dir);
  flatDiamond(grid, cx + dir.x * 3, headY - 6, 2, 1, colors.glow, colors.face);
  dot(grid, cx + dir.x * 4, headY - 5, colors.glow, 0);

  const shoulderY = bodyY - 1;
  if (pose === 'atk_wind') {
    line(grid, cx + dir.x * 2, shoulderY, cx - dir.x * 8, shoulderY - 2, colors.dark, 1);
    flatDiamond(grid, cx - dir.x * 9, shoulderY - 2, 2.5, 2, colors.accent, colors.edge);
  } else {
    const reach = pose === 'atk_strike' ? 13 : 7;
    const handX = cx + dir.x * reach;
    const handY = shoulderY + dir.y * (pose === 'atk_strike' ? 3 : 1);
    line(grid, cx + dir.x * 4, shoulderY, handX, handY, colors.accent, 1);
    dot(grid, handX, handY, colors.light, 0);
    if (pose === 'atk_strike') {
      line(grid, handX, handY, handX + dir.x * 6, handY + dir.y * 2, colors.shine, 1);
      line(
        grid,
        handX - dir.x,
        handY - 1,
        handX + dir.x * 5,
        handY + dir.y * 2 - 1,
        colors.glow,
        0,
      );
    }
  }

  if (pose === 'hit') drawHitMarks(grid, cx, bodyY, colors, dir);
};

const drawStalker = (grid: AuthoredGrid, dir: Dir, pose: Pose, colors: SpriteColors): void => {
  if (pose === 'die') {
    drawDowned(grid, 'stalker', colors, dir);
    return;
  }

  const crouch = pose === 'atk_wind' ? 1 : 0;
  const lean = pose === 'atk_strike' ? 3 : pose === 'atk_wind' ? -2 : 0;
  const cx = 16 + dir.x * lean;
  const bodyY = 20 + crouch;

  flatDiamond(grid, cx, 30, 9, 2, colors.edge, colors.edge);
  drawLegs(grid, cx, 23, 29, colors, dir, pose);
  line(grid, cx - dir.x * 3, bodyY + 1, cx - dir.x * 8, bodyY + 5, colors.edge, 1);
  line(grid, cx - dir.x * 3, bodyY + 1, cx - dir.x * 8, bodyY + 5, colors.dark, 0);
  facetedDiamond(grid, cx, bodyY, 6, 6, colors, dir, {
    top: colors.mid,
    left: colors.dark,
    right: colors.mid,
    front: colors.edge,
  });
  oval(grid, cx + dir.x * 2, bodyY - 8, 5, 4, colors.light, colors.edge);
  facetedDiamond(grid, cx + dir.x * 2, bodyY - 8, 5, 4, colors, dir, {
    top: colors.light,
    left: colors.mid,
    right: colors.light,
    front: colors.dark,
  });
  drawFace(grid, cx + dir.x * 2, bodyY - 7, colors, dir, 'eyes');
  line(grid, cx - dir.x * 1, bodyY - 5, cx - dir.x * 5, bodyY - 10, colors.mid, 0);
  dot(grid, cx - dir.x * 6, bodyY - 11, colors.light, 0);

  const reach = pose === 'atk_strike' ? 14 : 7;
  for (let i = -1; i <= 1; i += 1) {
    line(
      grid,
      cx + dir.x * 4,
      bodyY - 1 + i,
      cx + dir.x * reach,
      bodyY + dir.y * 3 + i,
      colors.accent,
      0,
    );
  }
  if (pose === 'atk_strike') {
    dot(grid, cx + dir.x * 15, bodyY + dir.y * 3, colors.glow, 1);
    line(
      grid,
      cx + dir.x * 8,
      bodyY + dir.y * 3,
      cx + dir.x * 17,
      bodyY + dir.y * 5,
      colors.shine,
      0,
    );
  }
  if (pose === 'hit') drawHitMarks(grid, cx, bodyY - 1, colors, dir);
};

const drawBruiser = (grid: AuthoredGrid, dir: Dir, pose: Pose, colors: SpriteColors): void => {
  if (pose === 'die') {
    drawDowned(grid, 'bruiser', colors, dir);
    return;
  }

  const lean = pose === 'atk_strike' ? 2 : pose === 'atk_wind' ? -2 : 0;
  const cx = 16 + dir.x * lean;

  flatDiamond(grid, cx, 30, 12, 2.2, colors.edge, colors.edge);
  drawLegs(grid, cx, 24, 30, colors, dir, pose, 1.25);
  flatDiamond(grid, cx - dir.x * 7, 17, 5, 4, colors.dark, colors.edge);
  flatDiamond(grid, cx + dir.x * 7, 17, 5, 4, colors.light, colors.edge);
  facetedDiamond(grid, cx, 18, 9, 8, colors, dir, {
    top: colors.light,
    left: colors.mid,
    right: colors.light,
    front: colors.dark,
  });
  rect(grid, cx - 4, 18, 8, 3, colors.dark, colors.edge);
  dot(grid, cx + dir.x * 2, 19 + (dir.y > 0 ? 1 : -1), colors.accent, 1);
  oval(grid, cx + dir.x, 9, 5.5, 4.5, colors.light, colors.edge);
  facetedDiamond(grid, cx + dir.x, 9, 5, 4, colors, dir, {
    top: colors.top,
    left: colors.mid,
    right: colors.light,
    front: colors.edge,
  });
  flatDiamond(grid, cx + dir.x * 2, 17 + (dir.y > 0 ? 2 : -1), 3, 2, colors.accent, colors.edge);
  drawFace(grid, cx + dir.x, 9, colors, dir, 'visor');

  const fistX = cx + dir.x * (pose === 'atk_strike' ? 14 : 8);
  const fistY = 18 + dir.y * (pose === 'atk_strike' ? 4 : 2);
  line(grid, cx + dir.x * 6, 16, fistX, fistY, colors.mid, 1);
  flatDiamond(grid, fistX, fistY, 5, 3.5, colors.light, colors.edge);
  dot(grid, fistX + dir.x, fistY - 1, colors.shine, 0);
  line(grid, cx - dir.x * 6, 16, cx - dir.x * 9, 20 - dir.y, colors.dark, 1);
  flatDiamond(grid, cx - dir.x * 9, 20 - dir.y, 4, 2.5, colors.mid, colors.edge);
  if (pose === 'atk_strike')
    line(grid, fistX, fistY, fistX + dir.x * 4, fistY + dir.y * 2, colors.glow, 1);
  if (pose === 'hit') drawHitMarks(grid, cx, 16, colors, dir);
};

const drawSpitter = (grid: AuthoredGrid, dir: Dir, pose: Pose, colors: SpriteColors): void => {
  if (pose === 'die') {
    drawDowned(grid, 'spitter', colors, dir);
    return;
  }

  const bob = pose === 'idle_b' ? -1 : 0;
  const cx = 16;

  flatDiamond(grid, cx, 30 + bob, 10, 2, colors.edge, colors.edge);
  for (const side of [-1, 1]) {
    line(
      grid,
      cx + side * 3,
      23 + bob,
      cx + side * 6 + dir.x,
      29 + (side > 0 ? 0 : -2),
      colors.edge,
      1,
    );
    line(
      grid,
      cx + side * 3,
      23 + bob,
      cx + side * 6 + dir.x,
      29 + (side > 0 ? 0 : -2),
      colors.dark,
      0,
    );
    drawBoot(grid, cx + side * 6 + dir.x, 29 + (side > 0 ? 0 : -2), colors, dir, side > 0);
  }

  facetedDiamond(grid, cx, 19 + bob, 7, 6.5, colors, dir, {
    top: colors.light,
    left: colors.mid,
    right: colors.light,
    front: colors.dark,
  });
  line(grid, cx - dir.x * 5, 18 + bob, cx - dir.x * 8, 22 + bob, colors.mid, 1);
  line(grid, cx + dir.x * 5, 18 + bob, cx + dir.x * 8, 21 + bob, colors.light, 1);
  oval(grid, cx + dir.x, 10 + bob, 7, 4, colors.top, colors.edge);
  facetedDiamond(grid, cx + dir.x, 10 + bob, 7, 4, colors, dir, {
    top: colors.top,
    left: colors.mid,
    right: colors.light,
    front: colors.dark,
  });
  line(grid, cx - 5, 9 + bob, cx + 5, 9 + bob, colors.shine, 0);

  if (dir.y > 0) flatDiamond(grid, cx + dir.x * 3, 12 + bob, 2, 1, colors.accent, colors.glow);
  else line(grid, cx - dir.x * 4, 9 + bob, cx + dir.x * 3, 8 + bob, colors.top, 0);

  if (pose === 'atk_strike') {
    for (let i = 1; i <= 4; i += 1) {
      dot(
        grid,
        cx + dir.x * (4 + i * 4),
        13 + bob + dir.y * i,
        i % 2 ? colors.accent : colors.glow,
        1,
      );
    }
  } else {
    dot(grid, cx + dir.x * 4, 12 + bob, colors.accent, 0);
  }
  if (pose === 'hit') drawHitMarks(grid, cx, 16 + bob, colors, dir);
};

const drawBomber = (grid: AuthoredGrid, dir: Dir, pose: Pose, colors: SpriteColors): void => {
  if (pose === 'die') {
    drawDowned(grid, 'bomber', colors, dir);
    return;
  }

  if (pose === 'atk_strike') {
    flatDiamond(grid, 16, 16, 14, 11, colors.glow, colors.accent);
    flatDiamond(grid, 16, 16, 10, 8, colors.accent, colors.shine);
    flatDiamond(grid, 16, 16, 5, 4, colors.shine, colors.glow);
    for (let i = 0; i < 8; i += 1) {
      const sx = Math.round(Math.cos((i * Math.PI) / 4) * 13);
      const sy = Math.round(Math.sin((i * Math.PI) / 4) * 8);
      line(grid, 16, 16, 16 + sx, 16 + sy, i % 2 ? colors.accent : colors.glow, 0);
    }
    return;
  }

  const inflate = pose === 'atk_wind' ? 1 : 0;
  const cx = 16;

  flatDiamond(grid, cx, 30, 9, 2, colors.edge, colors.edge);
  drawLegs(grid, cx, 24, 29, colors, dir, pose);
  oval(grid, cx, 18, 8 + inflate, 8 + inflate, colors.mid, colors.edge);
  facetedDiamond(grid, cx, 18, 8 + inflate, 8 + inflate, colors, dir, {
    top: colors.light,
    left: colors.mid,
    right: colors.light,
    front: colors.dark,
  });
  flatDiamond(grid, cx + dir.x * 2, 16 + (dir.y > 0 ? 2 : -1), 3, 2, colors.accent, colors.edge);
  line(grid, cx - dir.x * 2, 10, cx - dir.x * 5, 5, colors.edge, 1);
  line(grid, cx - dir.x * 2, 10, cx - dir.x * 5, 5, colors.accent, 0);
  dot(grid, cx - dir.x * 6, 4, colors.glow, pose === 'atk_wind' ? 2 : 1);
  line(grid, cx - dir.x * 5, 19, cx - dir.x * 10, 22 + dir.y, colors.dark, 1);
  line(grid, cx + dir.x * 5, 19, cx + dir.x * 10, 22 + dir.y, colors.light, 1);

  if (dir.y > 0) {
    dot(grid, cx + dir.x * 3, 17, colors.shine, 0);
    dot(grid, cx + dir.x * 5, 18, colors.shine, 0);
  }
  if (pose === 'hit') drawHitMarks(grid, cx, 17, colors, dir);
};

const drawGuardian = (grid: AuthoredGrid, dir: Dir, pose: Pose, colors: SpriteColors): void => {
  if (pose === 'die') {
    drawDowned(grid, 'guardian', colors, dir);
    return;
  }

  const channel = pose === 'atk_wind';
  const strike = pose === 'atk_strike';

  diamondRing(
    grid,
    16,
    channel ? 7 : 8,
    channel ? 12 : 10,
    channel ? 6 : 5,
    channel ? colors.shine : colors.glow,
  );
  if (strike) {
    line(grid, 16 + dir.x * 5, 13, 16 + dir.x * 16, 13 + dir.y * 5, colors.glow, 1);
    line(grid, 16 + dir.x * 5, 16, 16 + dir.x * 14, 16 + dir.y * 5, colors.shine, 0);
  }

  flatDiamond(grid, 16, 31, 12, 2, colors.edge, colors.edge);
  drawLegs(grid, 16, 25, 30, colors, dir, pose, 1.1);
  flatDiamond(grid, 9, 18, 4, 5, colors.mid, colors.edge);
  flatDiamond(grid, 23, 18, 4, 5, colors.light, colors.edge);
  line(grid, 9, 18, 6, 23, colors.mid, 1);
  line(grid, 23, 18, 26, 23, colors.light, 1);
  facetedDiamond(grid, 16, 18, 8, 10, colors, dir, {
    top: colors.light,
    left: colors.mid,
    right: colors.light,
    front: colors.dark,
  });
  line(grid, 10, 18, 22, 18, colors.edge, 0);
  dot(grid, 16 + dir.x * 2, 20 + (dir.y > 0 ? 1 : -1), colors.glow, 2);
  oval(grid, 16 + dir.x, 8, 5, 5, colors.top, colors.edge);
  facetedDiamond(grid, 16 + dir.x, 8, 5, 5, colors, dir, {
    top: colors.top,
    left: colors.mid,
    right: colors.light,
    front: colors.dark,
  });
  flatDiamond(grid, 16 + dir.x * 2, 18 + (dir.y > 0 ? 2 : -1), 4, 3, colors.accent, colors.glow);
  drawFace(grid, 16 + dir.x, 8, colors, dir, 'visor');
  if (pose === 'hit') drawHitMarks(grid, 16, 16, colors, dir);
};

const renderPose = (spec: SpriteSpec, facing: Facing, pose: Pose): AuthoredGrid => {
  const grid = blank();
  const dir = DIR[facing];
  switch (spec.kind) {
    case 'hero':
      drawHero(grid, dir, pose, spec.colors);
      return grid;
    case 'stalker':
      drawStalker(grid, dir, pose, spec.colors);
      return grid;
    case 'bruiser':
      drawBruiser(grid, dir, pose, spec.colors);
      return grid;
    case 'spitter':
      drawSpitter(grid, dir, pose, spec.colors);
      return grid;
    case 'bomber':
      drawBomber(grid, dir, pose, spec.colors);
      return grid;
    case 'guardian':
      drawGuardian(grid, dir, pose, spec.colors);
      return grid;
  }
};

const makePoses = (spec: SpriteSpec): Record<string, AuthoredGrid> => {
  const poses: Record<string, AuthoredGrid> = {};
  for (const pose of POSES) {
    for (const facing of FACINGS) {
      poses[`${facing}:${pose}`] = renderPose(spec, facing, pose);
    }
  }
  return poses;
};

const timing = {
  hero: {
    idle: 420,
    step: 120,
    rest: 100,
    wind: 140,
    hold: 90,
    strike: 70,
    smear: 90,
    recover: 180,
    reset: 260,
  },
  stalker: {
    idle: 300,
    step: 90,
    rest: 70,
    wind: 120,
    hold: 50,
    strike: 55,
    smear: 90,
    recover: 180,
    reset: 180,
  },
  bruiser: {
    idle: 500,
    step: 180,
    rest: 140,
    wind: 260,
    hold: 180,
    strike: 80,
    smear: 140,
    recover: 320,
    reset: 260,
  },
  spitter: {
    idle: 280,
    step: 110,
    rest: 90,
    wind: 220,
    hold: 120,
    strike: 70,
    smear: 90,
    recover: 240,
    reset: 220,
  },
  bomber: {
    idle: 260,
    step: 140,
    rest: 120,
    wind: 140,
    hold: 120,
    strike: 80,
    smear: 140,
    recover: 200,
    reset: 200,
  },
  guardian: {
    idle: 480,
    step: 240,
    rest: 180,
    wind: 360,
    hold: 200,
    strike: 100,
    smear: 160,
    recover: 340,
    reset: 300,
  },
} satisfies Record<SpriteKind, Record<string, number>>;

const makeStates = (spec: SpriteSpec): Record<AuthoredClipId, AuthoredState> => {
  const t = timing[spec.kind];
  return {
    idle: {
      loop: true,
      frames: [
        { pose: 'idle_a', ty: 0, sy: 1, dur: t.idle },
        { pose: 'idle_b', ty: -1, sy: 0.98, dur: t.idle },
      ],
    },
    walk: {
      loop: true,
      frames: [
        { pose: 'walk_a', ty: -1, sx: 1.03, sy: 0.96, dur: t.step },
        { pose: 'idle_a', dur: t.rest },
        { pose: 'walk_b', ty: -1, sx: 1.03, sy: 0.96, dur: t.step },
        { pose: 'idle_a', dur: t.rest },
      ],
    },
    attack: {
      loop: false,
      frames: [
        {
          pose: 'atk_wind',
          sx: 0.94,
          sy: 1.06,
          dur: t.wind,
          tag: spec.kind === 'guardian' ? 'channel' : 'anticipation',
        },
        { pose: 'atk_wind', sx: 0.9, sy: 1.1, dur: t.hold, tag: 'hold' },
        {
          pose: 'atk_strike',
          sx: 1.12,
          sy: 0.88,
          dur: t.strike,
          tag: spec.kind === 'bomber' ? 'boom' : 'impact',
        },
        { pose: 'atk_strike', sx: 1.06, sy: 0.94, dur: t.smear, tag: 'smear' },
        { pose: 'idle_a', sx: 1, sy: 1, dur: t.recover, tag: 'recover' },
        { pose: 'idle_a', dur: t.reset, tag: 'reset' },
      ],
    },
    hit: {
      loop: false,
      frames: [
        { pose: 'hit', sx: 0.96, sy: 1.04, dur: 90, tint: TINT_WHITE },
        { pose: 'hit', sx: 0.98, sy: 1.02, dur: 130, tint: spec.hitTint },
        { pose: 'hit', dur: 150 },
        { pose: 'idle_a', dur: 240 },
      ],
    },
    die: {
      loop: false,
      frames: [
        { pose: 'hit', sx: 1.12, sy: 0.86, dur: 120, tint: TINT_WHITE },
        { pose: 'hit', sx: 1.08, sy: 0.82, ty: 3, dur: 150, alpha: 0.9 },
        { pose: 'die', ty: 7, dur: 260, alpha: 0.82 },
        { pose: 'die', ty: 9, dur: 520, alpha: 0.45 },
      ],
    },
  };
};

const makeDef = (spec: SpriteSpec): AuthoredSpriteDef => ({
  name: spec.name,
  id: spec.id,
  width: SIZE,
  height: SIZE,
  palette: spec.palette,
  poses: makePoses(spec),
  states: makeStates(spec),
});

const heroSpec: SpriteSpec = {
  name: 'Excavator',
  id: 'HERO',
  kind: 'hero',
  hitTint: TINT_BLOOD,
  palette: buildPalette([
    null,
    '#101827',
    '#2d3a55',
    '#64748b',
    '#63d7f0',
    '#f4c85a',
    '#dbe4f2',
    '#07111f',
    '#e04f5f',
  ]),
  colors: {
    edge: 1,
    dark: 2,
    mid: 3,
    light: 6,
    top: 6,
    accent: 5,
    glow: 4,
    face: 7,
    shine: 6,
    hit: 8,
  },
};

const stalkerSpec: SpriteSpec = {
  name: 'Stalker',
  id: 'E01',
  kind: 'stalker',
  hitTint: TINT_STALKER,
  palette: buildPalette([
    null,
    '#1d1020',
    '#5e2338',
    '#a93a4c',
    '#e04f5f',
    '#ffc840',
    '#dbe4f2',
    '#130812',
    '#ff8a7a',
  ]),
  colors: {
    edge: 1,
    dark: 2,
    mid: 3,
    light: 4,
    top: 4,
    accent: 5,
    glow: 5,
    face: 6,
    shine: 8,
    hit: 8,
  },
};

const bruiserSpec: SpriteSpec = {
  name: 'Bruiser',
  id: 'E02',
  kind: 'bruiser',
  hitTint: TINT_BRUISER,
  palette: buildPalette([
    null,
    '#101827',
    '#29344f',
    '#5b6d86',
    '#9f6cff',
    '#dbe4f2',
    '#0a1020',
    '#f6c453',
    '#caa8ff',
  ]),
  colors: {
    edge: 1,
    dark: 2,
    mid: 3,
    light: 5,
    top: 5,
    accent: 4,
    glow: 8,
    face: 6,
    shine: 7,
    hit: 8,
  },
};

const spitterSpec: SpriteSpec = {
  name: 'Spitter',
  id: 'E03',
  kind: 'spitter',
  hitTint: TINT_SPITTER,
  palette: buildPalette([
    null,
    '#0c1b11',
    '#234b2d',
    '#3f7c3f',
    '#6fe19a',
    '#c86bff',
    '#dbe4f2',
    '#07100b',
    '#baffcf',
  ]),
  colors: {
    edge: 1,
    dark: 2,
    mid: 3,
    light: 4,
    top: 8,
    accent: 5,
    glow: 6,
    face: 6,
    shine: 8,
    hit: 5,
  },
};

const bomberSpec: SpriteSpec = {
  name: 'Spore Bomber',
  id: 'E04',
  kind: 'bomber',
  hitTint: TINT_BOMBER,
  palette: buildPalette([
    null,
    '#160820',
    '#3d2556',
    '#6e3b86',
    '#b56aff',
    '#f6c453',
    '#fff0a6',
    '#09040f',
    '#d6b6ff',
  ]),
  colors: {
    edge: 1,
    dark: 2,
    mid: 3,
    light: 4,
    top: 8,
    accent: 5,
    glow: 6,
    face: 6,
    shine: 8,
    hit: 6,
  },
};

const guardianSpec: SpriteSpec = {
  name: 'Guardian',
  id: 'E05',
  kind: 'guardian',
  hitTint: TINT_GUARDIAN,
  palette: buildPalette([
    null,
    '#12041c',
    '#3b1450',
    '#733091',
    '#c86bff',
    '#f6c453',
    '#dbe4f2',
    '#ffe090',
    '#f5ccff',
  ]),
  colors: {
    edge: 1,
    dark: 2,
    mid: 3,
    light: 4,
    top: 8,
    accent: 5,
    glow: 7,
    face: 6,
    shine: 8,
    hit: 7,
  },
};

export const heroAuthoredV2 = makeDef(heroSpec);
export const stalkerAuthoredV2 = makeDef(stalkerSpec);
export const bruiserAuthoredV2 = makeDef(bruiserSpec);
export const spitterAuthoredV2 = makeDef(spitterSpec);
export const bomberAuthoredV2 = makeDef(bomberSpec);
export const guardianAuthoredV2 = makeDef(guardianSpec);
