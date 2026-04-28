import type { AnimationFacing, PixelSprite, ProceduralCharacter } from '../../types.js';
import { applyCastSpark, applyDieDissolve, applyHitOverlay } from '../effects.js';
import { clearSprite, fillCircle, fillRect, plot } from '../primitives.js';

const isLeftFacing = (facing: AnimationFacing): boolean => facing === 'dl' || facing === 'ul';

const clipPhase = (localTMs: number, lengthMs: number): number => {
  if (lengthMs <= 0) return 0;
  return Math.max(0, Math.min(1, localTMs / lengthMs));
};

const bodyColorByStyle = (character: ProceduralCharacter): number => {
  switch (character.style) {
    case 'stalker':
      return character.palette.enemyStalkerPrimary;
    case 'bruiser':
      return character.palette.enemyBruiserPrimary;
    case 'spitter':
      return character.palette.enemySpitterPrimary;
    case 'guardian':
      return character.palette.enemyGuardianPrimary;
    case 'spore_bomber':
      return character.palette.enemyBomberPrimary;
    default:
      return character.palette.enemyStalkerPrimary;
  }
};

export const drawEnemyFrame = (
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
  const left = isLeftFacing(facing);
  const dir = left ? -1 : 1;
  const body = bodyColorByStyle(character);
  const style = character.style;

  const isWalking = clipId === 'walk';
  const isIdle = clipId === 'idle';
  const isAttack = clipId === 'attack';

  // Per-style idle breath/twitch (snapped to whole pixels).
  let idleSquash = 0;
  let idleTwitchX = 0;
  if (isIdle) {
    if (style === 'stalker') {
      // Twitchy, fast jitter.
      idleTwitchX = Math.round(Math.sin(tMs * 0.012) * 1);
      idleSquash = Math.sin(tMs * 0.018) < -0.5 ? 1 : 0;
    } else if (style === 'bruiser' || style === 'guardian') {
      // Heavy, slow breath — deeper compress.
      idleSquash = Math.sin(tMs * 0.003) < -0.4 ? 1 : 0;
    } else if (style === 'spore_bomber') {
      // Inflate/deflate cycle always visible.
      idleSquash = Math.sin(tMs * 0.005) > 0.6 ? -1 : 0;
    } else {
      // Spitter / default — light breath.
      idleSquash = Math.sin(tMs * 0.004) < -0.6 ? 1 : 0;
    }
  }

  // Walk stride (per-style amplitude).
  const strideAmp =
    style === 'stalker' ? 2.3 :
    style === 'bruiser' ? 1.2 :
    style === 'guardian' ? 1.0 :
    style === 'spore_bomber' ? 1.5 :
    1.7;
  const stride = isWalking ? Math.sin(localTMs * 0.03) * strideAmp : 0;

  // Walk bob: snap to whole pixels.
  const walkBob = isWalking ? Math.round(Math.sin(localTMs * 0.03 + 0.8)) : 0;

  // Attack phases (match warrior).
  const atkPhase = isAttack ? clipPhase(localTMs, 280) : 0;
  const antic = isAttack && atkPhase < 0.35 ? atkPhase / 0.35 : 0;
  const strike = isAttack && atkPhase >= 0.35 && atkPhase < 0.55
    ? (atkPhase - 0.35) / 0.2
    : 0;
  const smear = isAttack && atkPhase >= 0.55 && atkPhase < 0.75 ? 1 : 0;
  const recovery = isAttack && atkPhase >= 0.75 ? (atkPhase - 0.75) / 0.25 : 0;

  // Per-style attack body displacement.
  // Bruiser: heavier windback (-3 antic) then lunge (+3 strike).
  // Stalker: small windback, fast strike (+4 reach).
  // Spore bomber: no lunge; inflates during antic, holds before release.
  // Spitter: leans back (cast-like), weak forward reach.
  // Guardian: near-stationary fortress, emits flash.
  let bodyShiftX = 0;
  let bodyInflate = 0;
  if (isAttack) {
    if (style === 'bruiser') {
      const base = dir * (antic * -3 + strike * 3 + smear * 3);
      const rec = dir * (3 * (1 - recovery));
      bodyShiftX = Math.round(recovery > 0 ? rec : base);
    } else if (style === 'stalker') {
      const base = dir * (antic * -1 + strike * 4 + smear * 4);
      const rec = dir * (4 * (1 - recovery));
      bodyShiftX = Math.round(recovery > 0 ? rec : base);
    } else if (style === 'spore_bomber') {
      // Inflation during antic + strike, release on smear, collapse on recovery.
      bodyInflate = Math.round(antic * 2 + strike * 3 + smear * 0 + recovery * 0);
      bodyShiftX = 0;
    } else if (style === 'spitter') {
      // Lean back (opposite of facing) during antic, small forward on strike.
      const base = dir * (antic * -2 + strike * 1 + smear * 1);
      const rec = dir * (1 * (1 - recovery));
      bodyShiftX = Math.round(recovery > 0 ? rec : base);
    } else if (style === 'guardian') {
      // Fortress: tiny rock, no real shift.
      bodyShiftX = Math.round(Math.sin(localTMs * 0.08) * 1);
      bodyInflate = antic > 0 || strike > 0 ? 1 : 0;
    }
  }

  const yBase = Math.floor(out.height - 4) + walkBob + idleSquash;

  const baseTorsoW =
    style === 'bruiser' || style === 'guardian' ? 10 : 8;
  const torsoW = baseTorsoW + bodyInflate * 2;
  const torsoX = cx - Math.floor(torsoW / 2) + bodyShiftX + idleTwitchX;
  const torsoTop = yBase - 12 + (idleSquash > 0 ? 1 : 0) - bodyInflate;
  const torsoH = 7 - (idleSquash > 0 ? 1 : 0) + bodyInflate * 2;

  fillRect(out, torsoX, torsoTop, torsoW, torsoH, body);
  fillRect(out, torsoX + 1, torsoTop + 1, torsoW - 2, Math.max(1, torsoH - 2), p.shadow);

  // Head
  if (style === 'spore_bomber') {
    // Head inflates with body.
    const headR = 4 + bodyInflate;
    fillCircle(out, cx + bodyShiftX + idleTwitchX, yBase - 14 - bodyInflate, headR, body);
    fillCircle(out, cx + bodyShiftX + idleTwitchX, yBase - 14 - bodyInflate, Math.max(1, headR - 2), p.highlight);
  } else {
    const headShiftX = bodyShiftX + idleTwitchX;
    fillRect(out, cx - 3 + headShiftX, yBase - 16 - bodyInflate, 6 + (style === 'guardian' ? bodyInflate : 0), 4, p.highlight);
    fillRect(out, cx - 2 + headShiftX, yBase - 15 - bodyInflate, 4, 2, p.shadow);
  }

  // Legs
  fillRect(out, cx - 2 + Math.round(stride) + bodyShiftX, yBase - 5, 2, 5, body);
  fillRect(out, cx + Math.round(-stride) + bodyShiftX, yBase - 5, 2, 5, body);

  // Facing highlight on torso edge
  if (left) {
    fillRect(out, torsoX, torsoTop, 2, 4, p.highlight);
  } else {
    fillRect(out, torsoX + torsoW - 2, torsoTop, 2, 4, p.highlight);
  }

  // Attack flavor effects
  if (isAttack) {
    const cyMid = Math.floor(out.height / 2) + 1;
    if (style === 'stalker' && atkPhase >= 0.35 && atkPhase <= 0.75) {
      // Fast slash + smear trail.
      const reach = 5 + (smear > 0 ? 2 : 0);
      fillRect(out, cx + dir * 1 + bodyShiftX, cyMid - 3, dir > 0 ? reach : -reach, 1, p.highlight);
      if (smear > 0) {
        fillRect(out, cx + dir * 2 + bodyShiftX, cyMid - 2, dir > 0 ? reach - 1 : -(reach - 1), 1, p.highlight);
      }
    } else if (style === 'bruiser' && atkPhase >= 0.35 && atkPhase <= 0.75) {
      // Heavy overhead chop — thick slash.
      const reach = 6 + (smear > 0 ? 1 : 0);
      fillRect(out, cx + dir * 1 + bodyShiftX, cyMid - 5, dir > 0 ? reach : -reach, 2, p.highlight);
    } else if (style === 'spitter' && atkPhase >= 0.4) {
      // Projectile tell: a spark escapes from the mouth/chest in the firing direction.
      const sparkX = cx + dir * (2 + Math.round(strike * 3 + smear * 5 + recovery * 6));
      const sparkY = cyMid - 2;
      fillRect(out, sparkX, sparkY, 2, 2, p.castGlow ?? p.highlight);
      if (smear > 0 || recovery > 0) {
        plot(out, sparkX - dir, sparkY, p.castGlow ?? p.highlight);
        plot(out, sparkX - dir * 2, sparkY + 1, p.castGlow ?? p.highlight);
      }
    } else if (style === 'spore_bomber' && atkPhase >= 0.75) {
      // Release flash — expanding ring on smear/recovery.
      const r = 2 + Math.round((atkPhase - 0.75) * 20);
      fillCircle(out, cx, yBase - 10, r, p.castGlow ?? p.highlight);
    } else if (style === 'guardian' && atkPhase >= 0.35) {
      // Tri-shard flash: three sparks fanning forward.
      const reach = 3 + Math.round((strike + smear + recovery) * 4);
      const baseX = cx + dir * reach;
      const baseY = cyMid - 2;
      fillRect(out, baseX, baseY, 2, 2, p.castGlow ?? p.highlight);
      plot(out, baseX + dir, baseY - 2, p.castGlow ?? p.highlight);
      plot(out, baseX + dir, baseY + 2, p.castGlow ?? p.highlight);
    }
  }

  // Cast clip — reuse spark effect.
  if (clipId === 'cast') {
    applyCastSpark(out, tMs, p.castGlow ?? p.highlight);
  }

  // Ambient aura for spitter/guardian — subtle pulse even outside cast.
  if (!isAttack && (style === 'spitter' || style === 'guardian')) {
    if ((Math.floor(tMs / 180) & 1) === 0) {
      applyCastSpark(out, tMs, p.castGlow ?? p.highlight);
    }
  }

  if (clipId === 'hit') {
    applyHitOverlay(out, 0.8);
  }

  if (clipId === 'die') {
    applyDieDissolve(out, clipPhase(localTMs, 560));
  }

  const eyeY = yBase - 15 - bodyInflate;
  plot(out, cx + (left ? -1 : 1) + bodyShiftX + idleTwitchX, eyeY, p.highlight);

  return out;
};
