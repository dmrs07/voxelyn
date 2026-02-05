import type { AnimationFacing, PixelSprite, ProceduralCharacter } from '../../types.js';
import { applyAttackSlash, applyCastSpark, applyDieDissolve, applyHitOverlay } from '../effects.js';
import { clearSprite, fillRect, plot } from '../primitives.js';

const isLeftFacing = (facing: AnimationFacing): boolean => facing === 'dl' || facing === 'ul';

const clipPhase = (localTMs: number, lengthMs: number): number => {
  if (lengthMs <= 0) return 0;
  return Math.max(0, Math.min(1, localTMs / lengthMs));
};

export const drawWarriorFrame = (
  character: ProceduralCharacter,
  clipId: string,
  tMs: number,
  localTMs: number,
  facing: AnimationFacing,
  out: PixelSprite
): PixelSprite => {
  const p = character.palette;
  clearSprite(out, p.transparent ?? 0);

  const cx = Math.floor(out.width / 2);
  const isWalking = clipId === 'walk';
  const isIdle = clipId === 'idle';
  
  // Walk stride motion
  const stride = isWalking ? Math.sin(localTMs * 0.028) : 0;
  
  // Idle breathing and subtle sway
  const breathe = Math.sin(tMs * 0.004) * 0.6;
  const idleSway = isIdle ? Math.sin(tMs * 0.0025) * 0.4 : 0;
  
  // Bob: pronounced for walk, subtle for idle
  const bob = isWalking
    ? Math.sin(localTMs * 0.024)
    : breathe * 0.5;
  
  const yBase = Math.floor(out.height - 4 + bob);
  const left = isLeftFacing(facing);

  // Legs - idle has subtle weight shift
  const legA = isWalking ? Math.round(stride * 2) : Math.round(idleSway * 0.5);
  const legB = -legA;
  fillRect(out, cx - 2 + legA, yBase - 5, 2, 5, p.playerAccent);
  fillRect(out, cx + legB, yBase - 5, 2, 5, p.playerAccent);

  // Torso - breathing makes it slightly wider on inhale
  const torsoExpand = isIdle ? Math.max(0, Math.round(breathe * 0.4)) : 0;
  fillRect(out, cx - 4 - torsoExpand, yBase - 12, 8 + torsoExpand * 2, 7, p.playerPrimary);
  fillRect(out, cx - 3, yBase - 11, 6, 5, p.playerSecondary);

  // Head + visor - slight tilt with sway
  const headShift = isIdle ? Math.round(idleSway * 0.3) : 0;
  fillRect(out, cx - 3 + headShift, yBase - 16, 6, 4, p.highlight);
  fillRect(out, cx - 2 + headShift, yBase - 15, 4, 2, p.shadow);

  // Shoulder light depending on facing
  if (left) {
    fillRect(out, cx - 4 - torsoExpand, yBase - 12, 2, 3, p.highlight);
  } else {
    fillRect(out, cx + 2 + torsoExpand, yBase - 12, 2, 3, p.highlight);
  }

  // Arm / weapon hand - idle has subtle motion
  const armBob = isIdle ? Math.round(Math.sin(tMs * 0.0035) * 0.6) : 0;
  const handX = left ? cx - 5 - torsoExpand : cx + 4 + torsoExpand;
  fillRect(out, handX, yBase - 10 + armBob, 2, 4, p.playerPrimary);

  if (clipId === 'attack') {
    applyAttackSlash(out, facing, clipPhase(localTMs, 260), p.highlight);
  }

  if (clipId === 'cast') {
    applyCastSpark(out, tMs, p.castGlow ?? p.highlight);
  }

  if (clipId === 'hit') {
    applyHitOverlay(out, 0.9);
  }

  if (clipId === 'die') {
    applyDieDissolve(out, clipPhase(localTMs, 520));
  }

  // Eye blink pattern - occasional blink with variable timing
  const blinkCycle = Math.floor(tMs / 2800) % 5;
  const blinkPhase = (tMs % 2800) / 2800;
  const isBlinking = blinkCycle === 0 && blinkPhase > 0.92 && blinkPhase < 0.97;
  if (!isBlinking) {
    const eyeX = left ? cx - 1 + headShift : cx + headShift;
    plot(out, eyeX, yBase - 15, p.playerAccent);
  }

  return out;
};
