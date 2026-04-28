/**
 * Procedural pixel sprites for isometric pop-up features.
 * Each sprite is drawn around a tiny ground-plane footprint with explicit top,
 * left, and right faces so it reads like part of the iso world instead of a flat decal.
 */
import type { PixelSprite } from './sprites';

/** Pack RGBA into a 32-bit integer (little-endian: ABGR) */
const rgba = (r: number, g: number, b: number, a = 255): number =>
  (a << 24) | (b << 16) | (g << 8) | r;

/** Create an empty sprite buffer */
const createSprite = (width: number, height: number): PixelSprite => ({
  width,
  height,
  pixels: new Uint32Array(width * height),
});

/** Set pixel in sprite (y=0 is top) */
const setPixel = (sprite: PixelSprite, x: number, y: number, color: number): void => {
  if (x >= 0 && x < sprite.width && y >= 0 && y < sprite.height) {
    sprite.pixels[y * sprite.width + x] = color;
  }
};

/** Fill rectangle */
const fillRect = (
  sprite: PixelSprite,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
): void => {
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      setPixel(sprite, px, py, color);
    }
  }
};

type PixelPoint = { x: number; y: number };

const fillEllipse = (
  sprite: PixelSprite,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: number,
): void => {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const nx = (x - cx) / Math.max(1, rx);
      const ny = (y - cy) / Math.max(1, ry);
      if (nx * nx + ny * ny <= 1) {
        setPixel(sprite, x, y, color);
      }
    }
  }
};

const fillPolygon = (sprite: PixelSprite, points: PixelPoint[], color: number): void => {
  if (points.length < 3) return;
  const minY = Math.floor(Math.min(...points.map((p) => p.y)));
  const maxY = Math.ceil(Math.max(...points.map((p) => p.y)));

  for (let y = minY; y <= maxY; y += 1) {
    const intersections: number[] = [];
    const scanY = y + 0.5;
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i]!;
      const b = points[(i + 1) % points.length]!;
      if ((a.y <= scanY && b.y > scanY) || (b.y <= scanY && a.y > scanY)) {
        const t = (scanY - a.y) / (b.y - a.y);
        intersections.push(a.x + t * (b.x - a.x));
      }
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i < intersections.length; i += 2) {
      const x0 = Math.ceil(intersections[i] ?? 0);
      const x1 = Math.floor(intersections[i + 1] ?? x0);
      for (let x = x0; x <= x1; x += 1) {
        setPixel(sprite, x, y, color);
      }
    }
  }
};

const drawLine = (
  sprite: PixelSprite,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: number,
  thickness = 1,
): void => {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const endX = Math.round(x1);
  const endY = Math.round(y1);
  const dx = Math.abs(endX - x);
  const sx = x < endX ? 1 : -1;
  const dy = -Math.abs(endY - y);
  const sy = y < endY ? 1 : -1;
  let err = dx + dy;

  while (true) {
    for (let oy = -Math.floor(thickness / 2); oy <= Math.floor(thickness / 2); oy += 1) {
      for (let ox = -Math.floor(thickness / 2); ox <= Math.floor(thickness / 2); ox += 1) {
        setPixel(sprite, x + ox, y + oy, color);
      }
    }
    if (x === endX && y === endY) break;
    const e2 = err * 2;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
};

const strokePolygon = (sprite: PixelSprite, points: PixelPoint[], color: number): void => {
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    drawLine(sprite, a.x, a.y, b.x, b.y, color);
  }
};

const drawIsoBox = (
  sprite: PixelSprite,
  cx: number,
  topY: number,
  halfW: number,
  halfH: number,
  depth: number,
  topColor: number,
  leftColor: number,
  rightColor: number,
  edgeColor: number,
): void => {
  const top: PixelPoint[] = [
    { x: cx, y: topY },
    { x: cx + halfW, y: topY + halfH },
    { x: cx, y: topY + halfH * 2 },
    { x: cx - halfW, y: topY + halfH },
  ];
  const leftFace: PixelPoint[] = [
    top[3]!,
    top[2]!,
    { x: cx, y: topY + halfH * 2 + depth },
    { x: cx - halfW, y: topY + halfH + depth },
  ];
  const rightFace: PixelPoint[] = [
    top[1]!,
    { x: cx + halfW, y: topY + halfH + depth },
    { x: cx, y: topY + halfH * 2 + depth },
    top[2]!,
  ];

  fillPolygon(sprite, leftFace, leftColor);
  fillPolygon(sprite, rightFace, rightColor);
  fillPolygon(sprite, top, topColor);
  strokePolygon(sprite, leftFace, edgeColor);
  strokePolygon(sprite, rightFace, edgeColor);
  strokePolygon(sprite, top, edgeColor);
};

type CrystalPalette = {
  bright: number;
  mid: number;
  dark: number;
  highlight: number;
  edge: number;
};

const drawIsoShard = (
  sprite: PixelSprite,
  cx: number,
  baseY: number,
  height: number,
  halfW: number,
  halfH: number,
  palette: CrystalPalette,
): void => {
  const apex = { x: cx, y: baseY - height };
  const back = { x: cx, y: baseY - halfH };
  const right = { x: cx + halfW, y: baseY };
  const front = { x: cx, y: baseY + halfH };
  const left = { x: cx - halfW, y: baseY };

  fillPolygon(sprite, [apex, left, front, back], palette.bright);
  fillPolygon(sprite, [apex, back, right, front], palette.dark);
  fillPolygon(sprite, [apex, back, left], palette.highlight);
  fillPolygon(sprite, [apex, front, left], palette.mid);
  strokePolygon(sprite, [apex, right, front, left], palette.edge);
  drawLine(sprite, apex.x, apex.y, front.x, front.y, palette.edge);
  drawLine(sprite, apex.x, apex.y + 1, back.x, back.y, rgba(220, 255, 240, 200));
};

const drawIsoMushroom = (
  sprite: PixelSprite,
  cx: number,
  baseY: number,
  height: number,
  capW: number,
  capH: number,
  capTop: number,
  capSide: number,
  stem: number,
  stemDark: number,
  glow: number,
): void => {
  const capY = baseY - height;
  fillPolygon(
    sprite,
    [
      { x: cx - 1, y: baseY },
      { x: cx + 2, y: baseY - 1 },
      { x: cx + 1, y: capY + capH },
      { x: cx - 1, y: capY + capH + 1 },
    ],
    stemDark,
  );
  fillPolygon(
    sprite,
    [
      { x: cx - 2, y: baseY },
      { x: cx + 1, y: baseY - 1 },
      { x: cx + 1, y: capY + capH },
      { x: cx - 1, y: capY + capH + 1 },
    ],
    stem,
  );
  fillPolygon(
    sprite,
    [
      { x: cx - capW, y: capY + 1 },
      { x: cx, y: capY - capH },
      { x: cx + capW, y: capY + 1 },
      { x: cx, y: capY + capH + 1 },
    ],
    capSide,
  );
  fillPolygon(
    sprite,
    [
      { x: cx - capW + 1, y: capY },
      { x: cx, y: capY - capH },
      { x: cx + capW - 1, y: capY },
      { x: cx, y: capY + capH - 1 },
    ],
    capTop,
  );
  drawLine(sprite, cx - capW + 1, capY, cx, capY - capH, glow);
  setPixel(sprite, cx + 1, capY - capH + 1, rgba(212, 255, 220, 180));
};

const drawIsoPost = (
  sprite: PixelSprite,
  cx: number,
  topY: number,
  halfW: number,
  halfH: number,
  height: number,
  topColor: number,
  leftColor: number,
  rightColor: number,
  edgeColor: number,
): void => {
  drawIsoBox(sprite, cx, topY, halfW, halfH, height, topColor, leftColor, rightColor, edgeColor);
  drawLine(sprite, cx - halfW, topY + halfH, cx - halfW, topY + halfH + height, edgeColor);
  drawLine(sprite, cx + halfW, topY + halfH, cx + halfW, topY + halfH + height, edgeColor);
};

// ============================================================================
// Crystal Sprite (pointed shard)
// ============================================================================
export const createCrystalSprite = (): PixelSprite => {
  const sprite = createSprite(22, 26);
  const palette: CrystalPalette = {
    bright: rgba(116, 255, 194, 255),
    mid: rgba(70, 200, 150, 255),
    dark: rgba(34, 128, 114, 255),
    highlight: rgba(188, 255, 232, 255),
    edge: rgba(20, 78, 76, 255),
  };

  fillEllipse(sprite, 11, 23, 10, 3, rgba(6, 18, 20, 112));
  drawIsoBox(
    sprite,
    11,
    17,
    8,
    4,
    4,
    rgba(43, 78, 76, 255),
    rgba(31, 55, 58, 255),
    rgba(22, 43, 48, 255),
    rgba(14, 30, 34, 255),
  );

  drawIsoShard(sprite, 11, 16, 14, 5, 4, palette);
  drawIsoShard(sprite, 6, 19, 9, 3, 3, {
    ...palette,
    bright: rgba(96, 232, 176, 255),
    mid: rgba(58, 166, 132, 255),
  });
  drawIsoShard(sprite, 16, 19, 10, 4, 3, {
    ...palette,
    dark: rgba(28, 110, 108, 255),
    highlight: rgba(158, 255, 224, 255),
  });

  setPixel(sprite, 9, 5, rgba(232, 255, 244, 230));
  setPixel(sprite, 15, 9, rgba(204, 255, 232, 210));
  setPixel(sprite, 5, 13, rgba(192, 255, 220, 210));

  return sprite;
};

// ============================================================================
// Root Barrier Sprite (tangled roots)
// ============================================================================
export const createRootBarrierSprite = (): PixelSprite => {
  const sprite = createSprite(26, 23);
  const rootLight = rgba(126, 186, 100, 255);
  const rootMid = rgba(86, 138, 72, 255);
  const rootDark = rgba(48, 82, 48, 255);
  const rootEdge = rgba(24, 46, 30, 255);

  fillEllipse(sprite, 13, 20, 12, 3, rgba(5, 14, 8, 130));
  drawIsoBox(
    sprite,
    13,
    14,
    11,
    4,
    3,
    rgba(50, 88, 52, 255),
    rgba(36, 64, 42, 255),
    rgba(28, 54, 38, 255),
    rootEdge,
  );

  drawLine(sprite, 4, 15, 12, 9, rootEdge, 3);
  drawLine(sprite, 4, 15, 12, 9, rootMid, 2);
  drawLine(sprite, 12, 9, 22, 15, rootEdge, 3);
  drawLine(sprite, 12, 9, 22, 15, rootLight, 2);
  drawLine(sprite, 5, 18, 13, 12, rootEdge, 3);
  drawLine(sprite, 5, 18, 13, 12, rootLight, 2);
  drawLine(sprite, 13, 12, 21, 18, rootEdge, 3);
  drawLine(sprite, 13, 12, 21, 18, rootMid, 2);

  fillPolygon(
    sprite,
    [
      { x: 8, y: 17 },
      { x: 10, y: 18 },
      { x: 10, y: 7 },
      { x: 8, y: 5 },
    ],
    rootDark,
  );
  fillPolygon(
    sprite,
    [
      { x: 9, y: 16 },
      { x: 11, y: 17 },
      { x: 11, y: 8 },
      { x: 10, y: 5 },
    ],
    rootMid,
  );
  fillPolygon(
    sprite,
    [
      { x: 16, y: 17 },
      { x: 18, y: 16 },
      { x: 18, y: 6 },
      { x: 16, y: 8 },
    ],
    rootDark,
  );
  fillPolygon(
    sprite,
    [
      { x: 15, y: 18 },
      { x: 17, y: 17 },
      { x: 17, y: 7 },
      { x: 15, y: 8 },
    ],
    rootLight,
  );
  drawLine(sprite, 7, 8, 12, 3, rootEdge, 2);
  drawLine(sprite, 7, 8, 12, 3, rootLight);
  drawLine(sprite, 18, 7, 22, 5, rootEdge, 2);
  drawLine(sprite, 18, 7, 22, 5, rootMid);
  setPixel(sprite, 11, 4, rgba(168, 232, 130, 255));
  setPixel(sprite, 20, 6, rgba(168, 232, 130, 230));

  return sprite;
};

// ============================================================================
// Terminal Sprite (tech console)
// ============================================================================
export const createTerminalSprite = (active: boolean, broken: boolean): PixelSprite => {
  const sprite = createSprite(27, 30);
  const body = broken ? rgba(60, 70, 82, 255) : rgba(70, 80, 95, 255);
  const frame = broken ? rgba(40, 50, 62, 255) : rgba(50, 60, 75, 255);
  const frameLight = broken ? rgba(78, 88, 102, 255) : rgba(104, 118, 140, 255);
  const sideDark = broken ? rgba(34, 42, 52, 255) : rgba(38, 48, 64, 255);
  const screen = broken
    ? rgba(170, 90, 90, 200)
    : active
      ? rgba(140, 242, 176, 255)
      : rgba(115, 155, 188, 200);
  const screenGlow = broken
    ? rgba(120, 70, 70, 220)
    : active
      ? rgba(100, 200, 150, 255)
      : rgba(90, 120, 150, 200);

  const edge = rgba(18, 24, 34, 255);

  fillEllipse(sprite, 13, 27, 12, 3, rgba(3, 6, 12, 132));
  drawIsoBox(sprite, 13, 20, 10, 5, 5, frameLight, frame, sideDark, edge);
  drawIsoBox(sprite, 13, 17, 7, 3, 5, body, frame, sideDark, edge);

  fillPolygon(
    sprite,
    [
      { x: 5, y: 11 },
      { x: 12, y: 7 },
      { x: 21, y: 11 },
      { x: 18, y: 22 },
      { x: 6, y: 23 },
    ],
    body,
  );
  fillPolygon(
    sprite,
    [
      { x: 18, y: 12 },
      { x: 22, y: 14 },
      { x: 21, y: 24 },
      { x: 18, y: 22 },
    ],
    sideDark,
  );
  drawLine(sprite, 5, 11, 12, 7, frameLight, 2);
  drawLine(sprite, 12, 7, 21, 11, frameLight, 2);
  drawLine(sprite, 6, 23, 18, 22, edge, 2);
  drawLine(sprite, 21, 12, 22, 23, rgba(86, 100, 120, 150));

  fillPolygon(
    sprite,
    [
      { x: 8, y: 12 },
      { x: 13, y: 10 },
      { x: 18, y: 12 },
      { x: 17, y: 16 },
      { x: 9, y: 16 },
    ],
    screen,
  );
  drawLine(sprite, 8, 12, 13, 10, screenGlow);
  drawLine(sprite, 13, 10, 18, 12, rgba(208, 255, 220, broken ? 80 : 180));
  drawLine(sprite, 10, 15, 16, 16, rgba(14, 20, 28, 175));

  fillPolygon(
    sprite,
    [
      { x: 8, y: 19 },
      { x: 16, y: 18 },
      { x: 17, y: 20 },
      { x: 9, y: 21 },
    ],
    frame,
  );
  drawLine(sprite, 10, 19, 14, 19, screenGlow);
  setPixel(sprite, 8, 20, rgba(230, 190, 90, 230));
  setPixel(sprite, 17, 19, rgba(226, 100, 94, 230));
  setPixel(sprite, 19, 21, rgba(18, 24, 34, 255));

  if (broken) {
    drawLine(sprite, 9, 12, 16, 16, rgba(36, 16, 18, 255));
    drawLine(sprite, 18, 12, 12, 16, rgba(36, 16, 18, 255));
    drawLine(sprite, 19, 15, 21, 17, rgba(170, 76, 68, 220));
    setPixel(sprite, 20, 21, rgba(180, 84, 70, 255));
  } else if (active) {
    setPixel(sprite, 20, 20, screenGlow);
    setPixel(sprite, 21, 21, screen);
  }

  return sprite;
};

// ============================================================================
// Gate Sprite (metal barrier)
// ============================================================================
export const createGateSprite = (open: boolean): PixelSprite => {
  const sprite = createSprite(28, 25);
  const metal = rgba(120, 130, 145, 255);
  const metalDark = rgba(80, 90, 105, 255);
  const metalLight = rgba(150, 160, 175, 255);
  const openColor = rgba(113, 200, 150, 200);
  const closedColor = rgba(222, 122, 98, 255);
  const edge = rgba(38, 46, 58, 255);

  fillEllipse(sprite, 14, 22, 13, 3, rgba(3, 5, 9, 126));
  drawIsoPost(sprite, 6, 8, 4, 2, 12, metalLight, metal, metalDark, edge);
  drawIsoPost(sprite, 22, 8, 4, 2, 12, metalLight, metal, metalDark, edge);
  drawIsoBox(sprite, 14, 4, 12, 3, 5, metalLight, metal, metalDark, edge);
  drawIsoBox(
    sprite,
    14,
    18,
    12,
    3,
    3,
    rgba(98, 106, 124, 255),
    metalDark,
    rgba(56, 66, 82, 255),
    edge,
  );

  if (open) {
    drawLine(sprite, 8, 12, 3, 15, metalDark, 2);
    drawLine(sprite, 8, 15, 3, 18, metal, 2);
    drawLine(sprite, 20, 12, 25, 15, metalDark, 2);
    drawLine(sprite, 20, 15, 25, 18, metal, 2);
    drawLine(sprite, 11, 15, 17, 15, openColor);
    setPixel(sprite, 13, 14, openColor);
    setPixel(sprite, 14, 14, openColor);
    setPixel(sprite, 15, 14, openColor);
  } else {
    drawLine(sprite, 8, 10, 20, 16, edge, 3);
    drawLine(sprite, 8, 10, 20, 16, closedColor, 2);
    drawLine(sprite, 20, 10, 8, 16, edge, 3);
    drawLine(sprite, 20, 10, 8, 16, closedColor, 2);
    drawLine(sprite, 11, 9, 11, 18, metalLight, 2);
    drawLine(sprite, 17, 10, 17, 19, metalDark, 2);
    setPixel(sprite, 13, 13, rgba(255, 170, 130, 220));
    setPixel(sprite, 15, 13, rgba(255, 170, 130, 220));
  }

  return sprite;
};

// ============================================================================
// Portal Sprite (arcane ring)
// ============================================================================
export const createPortalSprite = (pulse: number): PixelSprite => {
  const sprite = createSprite(27, 31);
  const outerRing = rgba(176, 110, 255, Math.floor(180 + pulse * 75));
  const innerRing = rgba(140, 80, 220, Math.floor(150 + pulse * 60));
  const glow = rgba(200, 150, 255, Math.floor(100 + pulse * 80));
  const baseTop = rgba(86, 74, 118, 255);
  const baseLeft = rgba(58, 50, 88, 255);
  const baseRight = rgba(42, 36, 68, 255);
  const edge = rgba(30, 24, 50, 255);

  fillEllipse(sprite, 13, 28, 11, 3, rgba(9, 5, 20, 125));
  drawIsoBox(sprite, 13, 22, 10, 4, 4, baseTop, baseLeft, baseRight, edge);
  drawIsoBox(sprite, 13, 18, 6, 3, 4, rgba(110, 86, 154, 255), baseLeft, baseRight, edge);

  fillEllipse(sprite, 15, 12, 8, 11, rgba(78, 42, 118, Math.floor(160 + pulse * 44)));
  fillEllipse(sprite, 15, 12, 5, 8, 0);
  fillEllipse(sprite, 12, 11, 8, 11, outerRing);
  fillEllipse(sprite, 12, 11, 5, 8, 0);
  fillEllipse(sprite, 13, 12, 4, 7, rgba(130, 70, 220, Math.floor(46 + pulse * 68)));
  drawLine(sprite, 7, 4, 4, 10, glow, 2);
  drawLine(sprite, 18, 5, 21, 11, innerRing, 2);
  drawLine(sprite, 6, 18, 11, 22, glow);
  drawLine(sprite, 14, 22, 19, 18, outerRing);
  setPixel(sprite, 12, 2, rgba(226, 196, 255, Math.floor(160 + pulse * 70)));
  setPixel(sprite, 5, 12, glow);
  setPixel(sprite, 20, 13, innerRing);

  return sprite;
};

// ============================================================================
// Prop: Beacon Sprite (pillar with light)
// ============================================================================
export const createBeaconSprite = (pulse: number): PixelSprite => {
  const sprite = createSprite(22, 30);
  const pillar = rgba(98, 118, 144, 255);
  const pillarDark = rgba(70, 85, 110, 255);
  const pillarLight = rgba(132, 154, 184, 255);
  const light = rgba(118, 240, 255, Math.floor(200 + pulse * 55));
  const glow = rgba(140, 250, 255, Math.floor(150 + pulse * 80));
  const edge = rgba(30, 38, 54, 255);

  fillEllipse(sprite, 11, 27, 10, 3, rgba(3, 7, 12, 132));
  drawIsoBox(sprite, 11, 21, 8, 4, 4, pillarLight, pillar, pillarDark, edge);
  drawIsoBox(sprite, 11, 14, 5, 3, 8, rgba(116, 138, 164, 255), pillar, pillarDark, edge);
  fillPolygon(
    sprite,
    [
      { x: 7, y: 16 },
      { x: 11, y: 12 },
      { x: 15, y: 16 },
      { x: 14, y: 24 },
      { x: 8, y: 24 },
    ],
    pillar,
  );
  fillPolygon(
    sprite,
    [
      { x: 15, y: 16 },
      { x: 17, y: 18 },
      { x: 15, y: 25 },
      { x: 14, y: 24 },
    ],
    pillarDark,
  );
  drawLine(sprite, 7, 16, 11, 12, pillarLight, 2);
  drawLine(sprite, 11, 12, 15, 16, rgba(160, 178, 202, 255), 2);
  drawLine(sprite, 8, 24, 14, 24, edge);
  drawIsoBox(sprite, 11, 9, 5, 2, 4, pillarLight, pillar, pillarDark, edge);
  fillEllipse(sprite, 11, 7, 5, 4, glow);
  fillEllipse(sprite, 11, 7, 3, 2, light);
  setPixel(sprite, 10, 1, glow);
  setPixel(sprite, 11, 1, glow);
  setPixel(sprite, 10, 2, light);
  setPixel(sprite, 11, 2, light);
  setPixel(sprite, 12, 3, glow);
  drawLine(sprite, 8, 8, 6, 10, rgba(210, 255, 255, Math.floor(90 + pulse * 70)));
  drawLine(sprite, 14, 8, 16, 10, rgba(210, 255, 255, Math.floor(70 + pulse * 60)));

  return sprite;
};

// ============================================================================
// Prop: Crate Sprite (wooden box)
// ============================================================================
export const createCrateSprite = (): PixelSprite => {
  const sprite = createSprite(30, 26);
  const wood = rgba(133, 101, 72, 255);
  const woodLight = rgba(160, 130, 95, 255);
  const woodDark = rgba(95, 70, 50, 255);
  const strap = rgba(80, 70, 60, 255);
  const edge = rgba(56, 42, 32, 255);

  fillEllipse(sprite, 15, 24, 14, 2, rgba(5, 3, 2, 142));
  drawIsoBox(sprite, 15, 5, 13, 6, 10, woodLight, wood, woodDark, edge);

  drawLine(sprite, 15, 5, 4, 11, rgba(190, 150, 104, 210));
  drawLine(sprite, 15, 5, 26, 11, rgba(122, 88, 58, 190));
  drawLine(sprite, 9, 8, 20, 14, rgba(186, 146, 100, 180));
  drawLine(sprite, 21, 8, 10, 14, rgba(100, 70, 44, 190));
  drawLine(sprite, 3, 12, 15, 18, rgba(92, 64, 42, 200));
  drawLine(sprite, 27, 12, 15, 18, rgba(72, 48, 34, 210));

  drawLine(sprite, 8, 9, 22, 16, strap, 2);
  drawLine(sprite, 22, 9, 8, 16, strap, 2);
  drawLine(sprite, 15, 6, 15, 25, rgba(188, 150, 104, 220), 2);
  setPixel(sprite, 7, 14, rgba(214, 166, 108, 190));
  setPixel(sprite, 22, 14, rgba(122, 82, 52, 220));
  setPixel(sprite, 15, 7, rgba(222, 178, 116, 220));

  return sprite;
};

// ============================================================================
// Prop: Debris Sprite (scattered rubble)
// ============================================================================
export const createDebrisSprite = (): PixelSprite => {
  const sprite = createSprite(23, 18);
  const rock1 = rgba(124, 136, 154, 255);
  const rock2 = rgba(86, 95, 112, 255);
  const rock3 = rgba(100, 110, 125, 255);
  const rock4 = rgba(58, 66, 82, 255);
  const edge = rgba(38, 44, 56, 255);

  fillEllipse(sprite, 11, 16, 10, 2, rgba(2, 3, 6, 110));
  drawIsoBox(sprite, 6, 9, 4, 2, 5, rock1, rock3, rock4, edge);
  drawIsoBox(sprite, 13, 6, 4, 2, 7, rock3, rock2, rock4, edge);
  drawIsoBox(sprite, 17, 11, 4, 2, 4, rock1, rock3, rock2, edge);
  drawIsoBox(sprite, 9, 12, 3, 1, 3, rock2, rock4, rock3, edge);
  drawLine(sprite, 10, 7, 13, 6, rgba(152, 162, 176, 230));
  drawLine(sprite, 4, 11, 7, 10, rgba(152, 162, 176, 210));
  setPixel(sprite, 3, 14, rock2);
  setPixel(sprite, 20, 14, rock3);
  setPixel(sprite, 16, 5, rgba(162, 172, 186, 255));
  setPixel(sprite, 12, 15, rgba(70, 78, 94, 255));

  return sprite;
};

// ============================================================================
// Prop: Fungal Cluster Sprite (mushroom group)
// ============================================================================
export const createFungalClusterSprite = (pulse: number): PixelSprite => {
  const sprite = createSprite(24, 24);
  const cap1 = rgba(94, 226, 132, Math.floor(200 + pulse * 55));
  const cap2 = rgba(70, 180, 100, 255);
  const capDark = rgba(42, 118, 76, 255);
  const stem = rgba(64, 104, 78, 255);
  const stemDark = rgba(50, 80, 60, 255);
  const glow = rgba(140, 255, 180, Math.floor(180 + pulse * 75));

  fillEllipse(sprite, 12, 21, 11, 3, rgba(3, 12, 7, 126));
  drawIsoBox(
    sprite,
    12,
    17,
    9,
    4,
    2,
    rgba(34, 80, 48, 255),
    rgba(26, 58, 40, 255),
    rgba(20, 48, 36, 255),
    rgba(12, 34, 24, 255),
  );

  drawIsoMushroom(sprite, 6, 20, 8, 4, 2, cap2, capDark, stem, stemDark, glow);
  drawIsoMushroom(sprite, 13, 21, 13, 6, 3, cap1, capDark, stem, stemDark, glow);
  drawIsoMushroom(sprite, 19, 20, 7, 4, 2, cap2, capDark, stem, stemDark, glow);
  drawIsoMushroom(sprite, 10, 22, 6, 3, 2, rgba(80, 200, 116, 255), capDark, stem, stemDark, glow);
  setPixel(sprite, 4, 19, glow);
  setPixel(sprite, 17, 16, glow);
  setPixel(sprite, 21, 20, rgba(160, 255, 190, Math.floor(130 + pulse * 80)));

  return sprite;
};

// ============================================================================
// Sprite cache to avoid recreation every frame
// ============================================================================
const spriteCache = new Map<string, PixelSprite>();

export const getCrystalSprite = (): PixelSprite => {
  const key = 'crystal';
  let sprite = spriteCache.get(key);
  if (!sprite) {
    sprite = createCrystalSprite();
    spriteCache.set(key, sprite);
  }
  return sprite;
};

export const getRootBarrierSprite = (): PixelSprite => {
  const key = 'root_barrier';
  let sprite = spriteCache.get(key);
  if (!sprite) {
    sprite = createRootBarrierSprite();
    spriteCache.set(key, sprite);
  }
  return sprite;
};

export const getTerminalSprite = (active: boolean, broken: boolean): PixelSprite => {
  const key = `terminal_${active}_${broken}`;
  let sprite = spriteCache.get(key);
  if (!sprite) {
    sprite = createTerminalSprite(active, broken);
    spriteCache.set(key, sprite);
  }
  return sprite;
};

export const getGateSprite = (open: boolean): PixelSprite => {
  const key = `gate_${open}`;
  let sprite = spriteCache.get(key);
  if (!sprite) {
    sprite = createGateSprite(open);
    spriteCache.set(key, sprite);
  }
  return sprite;
};

export const getPortalSprite = (simTick: number, x: number, y: number): PixelSprite => {
  // Pulse varies, so we quantize to reduce cache misses
  const pulse = (Math.sin(simTick * 0.18 + x * 0.7 + y * 0.5) + 1) * 0.5;
  const pulseKey = Math.floor(pulse * 4);
  const key = `portal_${pulseKey}`;
  let sprite = spriteCache.get(key);
  if (!sprite) {
    sprite = createPortalSprite(pulse);
    spriteCache.set(key, sprite);
  }
  return sprite;
};

export const getBeaconSprite = (simTick: number, x: number, y: number): PixelSprite => {
  const pulse = (Math.sin(simTick * 0.16 + x * 0.35 + y * 0.4) + 1) * 0.5;
  const pulseKey = Math.floor(pulse * 4);
  const key = `beacon_${pulseKey}`;
  let sprite = spriteCache.get(key);
  if (!sprite) {
    sprite = createBeaconSprite(pulse);
    spriteCache.set(key, sprite);
  }
  return sprite;
};

export const getCrateSprite = (): PixelSprite => {
  const key = 'crate';
  let sprite = spriteCache.get(key);
  if (!sprite) {
    sprite = createCrateSprite();
    spriteCache.set(key, sprite);
  }
  return sprite;
};

export const getDebrisSprite = (): PixelSprite => {
  const key = 'debris';
  let sprite = spriteCache.get(key);
  if (!sprite) {
    sprite = createDebrisSprite();
    spriteCache.set(key, sprite);
  }
  return sprite;
};

export const getFungalClusterSprite = (simTick: number, x: number, y: number): PixelSprite => {
  const pulse = (Math.sin(simTick * 0.11 + x * 0.7 + y * 0.3) + 1) * 0.5;
  const pulseKey = Math.floor(pulse * 4);
  const key = `fungal_${pulseKey}`;
  let sprite = spriteCache.get(key);
  if (!sprite) {
    sprite = createFungalClusterSprite(pulse);
    spriteCache.set(key, sprite);
  }
  return sprite;
};
