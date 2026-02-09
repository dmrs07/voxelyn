/**
 * Procedural pixel sprites for 3D pop-up features.
 * All sprites are designed to be rendered with billboard tilt.
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
  color: number
): void => {
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      setPixel(sprite, px, py, color);
    }
  }
};

// ============================================================================
// Crystal Sprite (pointed shard)
// ============================================================================
export const createCrystalSprite = (): PixelSprite => {
  const sprite = createSprite(7, 12);
  const bright = rgba(116, 255, 194, 255);
  const mid = rgba(70, 200, 150, 255);
  const dark = rgba(40, 140, 110, 255);
  const highlight = rgba(180, 255, 230, 255);

  // Crystal body (diamond shape)
  setPixel(sprite, 3, 0, highlight); // tip
  setPixel(sprite, 2, 1, bright);
  setPixel(sprite, 3, 1, bright);
  setPixel(sprite, 4, 1, mid);
  setPixel(sprite, 1, 2, bright);
  setPixel(sprite, 2, 2, bright);
  setPixel(sprite, 3, 2, mid);
  setPixel(sprite, 4, 2, mid);
  setPixel(sprite, 5, 2, dark);
  setPixel(sprite, 1, 3, bright);
  setPixel(sprite, 2, 3, bright);
  setPixel(sprite, 3, 3, mid);
  setPixel(sprite, 4, 3, mid);
  setPixel(sprite, 5, 3, dark);
  setPixel(sprite, 0, 4, bright);
  setPixel(sprite, 1, 4, bright);
  setPixel(sprite, 2, 4, mid);
  setPixel(sprite, 3, 4, mid);
  setPixel(sprite, 4, 4, dark);
  setPixel(sprite, 5, 4, dark);
  setPixel(sprite, 6, 4, dark);
  // lower body
  setPixel(sprite, 1, 5, bright);
  setPixel(sprite, 2, 5, mid);
  setPixel(sprite, 3, 5, mid);
  setPixel(sprite, 4, 5, dark);
  setPixel(sprite, 5, 5, dark);
  setPixel(sprite, 1, 6, mid);
  setPixel(sprite, 2, 6, mid);
  setPixel(sprite, 3, 6, mid);
  setPixel(sprite, 4, 6, dark);
  setPixel(sprite, 5, 6, dark);
  setPixel(sprite, 2, 7, mid);
  setPixel(sprite, 3, 7, dark);
  setPixel(sprite, 4, 7, dark);
  setPixel(sprite, 2, 8, mid);
  setPixel(sprite, 3, 8, dark);
  setPixel(sprite, 4, 8, dark);
  setPixel(sprite, 3, 9, dark);
  setPixel(sprite, 3, 10, dark);
  setPixel(sprite, 3, 11, dark);

  return sprite;
};

// ============================================================================
// Root Barrier Sprite (tangled roots)
// ============================================================================
export const createRootBarrierSprite = (): PixelSprite => {
  const sprite = createSprite(11, 10);
  const root1 = rgba(109, 176, 98, 255);
  const root2 = rgba(85, 140, 75, 255);
  const root3 = rgba(65, 105, 55, 255);

  // Tangled root mass
  fillRect(sprite, 1, 7, 2, 3, root3);
  fillRect(sprite, 4, 6, 3, 4, root2);
  fillRect(sprite, 8, 7, 2, 3, root3);

  // Upper tendrils
  setPixel(sprite, 2, 5, root2);
  setPixel(sprite, 3, 4, root1);
  setPixel(sprite, 4, 3, root1);
  setPixel(sprite, 5, 2, root1);
  setPixel(sprite, 6, 1, root1);
  setPixel(sprite, 7, 0, root2);

  setPixel(sprite, 5, 4, root2);
  setPixel(sprite, 6, 3, root2);
  setPixel(sprite, 7, 2, root3);

  setPixel(sprite, 7, 5, root1);
  setPixel(sprite, 8, 4, root1);
  setPixel(sprite, 9, 3, root2);

  setPixel(sprite, 0, 6, root2);
  setPixel(sprite, 1, 5, root1);
  setPixel(sprite, 2, 4, root1);

  setPixel(sprite, 10, 6, root2);
  setPixel(sprite, 9, 5, root1);

  return sprite;
};

// ============================================================================
// Terminal Sprite (tech console)
// ============================================================================
export const createTerminalSprite = (active: boolean, broken: boolean): PixelSprite => {
  const sprite = createSprite(8, 10);
  const body = broken ? rgba(60, 70, 82, 255) : rgba(70, 80, 95, 255);
  const frame = broken ? rgba(40, 50, 62, 255) : rgba(50, 60, 75, 255);
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

  // Base/body
  fillRect(sprite, 1, 6, 6, 4, body);
  fillRect(sprite, 0, 8, 8, 2, frame);

  // Screen frame
  fillRect(sprite, 1, 1, 6, 5, frame);
  // Screen
  fillRect(sprite, 2, 2, 4, 3, screen);
  setPixel(sprite, 2, 2, screenGlow);
  if (broken) {
    setPixel(sprite, 3, 3, rgba(40, 20, 20, 255));
    setPixel(sprite, 4, 4, rgba(40, 20, 20, 255));
    setPixel(sprite, 5, 2, rgba(40, 20, 20, 255));
  }

  return sprite;
};

// ============================================================================
// Gate Sprite (metal barrier)
// ============================================================================
export const createGateSprite = (open: boolean): PixelSprite => {
  const sprite = createSprite(12, 14);
  const metal = rgba(120, 130, 145, 255);
  const metalDark = rgba(80, 90, 105, 255);
  const metalLight = rgba(150, 160, 175, 255);
  const openColor = rgba(113, 200, 150, 200);
  const closedColor = rgba(222, 122, 98, 255);

  // Pillars
  fillRect(sprite, 0, 4, 2, 10, metalDark);
  fillRect(sprite, 10, 4, 2, 10, metalDark);
  fillRect(sprite, 0, 4, 1, 10, metal);
  fillRect(sprite, 10, 4, 1, 10, metal);

  // Top bar
  fillRect(sprite, 0, 2, 12, 2, metal);
  fillRect(sprite, 0, 2, 12, 1, metalLight);

  // Gate bars or opening
  if (open) {
    // Gate is raised, show open space with small indicator
    setPixel(sprite, 5, 10, openColor);
    setPixel(sprite, 6, 10, openColor);
  } else {
    // Closed bars
    for (let y = 4; y < 14; y += 2) {
      fillRect(sprite, 2, y, 8, 1, closedColor);
    }
    // Vertical bars
    fillRect(sprite, 4, 4, 1, 10, metal);
    fillRect(sprite, 7, 4, 1, 10, metal);
  }

  return sprite;
};

// ============================================================================
// Portal Sprite (arcane ring)
// ============================================================================
export const createPortalSprite = (pulse: number): PixelSprite => {
  const sprite = createSprite(10, 12);
  const outerRing = rgba(176, 110, 255, Math.floor(180 + pulse * 75));
  const innerRing = rgba(140, 80, 220, Math.floor(150 + pulse * 60));
  const glow = rgba(200, 150, 255, Math.floor(100 + pulse * 80));

  // Outer ring (ellipse approximation)
  setPixel(sprite, 4, 0, outerRing);
  setPixel(sprite, 5, 0, outerRing);
  setPixel(sprite, 2, 1, outerRing);
  setPixel(sprite, 3, 1, glow);
  setPixel(sprite, 6, 1, glow);
  setPixel(sprite, 7, 1, outerRing);
  setPixel(sprite, 1, 2, outerRing);
  setPixel(sprite, 8, 2, outerRing);
  setPixel(sprite, 0, 3, outerRing);
  setPixel(sprite, 0, 4, outerRing);
  setPixel(sprite, 0, 5, outerRing);
  setPixel(sprite, 9, 3, outerRing);
  setPixel(sprite, 9, 4, outerRing);
  setPixel(sprite, 9, 5, outerRing);
  setPixel(sprite, 0, 6, outerRing);
  setPixel(sprite, 9, 6, outerRing);
  setPixel(sprite, 1, 7, outerRing);
  setPixel(sprite, 8, 7, outerRing);
  setPixel(sprite, 2, 8, outerRing);
  setPixel(sprite, 7, 8, outerRing);
  setPixel(sprite, 3, 9, glow);
  setPixel(sprite, 6, 9, glow);
  setPixel(sprite, 4, 10, innerRing);
  setPixel(sprite, 5, 10, innerRing);

  // Inner highlights
  setPixel(sprite, 1, 4, innerRing);
  setPixel(sprite, 1, 5, innerRing);
  setPixel(sprite, 8, 4, innerRing);
  setPixel(sprite, 8, 5, innerRing);

  return sprite;
};

// ============================================================================
// Prop: Beacon Sprite (pillar with light)
// ============================================================================
export const createBeaconSprite = (pulse: number): PixelSprite => {
  const sprite = createSprite(6, 12);
  const pillar = rgba(98, 118, 144, 255);
  const pillarDark = rgba(70, 85, 110, 255);
  const light = rgba(118, 240, 255, Math.floor(200 + pulse * 55));
  const glow = rgba(140, 250, 255, Math.floor(150 + pulse * 80));

  // Pillar body
  fillRect(sprite, 2, 4, 2, 8, pillar);
  fillRect(sprite, 1, 6, 1, 6, pillarDark);
  fillRect(sprite, 4, 6, 1, 6, pillarDark);

  // Base
  fillRect(sprite, 1, 10, 4, 2, pillarDark);

  // Light orb at top
  setPixel(sprite, 2, 2, glow);
  setPixel(sprite, 3, 2, glow);
  setPixel(sprite, 1, 3, light);
  setPixel(sprite, 2, 3, light);
  setPixel(sprite, 3, 3, light);
  setPixel(sprite, 4, 3, light);
  setPixel(sprite, 2, 4, light);
  setPixel(sprite, 3, 4, light);

  // Top glow
  setPixel(sprite, 2, 0, glow);
  setPixel(sprite, 3, 0, glow);
  setPixel(sprite, 2, 1, light);
  setPixel(sprite, 3, 1, light);

  return sprite;
};

// ============================================================================
// Prop: Crate Sprite (wooden box)
// ============================================================================
export const createCrateSprite = (): PixelSprite => {
  const sprite = createSprite(10, 10);
  const wood = rgba(133, 101, 72, 255);
  const woodLight = rgba(160, 130, 95, 255);
  const woodDark = rgba(95, 70, 50, 255);
  const strap = rgba(80, 70, 60, 255);

  // Main body
  fillRect(sprite, 1, 2, 8, 8, wood);

  // Top face (lighter)
  fillRect(sprite, 1, 2, 8, 2, woodLight);

  // Right side (darker)
  fillRect(sprite, 7, 4, 2, 6, woodDark);

  // Straps
  fillRect(sprite, 4, 2, 2, 8, strap);
  fillRect(sprite, 1, 5, 8, 1, strap);

  // Edges
  setPixel(sprite, 0, 2, woodDark);
  setPixel(sprite, 9, 2, woodDark);
  setPixel(sprite, 0, 9, woodDark);
  setPixel(sprite, 9, 9, woodDark);

  return sprite;
};

// ============================================================================
// Prop: Debris Sprite (scattered rubble)
// ============================================================================
export const createDebrisSprite = (): PixelSprite => {
  const sprite = createSprite(10, 8);
  const rock1 = rgba(124, 136, 154, 255);
  const rock2 = rgba(86, 95, 112, 255);
  const rock3 = rgba(100, 110, 125, 255);

  // Scattered rocks
  fillRect(sprite, 0, 4, 3, 3, rock1);
  fillRect(sprite, 4, 3, 2, 4, rock2);
  fillRect(sprite, 7, 5, 3, 3, rock3);

  // Smaller debris
  setPixel(sprite, 2, 3, rock2);
  setPixel(sprite, 3, 5, rock1);
  setPixel(sprite, 6, 4, rock1);
  setPixel(sprite, 8, 3, rock2);

  // Highlights
  setPixel(sprite, 0, 4, rock3);
  setPixel(sprite, 4, 3, rock3);
  setPixel(sprite, 7, 5, rock1);

  return sprite;
};

// ============================================================================
// Prop: Fungal Cluster Sprite (mushroom group)
// ============================================================================
export const createFungalClusterSprite = (pulse: number): PixelSprite => {
  const sprite = createSprite(10, 10);
  const cap1 = rgba(94, 226, 132, Math.floor(200 + pulse * 55));
  const cap2 = rgba(70, 180, 100, 255);
  const stem = rgba(64, 104, 78, 255);
  const stemDark = rgba(50, 80, 60, 255);
  const glow = rgba(140, 255, 180, Math.floor(180 + pulse * 75));

  // Left mushroom
  fillRect(sprite, 0, 5, 3, 2, cap2);
  setPixel(sprite, 1, 4, cap1);
  setPixel(sprite, 1, 7, stem);
  setPixel(sprite, 1, 8, stem);
  setPixel(sprite, 1, 9, stemDark);

  // Center mushroom (tallest)
  fillRect(sprite, 3, 3, 4, 2, cap1);
  setPixel(sprite, 4, 2, glow);
  setPixel(sprite, 5, 2, glow);
  setPixel(sprite, 4, 5, stem);
  setPixel(sprite, 5, 5, stem);
  setPixel(sprite, 4, 6, stem);
  setPixel(sprite, 5, 6, stem);
  setPixel(sprite, 4, 7, stem);
  setPixel(sprite, 5, 7, stem);
  setPixel(sprite, 4, 8, stemDark);
  setPixel(sprite, 5, 8, stemDark);
  setPixel(sprite, 4, 9, stemDark);
  setPixel(sprite, 5, 9, stemDark);

  // Right mushroom
  fillRect(sprite, 7, 6, 3, 2, cap2);
  setPixel(sprite, 8, 5, cap1);
  setPixel(sprite, 8, 8, stem);
  setPixel(sprite, 8, 9, stemDark);

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
