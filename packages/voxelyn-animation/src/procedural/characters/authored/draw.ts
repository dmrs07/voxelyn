import type { AnimationFacing, PixelSprite } from '../../../types.js';
import { clearSprite } from '../../primitives.js';
import type { AuthoredFrame, AuthoredGrid, AuthoredSpriteDef } from './types.js';

const facingKey = (f: AnimationFacing): 'DR' | 'DL' | 'UR' | 'UL' => {
  switch (f) {
    case 'dr': return 'DR';
    case 'dl': return 'DL';
    case 'ur': return 'UR';
    case 'ul': return 'UL';
  }
};

const resolvePoseGrid = (
  def: AuthoredSpriteDef,
  facing: AnimationFacing,
  pose: string
): AuthoredGrid | null => {
  const fk = facingKey(facing);
  const direct = def.poses[`${fk}:${pose}`];
  if (direct) return direct;
  const drFallback = def.poses[`DR:${pose}`];
  if (drFallback) return drFallback;
  const generic = def.poses[pose];
  if (generic) return generic;
  return null;
};

const stateTotalMs = (frames: AuthoredFrame[]): number => {
  let total = 0;
  for (const f of frames) total += f.dur;
  return total;
};

export const resolveAuthoredFrame = (
  def: AuthoredSpriteDef,
  clipId: string,
  localTMs: number
): AuthoredFrame => {
  const state = def.states[clipId as keyof typeof def.states];
  if (!state || state.frames.length === 0) {
    return { pose: 'idle_a', dur: 1 };
  }
  const total = stateTotalMs(state.frames);
  let t = localTMs;
  if (state.loop) {
    t = total > 0 ? t % total : 0;
  } else if (t >= total) {
    return state.frames[state.frames.length - 1]!;
  }

  let acc = 0;
  for (const fr of state.frames) {
    acc += fr.dur;
    if (t < acc) return fr;
  }
  return state.frames[state.frames.length - 1]!;
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
  // Preserve alpha of source, use RGB of tint.
  const srcA = (packed >>> 24) & 0xff;
  if (srcA === 0) return 0;
  return ((tint & 0x00ffffff) | (srcA << 24)) >>> 0;
};

/**
 * Draw a single authored frame to `out`.
 * Grid is sampled with nearest-neighbor rescaling by sx/sy around the sprite's bottom-center anchor.
 * tx/ty shift in output pixels.
 */
export const drawAuthoredFrame = (
  def: AuthoredSpriteDef,
  clipId: string,
  _tMs: number,
  localTMs: number,
  facing: AnimationFacing,
  out: PixelSprite
): PixelSprite => {
  clearSprite(out, 0);

  const frame = resolveAuthoredFrame(def, clipId, localTMs);
  const grid = resolvePoseGrid(def, facing, frame.pose);
  if (!grid) return out;

  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (rows === 0 || cols === 0) return out;

  const sx = frame.sx ?? 1;
  const sy = frame.sy ?? 1;
  const tx = frame.tx ?? 0;
  const ty = frame.ty ?? 0;
  const alpha = frame.alpha ?? 1;
  const tint = frame.tint;

  // Source grid dims (same as def dims by contract).
  const srcW = cols;
  const srcH = rows;

  // Scaled size in output pixels.
  const dstW = Math.max(1, Math.round(srcW * sx));
  const dstH = Math.max(1, Math.round(srcH * sy));

  // Bottom-center anchor: the unscaled sprite sits centered on x with feet at y=height-1.
  // Keep that anchor under scaling + tx/ty.
  const anchorX = Math.floor(out.width / 2);
  const anchorY = out.height - 1;

  const dstX0 = anchorX - Math.floor(dstW / 2) + Math.round(tx);
  const dstY0 = anchorY - dstH + 1 + Math.round(ty);

  for (let dy = 0; dy < dstH; dy += 1) {
    const py = dstY0 + dy;
    if (py < 0 || py >= out.height) continue;
    const srcY = Math.min(srcH - 1, Math.floor((dy * srcH) / dstH));
    const row = grid[srcY];
    if (!row) continue;
    const rowBase = py * out.width;
    for (let dxp = 0; dxp < dstW; dxp += 1) {
      const px = dstX0 + dxp;
      if (px < 0 || px >= out.width) continue;
      const srcX = Math.min(srcW - 1, Math.floor((dxp * srcW) / dstW));
      const idx = row[srcX] ?? 0;
      if (idx === 0) continue;
      let c = def.palette[idx];
      if (!c) continue;
      if (tint !== undefined) c = applyTint(c, tint);
      if (alpha < 1) c = mulAlpha(c, alpha);
      if (c === 0) continue;
      out.pixels[rowBase + px] = c >>> 0;
    }
  }

  return out;
};

export const authoredStateLengthMs = (def: AuthoredSpriteDef, clipId: string): number => {
  const state = def.states[clipId as keyof typeof def.states];
  if (!state) return 1;
  return Math.max(1, stateTotalMs(state.frames));
};

export const authoredStateIsLoop = (def: AuthoredSpriteDef, clipId: string): boolean => {
  const state = def.states[clipId as keyof typeof def.states];
  if (!state) return true;
  return state.loop;
};
