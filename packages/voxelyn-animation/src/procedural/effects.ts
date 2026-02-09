import type { AnimationFacing, PixelSprite } from '../types.js';
import { drawLine, fillCircle, plot } from './primitives.js';

const facingSign = (facing: AnimationFacing): number => (facing === 'dl' || facing === 'ul' ? -1 : 1);

export const applyAttackSlash = (
  out: PixelSprite,
  facing: AnimationFacing,
  phase: number,
  color: number
): void => {
  if (phase < 0.25 || phase > 0.8) return;
  const cx = Math.floor(out.width / 2);
  const cy = Math.floor(out.height / 2) + 1;
  const dir = facingSign(facing);
  drawLine(out, cx + dir * 1, cy - 4, cx + dir * 6, cy - 8, color);
  if (phase > 0.55) {
    drawLine(out, cx + dir * 2, cy - 3, cx + dir * 7, cy - 7, color);
  }
};

export const applyCastSpark = (
  out: PixelSprite,
  tMs: number,
  color: number
): void => {
  const cx = Math.floor(out.width / 2);
  const cy = Math.floor(out.height / 2) - 2;
  const wave = Math.sin(tMs * 0.02) * 0.5 + 0.5;
  fillCircle(out, cx, cy, 1 + Math.round(wave), color);
  plot(out, cx - 3, cy + 1, color);
  plot(out, cx + 3, cy + 1, color);
};

export const applyHitOverlay = (out: PixelSprite, amount: number): void => {
  if (amount <= 0) return;
  const count = Math.min(10, Math.max(3, Math.floor(amount * 10)));
  for (let i = 0; i < count; i += 1) {
    const x = (i * 17 + out.width * 13) % out.width;
    const y = (i * 29 + out.height * 7) % out.height;
    const idx = y * out.width + x;
    out.pixels[idx] = 0xffb4b4ff;
  }
};

export const applyDieDissolve = (out: PixelSprite, phase: number): void => {
  const cut = Math.floor(out.height * phase);
  for (let y = 0; y < cut; y += 1) {
    for (let x = 0; x < out.width; x += 1) {
      if (((x + y) & 1) === 0) {
        out.pixels[y * out.width + x] = 0;
      }
    }
  }
};
