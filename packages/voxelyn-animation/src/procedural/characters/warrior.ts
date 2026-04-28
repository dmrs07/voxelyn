import type { AnimationFacing, PixelSprite, ProceduralCharacter } from '../../types.js';
import { applyCastSpark, applyDieDissolve, applyHitOverlay } from '../effects.js';
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
  const isAttack = clipId === 'attack';
  const left = isLeftFacing(facing);
  const dir = left ? -1 : 1;

  // Attack phases: 0.00-0.35 anticipation (wind back), 0.35-0.55 strike (stretch forward),
  // 0.55-0.75 smear (blurred forward pose), 0.75-1.00 recovery (snap back).
  const atkPhase = isAttack ? clipPhase(localTMs, 280) : 0;
  const antic = isAttack && atkPhase < 0.35 ? atkPhase / 0.35 : 0;
  const strike = isAttack && atkPhase >= 0.35 && atkPhase < 0.55
    ? (atkPhase - 0.35) / 0.2
    : 0;
  const smear = isAttack && atkPhase >= 0.55 && atkPhase < 0.75 ? 1 : 0;
  const recovery = isAttack && atkPhase >= 0.75 ? (atkPhase - 0.75) / 0.25 : 0;

  // Idle squash/stretch breath: compress torso 1px on downbeat.
  const breathRaw = Math.sin(tMs * 0.004);
  const breathCompress = isIdle && breathRaw < -0.5 ? 1 : 0;
  const stride = isWalking ? Math.sin(localTMs * 0.028) : 0;

  // Walk bob snaps to whole pixels (was sub-pixel).
  const walkBob = isWalking ? Math.round(Math.sin(localTMs * 0.024)) : 0;

  // Attack body shift: pull back during anticipation, lunge during strike, hold on smear, ease back.
  const attackShift = isAttack
    ? dir * Math.round(antic * -2 + strike * 3 + smear * 3 + (1 - recovery) * 3 * (recovery > 0 ? 1 : 0))
    : 0;
  // On recovery, blend 3 -> 0.
  const attackShiftRecover = isAttack && recovery > 0 ? dir * Math.round(3 * (1 - recovery)) : 0;
  const bodyShiftX = isAttack ? (recovery > 0 ? attackShiftRecover : attackShift) : 0;

  const yBase = Math.floor(out.height - 4) + walkBob + breathCompress;
  const torsoTop = yBase - 12 + (breathCompress > 0 ? 1 : 0);
  const torsoH = 7 - breathCompress;

  // Legs
  const legA = isWalking ? Math.round(stride * 2) : 0;
  const legB = -legA;
  fillRect(out, cx - 2 + legA + bodyShiftX, yBase - 5, 2, 5, p.playerAccent);
  fillRect(out, cx + legB + bodyShiftX, yBase - 5, 2, 5, p.playerAccent);

  // Torso — squash on breath downbeat
  fillRect(out, cx - 4 + bodyShiftX, torsoTop, 8, torsoH, p.playerPrimary);
  fillRect(out, cx - 3 + bodyShiftX, torsoTop + 1, 6, Math.max(1, torsoH - 2), p.playerSecondary);

  // Head + visor — follows body shift
  fillRect(out, cx - 3 + bodyShiftX, yBase - 16 + breathCompress, 6, 4, p.highlight);
  fillRect(out, cx - 2 + bodyShiftX, yBase - 15 + breathCompress, 4, 2, p.shadow);

  // Shoulder lamp — facing-dependent
  if (left) {
    fillRect(out, cx - 4 + bodyShiftX, torsoTop, 2, 3, p.highlight);
  } else {
    fillRect(out, cx + 2 + bodyShiftX, torsoTop, 2, 3, p.highlight);
  }

  // Weapon/hand arm — anticipation pulls back, strike+smear thrusts forward.
  const handX = left
    ? cx - 5 + bodyShiftX - Math.round(antic * -2 + (strike + smear) * 3)
    : cx + 4 + bodyShiftX + Math.round(antic * -2 + (strike + smear) * 3);
  const handY = yBase - 10 + (breathCompress > 0 ? 1 : 0);
  fillRect(out, handX, handY, 2, 4, p.playerPrimary);

  // Attack smear trail — ghosted row between hand and torso during smear phase.
  if (smear > 0) {
    const trailStart = left ? handX + 2 : handX - 3;
    fillRect(out, trailStart, handY + 1, 3, 2, p.highlight);
  }

  if (isAttack) {
    // Slash appears during strike + smear phases.
    if (atkPhase >= 0.35 && atkPhase <= 0.75) {
      const cyMid = Math.floor(out.height / 2) + 1;
      const reach = 6 + (smear > 0 ? 1 : 0);
      fillRect(out, cx + dir * 1 + bodyShiftX, cyMid - 4, dir > 0 ? reach : -reach, 1, p.highlight);
      if (smear > 0) {
        fillRect(out, cx + dir * 2 + bodyShiftX, cyMid - 3, dir > 0 ? reach - 1 : -(reach - 1), 1, p.highlight);
      }
    }
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

  // Eye blink pattern (deterministic, tMs-based — no randomness)
  const blinkCycle = Math.floor(tMs / 2800) % 5;
  const blinkPhase = (tMs % 2800) / 2800;
  const isBlinking = blinkCycle === 0 && blinkPhase > 0.92 && blinkPhase < 0.97;
  if (!isBlinking) {
    const eyeX = left ? cx - 1 + bodyShiftX : cx + bodyShiftX;
    plot(out, eyeX, yBase - 15 + breathCompress, p.playerAccent);
  }

  return out;
};
