/**
 * Hero spritesheet loader - loads the two hero spritesheets and creates
 * an AnimationSet for the player character.
 *
 * Sheet mapping:
 *   9+BtwY.png: Down-Right facing (DR), flip horizontally for Down-Left (DL)
 *   oz9ztg.png: Up-Right facing (UR), flip horizontally for Up-Left (UL)
 *
 * Sheet layout (288x500, ~48x50 cells):
 *   Row 0 (y≈15):  idle frame 1 (1 frame)
 *   Row 1 (y≈68):  idle frame 2 (1 frame)
 *   Row 2 (y≈139): interact (1 frame) - unused
 *   Row 3 (y≈172): walk cycle A (4 frames)
 *   Row 4 (y≈226): walk cycle B (4 frames)
 *   Row 5 (y≈280): attack (6 frames)
 *   Row 6 (y≈335): cast (5 frames)
 *   Row 7 (y≈392): hit (3 frames)
 *   Row 8 (y≈442): die (5 frames)
 */

import {
  loadAtlasFromUrl,
  sliceAtlasFrame,
  type AnimationClip,
  type AnimationSet,
  type AtlasSource,
  type PixelSprite,
} from '@voxelyn/animation';

// Spritesheet grid configuration
const CELL_W = 48;
const CELL_H = 50;

// Row definitions with their Y offset and frame count
type RowDef = {
  y: number;
  h: number;
  frames: number;
};

const ROWS: Record<string, RowDef> = {
  idle1: { y: 15, h: 44, frames: 1 },
  idle2: { y: 68, h: 40, frames: 1 },
  walkA: { y: 172, h: 45, frames: 4 },
  walkB: { y: 226, h: 44, frames: 4 },
  attack: { y: 280, h: 46, frames: 6 },
  cast: { y: 335, h: 43, frames: 5 },
  hit: { y: 392, h: 41, frames: 3 },
  die: { y: 442, h: 45, frames: 5 },
};

// Frame durations in ms
const IDLE_FRAME_MS = 400;
const WALK_FRAME_MS = 100;
const ATTACK_FRAME_MS = 50;
const CAST_FRAME_MS = 65;
const HIT_FRAME_MS = 60;
const DIE_FRAME_MS = 120;

type SheetPair = {
  down: AtlasSource; // 9+BtwY.png - DR native, flip for DL
  up: AtlasSource;   // oz9ztg.png - UR native, flip for UL
};

let cachedSheets: SheetPair | null = null;
let cachedAnimSet: AnimationSet | null = null;
let loadPromise: Promise<AnimationSet> | null = null;

const sliceRow = (
  atlas: AtlasSource,
  row: RowDef,
  frameW: number,
  frameH: number
): PixelSprite[] => {
  const frames: PixelSprite[] = [];
  for (let i = 0; i < row.frames; i++) {
    const x = i * CELL_W;
    const sprite = sliceAtlasFrame(atlas, {
      x,
      y: row.y,
      w: frameW,
      h: frameH,
    });
    frames.push(sprite);
  }
  return frames;
};

/**
 * Flip a sprite horizontally and return a new sprite
 */
const flipSpriteHorizontal = (src: PixelSprite): PixelSprite => {
  const out: PixelSprite = {
    width: src.width,
    height: src.height,
    pixels: new Uint32Array(src.width * src.height),
  };

  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const srcX = src.width - 1 - x;
      out.pixels[y * src.width + x] = src.pixels[y * src.width + srcX] ?? 0;
    }
  }

  return out;
};

/**
 * Flip an array of sprites horizontally
 */
const flipFramesHorizontal = (frames: PixelSprite[]): PixelSprite[] => {
  return frames.map(flipSpriteHorizontal);
};

const copyFrameInto = (out: PixelSprite, src: PixelSprite): PixelSprite => {
  // Handle size mismatch by centering the source in the output
  out.pixels.fill(0);
  const ox = Math.floor((out.width - src.width) / 2);
  const oy = Math.floor((out.height - src.height) / 2);
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const srcIdx = y * src.width + x;
      const dstX = ox + x;
      const dstY = oy + y;
      if (dstX >= 0 && dstX < out.width && dstY >= 0 && dstY < out.height) {
        out.pixels[dstY * out.width + dstX] = src.pixels[srcIdx] ?? 0;
      }
    }
  }
  return out;
};

const makeDurationTable = (durations: number[]): number[] => {
  let total = 0;
  const table: number[] = [];
  for (const d of durations) {
    total += Math.max(1, d | 0);
    table.push(total);
  }
  return table;
};

const pickFrameByTime = (localMs: number, cumulative: number[]): number => {
  for (let i = 0; i < cumulative.length; i++) {
    if (localMs < cumulative[i]!) return i;
  }
  return Math.max(0, cumulative.length - 1);
};

type DirectionalFrames = {
  dr: PixelSprite[]; // Down-Right (native from down sheet)
  dl: PixelSprite[]; // Down-Left (flipped from down sheet)
  ur: PixelSprite[]; // Up-Right (native from up sheet)
  ul: PixelSprite[]; // Up-Left (flipped from up sheet)
};

const createDirectionalClip = (
  id: string,
  frames: DirectionalFrames,
  frameDurationMs: number,
  loop: boolean
): AnimationClip => {
  const frameCount = Math.max(frames.dr.length, frames.ur.length);
  const durations = Array(frameCount).fill(frameDurationMs);
  const cumulative = makeDurationTable(durations);
  const totalMs = cumulative[cumulative.length - 1] ?? frameDurationMs;
  const fps = Math.max(1, Math.round(1000 / frameDurationMs));

  return {
    id,
    fps,
    loop,
    lengthMs: totalMs,
    generator: ({ out, localTMs, facing }) => {
      const t = loop ? localTMs % totalMs : Math.min(localTMs, Math.max(0, totalMs - 1));
      const index = pickFrameByTime(t, cumulative);

      // Pick pre-computed frames for the exact facing direction
      const sourceFrames = frames[facing];
      const frame = sourceFrames[index] ?? sourceFrames[0];

      if (!frame) return out;
      return copyFrameInto(out, frame);
    },
  };
};

const buildAnimationSet = (sheets: SheetPair): AnimationSet => {
  const frameW = CELL_W;
  const frameH = CELL_H;

  // Slice all rows from both sheets
  // Down sheet (9+BtwY.png) for DR (native), DL (flipped)
  const drIdle = sliceRow(sheets.down, ROWS.idle1!, frameW, frameH); // Single frame idle
  const drWalk = sliceRow(sheets.down, ROWS.walkB!, frameW, frameH); // Use row 5 for walk
  const drAttack = sliceRow(sheets.down, ROWS.attack!, frameW, frameH);
  const drCast = sliceRow(sheets.down, ROWS.cast!, frameW, frameH);
  const drHit = sliceRow(sheets.down, ROWS.hit!, frameW, frameH);
  const drDie = sliceRow(sheets.down, ROWS.die!, frameW, frameH);

  // Up sheet (oz9ztg.png) for UR (native), UL (flipped)
  const urIdle = sliceRow(sheets.up, ROWS.idle1!, frameW, frameH); // Single frame idle
  const urWalk = sliceRow(sheets.up, ROWS.walkB!, frameW, frameH); // Use row 5 for walk
  const urAttack = sliceRow(sheets.up, ROWS.attack!, frameW, frameH);
  const urCast = sliceRow(sheets.up, ROWS.cast!, frameW, frameH);
  const urHit = sliceRow(sheets.up, ROWS.hit!, frameW, frameH);
  const urDie = sliceRow(sheets.up, ROWS.die!, frameW, frameH);

  // Create flipped versions for left-facing directions
  const dlIdle = flipFramesHorizontal(drIdle);
  const dlWalk = flipFramesHorizontal(drWalk);
  const dlAttack = flipFramesHorizontal(drAttack);
  const dlCast = flipFramesHorizontal(drCast);
  const dlHit = flipFramesHorizontal(drHit);
  const dlDie = flipFramesHorizontal(drDie);

  const ulIdle = flipFramesHorizontal(urIdle);
  const ulWalk = flipFramesHorizontal(urWalk);
  const ulAttack = flipFramesHorizontal(urAttack);
  const ulCast = flipFramesHorizontal(urCast);
  const ulHit = flipFramesHorizontal(urHit);
  const ulDie = flipFramesHorizontal(urDie);

  // Create clips with all 4 directions pre-computed
  const idle = createDirectionalClip('idle', { dr: drIdle, dl: dlIdle, ur: urIdle, ul: ulIdle }, IDLE_FRAME_MS, true);
  const walk = createDirectionalClip('walk', { dr: drWalk, dl: dlWalk, ur: urWalk, ul: ulWalk }, WALK_FRAME_MS, true);
  const attack = createDirectionalClip('attack', { dr: drAttack, dl: dlAttack, ur: urAttack, ul: ulAttack }, ATTACK_FRAME_MS, false);
  const cast = createDirectionalClip('cast', { dr: drCast, dl: dlCast, ur: urCast, ul: ulCast }, CAST_FRAME_MS, false);
  const hit = createDirectionalClip('hit', { dr: drHit, dl: dlHit, ur: urHit, ul: ulHit }, HIT_FRAME_MS, false);
  const die = createDirectionalClip('die', { dr: drDie, dl: dlDie, ur: urDie, ul: ulDie }, DIE_FRAME_MS, false);

  return {
    idle,
    walk,
    attack,
    cast,
    hit,
    die,
    aliases: {
      move: walk,
    },
  };
};

/**
 * Load hero spritesheets and build animation set.
 * Returns a promise that resolves to the AnimationSet.
 * Caches result for subsequent calls.
 */
export const loadHeroSpriteset = async (): Promise<AnimationSet> => {
  if (cachedAnimSet) return cachedAnimSet;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const [down, up] = await Promise.all([
      loadAtlasFromUrl('./assets/9+BtwY.png'),  // Down-facing (DR native)
      loadAtlasFromUrl('./assets/oz9ztg.png'),  // Up-facing (UR native)
    ]);

    cachedSheets = { down, up };
    cachedAnimSet = buildAnimationSet(cachedSheets);
    return cachedAnimSet;
  })();

  return loadPromise;
};

/**
 * Check if hero spriteset is already loaded.
 */
export const isHeroSpritesetLoaded = (): boolean => cachedAnimSet !== null;

/**
 * Get the cached hero animation set (or null if not loaded).
 */
export const getHeroSpriteset = (): AnimationSet | null => cachedAnimSet;

/**
 * Hero frame dimensions for renderer scaling.
 */
export const HERO_FRAME_WIDTH = CELL_W;
export const HERO_FRAME_HEIGHT = CELL_H;
