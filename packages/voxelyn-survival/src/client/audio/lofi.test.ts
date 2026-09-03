// A amarrotada dos chefes, na parte que da para medir sem ouvido.
import { describe, expect, it } from 'vitest';
import { BOSS_LOFI_BITS, BOSS_LOFI_DRIVE, crushCurve } from './lofi';
import { VOICE_SPECS, isBossVoice } from './voices';

describe('a curva de quantizacao', () => {
  it('tem 2^bits - 1 degraus (mid-tread), e chega aos dois extremos', () => {
    const curve = crushCurve(BOSS_LOFI_BITS, BOSS_LOFI_DRIVE);
    const levels = new Set<number>();
    for (const v of curve) levels.add(Math.round(v * 1e6) / 1e6);
    expect(levels.size).toBe(Math.pow(2, BOSS_LOFI_BITS) - 1);
    expect(curve[0]).toBeCloseTo(-1, 5);
    expect(curve[curve.length - 1]).toBeCloseTo(1, 5);
  });

  it('e monotona e simetrica, com o zero no zero', () => {
    const curve = crushCurve(6, 1.6, 513);
    for (let i = 1; i < curve.length; i++) expect(curve[i]).toBeGreaterThanOrEqual(curve[i - 1]);
    const mid = (curve.length - 1) / 2;
    expect(curve[mid]).toBeCloseTo(0, 5);
    for (let k = 1; k < mid; k++) expect(curve[mid + k]).toBeCloseTo(-curve[mid - k], 5);
  });

  it('menos bits, mais degrau: a amarrotada e um parametro, nao um sample', () => {
    const coarse = new Set(crushCurve(4, 1.6, 513));
    const fine = new Set(crushCurve(10, 1.6, 4097));
    expect(coarse.size).toBeLessThan(fine.size);
  });
});

describe('quem passa pela amarrotada', () => {
  it('toda voz de chefe, e nenhum telegrafo generico nem voz de interface', () => {
    const boss = Object.keys(VOICE_SPECS).filter((id) =>
      isBossVoice(id as keyof typeof VOICE_SPECS),
    );
    expect(boss.length).toBeGreaterThanOrEqual(60);
    expect(isBossVoice('guardianAwake')).toBe(true);
    expect(isBossVoice('deathGuardian')).toBe(true);
    expect(isBossVoice('bishopHeal')).toBe(true);
    for (const clean of [
      'telegraphSlam',
      'hitPlayer',
      'shot',
      'uiTap',
      'died',
      'explosion',
    ] as const) {
      expect(isBossVoice(clean), clean).toBe(false);
    }
  });
});
