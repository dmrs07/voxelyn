import type { AnimationFacing, PixelSprite, ProceduralCharacter } from '../../types.js';
import { applyAttackSlash, applyCastSpark, applyDieDissolve, applyHitOverlay } from '../effects.js';
import { clearSprite, fillCircle, fillRect, plot } from '../primitives.js';

const isLeftFacing = (facing: AnimationFacing): boolean => facing === 'dl' || facing === 'ul';

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
  const stride = clipId === 'walk' ? Math.sin(localTMs * 0.03) * 1.7 : 0;
  const bob = Math.sin(tMs * 0.009) * 0.4;
  const yBase = Math.floor(out.height - 4 + bob);
  const body = bodyColorByStyle(character);

  const torsoW = character.style === 'bruiser' || character.style === 'guardian' ? 10 : 8;
  const torsoX = cx - Math.floor(torsoW / 2);
  fillRect(out, torsoX, yBase - 12, torsoW, 7, body);
  fillRect(out, torsoX + 1, yBase - 11, torsoW - 2, 5, p.shadow);

  if (character.style === 'spore_bomber') {
    fillCircle(out, cx, yBase - 14, 4, body);
    fillCircle(out, cx, yBase - 14, 2, p.highlight);
  } else {
    fillRect(out, cx - 3, yBase - 16, 6, 4, p.highlight);
    fillRect(out, cx - 2, yBase - 15, 4, 2, p.shadow);
  }

  // Legs
  fillRect(out, cx - 2 + Math.round(stride), yBase - 5, 2, 5, body);
  fillRect(out, cx + Math.round(-stride), yBase - 5, 2, 5, body);

  // Facing highlight
  if (left) {
    fillRect(out, torsoX, yBase - 12, 2, 4, p.highlight);
  } else {
    fillRect(out, torsoX + torsoW - 2, yBase - 12, 2, 4, p.highlight);
  }

  if (clipId === 'attack') {
    applyAttackSlash(out, facing, Math.max(0, Math.min(1, localTMs / 280)), p.highlight);
  }
  if (clipId === 'cast' || character.style === 'spitter' || character.style === 'guardian') {
    const castPulse = clipId === 'cast' || (Math.floor(tMs / 180) & 1) === 0;
    if (castPulse) applyCastSpark(out, tMs, p.castGlow ?? p.highlight);
  }
  if (clipId === 'hit') {
    applyHitOverlay(out, 0.8);
  }
  if (clipId === 'die') {
    applyDieDissolve(out, Math.max(0, Math.min(1, localTMs / 560)));
  }

  const eyeY = yBase - 15;
  plot(out, cx + (left ? -1 : 1), eyeY, p.highlight);

  return out;
};
