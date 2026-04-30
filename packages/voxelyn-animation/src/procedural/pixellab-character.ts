import type {
  AnimationFacing,
  AnimationClip,
  AnimationSet,
  PixelSprite,
  ProceduralCharacter,
  ProceduralCharacterDef,
} from '../types.js';
import type { Direction } from '../sprite-atlas/direction.js';
import type { LoadedAtlas, LoadedClip } from '../sprite-atlas/types.js';
import { clearSprite } from './primitives.js';
import { proceduralPalette } from './palette.js';

const DIRECTION_BY_FACING: Record<string, Direction> = {
  dr: 'DR',
  dl: 'DL',
  ur: 'UR',
  ul: 'UL',
};

type PixelLabStyle = NonNullable<ProceduralCharacterDef['style']>;

type MotionTiming = {
  idle: number;
  step: number;
  rest: number;
  wind: number;
  hold: number;
  strike: number;
  smear: number;
  recover: number;
  reset: number;
};

type MotionFrame = {
  dur: number;
  tx?: number;
  ty?: number;
  sx?: number;
  sy?: number;
  advance?: number;
  alpha?: number;
  tint?: number;
};

type MotionState = {
  loop: boolean;
  frames: MotionFrame[];
};

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

const packRGBA = (r: number, g: number, b: number, a = 255): number =>
  (((a & 0xff) << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff)) >>> 0;

const TINT_WHITE = packRGBA(255, 255, 255);

const HIT_TINT_BY_STYLE: Record<PixelLabStyle, number> = {
  player: packRGBA(224, 79, 95),
  stalker: packRGBA(224, 79, 95),
  bruiser: packRGBA(181, 106, 255),
  spitter: packRGBA(111, 225, 154),
  spore_bomber: packRGBA(246, 196, 83),
  guardian: packRGBA(200, 107, 255),
};

const TIMING_BY_STYLE: Record<PixelLabStyle, MotionTiming> = {
  player: {
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
  spore_bomber: {
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
};

const boundsCache = new WeakMap<PixelSprite, Bounds | null>();

const opaqueBounds = (sprite: PixelSprite): Bounds | null => {
  if (boundsCache.has(sprite)) return boundsCache.get(sprite) ?? null;

  let minX = sprite.width;
  let minY = sprite.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < sprite.height; y += 1) {
    const row = y * sprite.width;
    for (let x = 0; x < sprite.width; x += 1) {
      const alpha = ((sprite.pixels[row + x] ?? 0) >>> 24) & 0xff;
      if (alpha === 0) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  const bounds = maxX >= 0 ? { minX, minY, maxX, maxY } : null;
  boundsCache.set(sprite, bounds);
  return bounds;
};

const totalDuration = (state: MotionState): number =>
  state.frames.reduce((sum, frame) => sum + frame.dur, 0);

const resolveMotionFrame = (
  state: MotionState,
  localTMs: number,
  clipDurationMs: number
): MotionFrame => {
  const total = totalDuration(state);
  if (state.frames.length === 0 || total <= 0) return { dur: 1 };
  const safeClipDuration = Math.max(1, clipDurationMs);
  const clipped = state.loop
    ? localTMs % safeClipDuration
    : Math.min(localTMs, safeClipDuration - 1);
  const t = (clipped / safeClipDuration) * total;

  let acc = 0;
  for (const frame of state.frames) {
    acc += frame.dur;
    if (t < acc) return frame;
  }
  return state.frames[state.frames.length - 1]!;
};

const motionForClip = (
  clipId: string,
  style: PixelLabStyle,
  loop: boolean
): MotionState => {
  const t = TIMING_BY_STYLE[style];
  const hitTint = HIT_TINT_BY_STYLE[style];

  switch (clipId) {
    case 'idle':
      return {
        loop,
        frames: [
          { dur: t.idle },
          { dur: t.idle, ty: -1, sy: 0.98 },
        ],
      };
    case 'walk':
      return {
        loop,
        frames: [
          { dur: t.step, tx: -1, ty: -2, sx: 1.04, sy: 0.94 },
          { dur: t.rest },
          { dur: t.step, tx: 1, ty: -2, sx: 1.04, sy: 0.94 },
          { dur: t.rest },
        ],
      };
    case 'attack':
      return {
        loop,
        frames: [
          { dur: t.wind, sx: 0.94, sy: 1.06, ty: 1, advance: -1 },
          { dur: t.hold, sx: 0.9, sy: 1.1, ty: 2, advance: -1 },
          { dur: t.strike, sx: 1.14, sy: 0.86, advance: 3 },
          { dur: t.smear, sx: 1.07, sy: 0.93, advance: 2 },
          { dur: t.recover, sx: 1, sy: 1 },
          { dur: t.reset },
        ],
      };
    case 'cast':
      return {
        loop,
        frames: [
          { dur: t.wind, sx: 0.96, sy: 1.06, ty: 1 },
          { dur: t.hold, sx: 1.05, sy: 0.96, ty: -1 },
          { dur: t.smear, sx: 1.1, sy: 0.92, advance: 1 },
          { dur: t.recover },
        ],
      };
    case 'hit':
      return {
        loop,
        frames: [
          { dur: 90, tx: -1, sx: 0.96, sy: 1.04, tint: TINT_WHITE },
          { dur: 130, tx: 1, sx: 0.98, sy: 1.02, tint: hitTint },
          { dur: 150 },
          { dur: 240 },
        ],
      };
    case 'die':
      return {
        loop,
        frames: [
          { dur: 120, sx: 1.12, sy: 0.86, tint: TINT_WHITE },
          { dur: 150, sx: 1.08, sy: 0.82, ty: 3, alpha: 0.9 },
          { dur: 260, sx: 1.08, sy: 0.7, ty: 7, alpha: 0.82 },
          { dur: 520, sx: 1.04, sy: 0.58, ty: 9, alpha: 0.45 },
        ],
      };
    default:
      return {
        loop,
        frames: [{ dur: 1 }],
      };
  }
};

const mulAlpha = (packed: number, alpha: number): number => {
  if (alpha >= 1) return packed;
  if (alpha <= 0) return 0;
  const a = (packed >>> 24) & 0xff;
  const newA = Math.max(0, Math.min(255, Math.round(a * alpha)));
  return ((packed & 0x00ffffff) | (newA << 24)) >>> 0;
};

const applyTint = (packed: number, tint: number): number => {
  if (packed === 0) return 0;
  const srcA = (packed >>> 24) & 0xff;
  if (srcA === 0) return 0;
  return ((tint & 0x00ffffff) | (srcA << 24)) >>> 0;
};

const facingSign = (facing: AnimationFacing): -1 | 1 =>
  facing === 'dl' || facing === 'ul' ? -1 : 1;

const fitScale = (
  desired: number,
  min: number,
  max: number,
  anchor: number,
  offset: number,
  size: number,
  margin: number
): number => {
  let fitted = Math.max(0.1, desired);
  if (fitted <= 1) return fitted;

  if (min < anchor) {
    const limit = (anchor + offset - margin) / (anchor - min);
    if (Number.isFinite(limit) && limit > 0) fitted = Math.min(fitted, limit);
  }
  if (max + 1 > anchor) {
    const limit = (size - margin - anchor - offset) / (max + 1 - anchor);
    if (Number.isFinite(limit) && limit > 0) fitted = Math.min(fitted, limit);
  }
  return Math.max(0.1, fitted);
};

const transformedRect = (
  bounds: Bounds,
  anchor: { x: number; y: number },
  sx: number,
  sy: number,
  tx: number,
  ty: number
): { x0: number; y0: number; x1: number; y1: number } => ({
  x0: Math.round(anchor.x + (bounds.minX - anchor.x) * sx + tx),
  y0: Math.round(anchor.y + (bounds.minY - anchor.y) * sy + ty),
  x1: Math.round(anchor.x + (bounds.maxX + 1 - anchor.x) * sx + tx),
  y1: Math.round(anchor.y + (bounds.maxY + 1 - anchor.y) * sy + ty),
});

const clampOffsetToFrame = (
  rectStart: number,
  rectEnd: number,
  size: number,
  margin: number,
  offset: number
): number => {
  let next = offset;
  if (rectStart < margin) next += margin - rectStart;
  if (rectEnd > size - margin) next -= rectEnd - (size - margin);
  return next;
};

const drawTransformedFrame = (
  out: PixelSprite,
  src: PixelSprite,
  motion: MotionFrame,
  anchor: { x: number; y: number },
  facing: AnimationFacing
): PixelSprite => {
  clearSprite(out, 0);

  const bounds = opaqueBounds(src);
  if (!bounds) return out;

  const margin = 1;
  let tx = Math.round((motion.tx ?? 0) + (motion.advance ?? 0) * facingSign(facing));
  let ty = Math.round(motion.ty ?? 0);
  const sx = fitScale(motion.sx ?? 1, bounds.minX, bounds.maxX, anchor.x, tx, out.width, margin);
  const sy = fitScale(motion.sy ?? 1, bounds.minY, bounds.maxY, anchor.y, ty, out.height, margin);

  let rect = transformedRect(bounds, anchor, sx, sy, tx, ty);
  tx = clampOffsetToFrame(rect.x0, rect.x1, out.width, margin, tx);
  ty = clampOffsetToFrame(rect.y0, rect.y1, out.height, margin, ty);
  rect = transformedRect(bounds, anchor, sx, sy, tx, ty);

  const dstX0 = Math.max(0, rect.x0);
  const dstY0 = Math.max(0, rect.y0);
  const dstX1 = Math.min(out.width, Math.max(rect.x1, rect.x0 + 1));
  const dstY1 = Math.min(out.height, Math.max(rect.y1, rect.y0 + 1));
  const dstW = Math.max(1, rect.x1 - rect.x0);
  const dstH = Math.max(1, rect.y1 - rect.y0);
  const srcW = bounds.maxX - bounds.minX + 1;
  const srcH = bounds.maxY - bounds.minY + 1;
  const alpha = motion.alpha ?? 1;
  const tint = motion.tint;

  for (let y = dstY0; y < dstY1; y += 1) {
    const relY = y - rect.y0;
    const srcY = bounds.minY + Math.min(srcH - 1, Math.floor((relY * srcH) / dstH));
    const srcRow = srcY * src.width;
    const outRow = y * out.width;
    for (let x = dstX0; x < dstX1; x += 1) {
      const relX = x - rect.x0;
      const srcX = bounds.minX + Math.min(srcW - 1, Math.floor((relX * srcW) / dstW));
      let color = src.pixels[srcRow + srcX] ?? 0;
      if (((color >>> 24) & 0xff) === 0) continue;
      if (tint !== undefined) color = applyTint(color, tint);
      if (alpha < 1) color = mulAlpha(color, alpha);
      if (color !== 0) out.pixels[outRow + x] = color >>> 0;
    }
  }

  return out;
};

const makeClipFromLoaded = (
  clipId: string,
  loaded: LoadedClip,
  style: PixelLabStyle,
  anchor: { x: number; y: number },
  bakedMotion: boolean
): AnimationClip => {
  const durationMs = Math.max(1, loaded.durationMs);
  const manifestFrameCount = Math.max(1, loaded.framesPerDirection);
  const fps = Math.max(1, Math.round((manifestFrameCount * 1000) / durationMs));
  const motion = bakedMotion
    ? { loop: loaded.loop, frames: [{ dur: 1 }] }
    : motionForClip(clipId, style, loaded.loop);
  return {
    id: clipId,
    fps,
    loop: loaded.loop,
    lengthMs: durationMs,
    generator: ({ out, localTMs, facing }) => {
      const direction = DIRECTION_BY_FACING[facing] ?? 'DR';
      const frames = loaded.framesByDir[direction] ?? loaded.framesByDir.DR;
      if (frames.length === 0) {
        clearSprite(out, 0);
        return out;
      }
      const phase =
        loaded.loop && durationMs > 0
          ? localTMs % durationMs
          : Math.min(localTMs, durationMs);
      const index = Math.min(
        frames.length - 1,
        Math.floor((phase / durationMs) * frames.length)
      );
      const motionFrame = resolveMotionFrame(motion, phase, durationMs);
      return drawTransformedFrame(out, frames[index]!, motionFrame, anchor, facing);
    },
  };
};

export const buildPixelLabCharacter = (
  def: Extract<ProceduralCharacterDef, { source: 'pixellab' }>,
  atlas: LoadedAtlas
): ProceduralCharacter => {
  const clips: AnimationSet = {};
  const style = def.style ?? atlas.manifest.runtimeArchetype;
  const anchor = { ...atlas.manifest.anchor };
  const bakedMotion = atlas.manifest.motion === 'baked';
  for (const [clipId, loaded] of Object.entries(atlas.clips)) {
    if (!loaded) continue;
    (clips as Record<string, AnimationClip>)[clipId] = makeClipFromLoaded(clipId, loaded, style, anchor, bakedMotion);
  }

  const clipMap = clips as Record<string, AnimationClip | undefined>;
  clips.aliases = {
    move: clipMap.walk ?? clipMap.idle!,
    idle: clipMap.idle!,
  };

  return {
    id: def.id,
    seed: def.seed ?? 1,
    width: atlas.manifest.frameWidth,
    height: atlas.manifest.frameHeight,
    anchor,
    palette: { ...proceduralPalette, ...(def.palette ?? {}) },
    style,
    clips,
  };
};
