import { describe, expect, it } from 'vitest';
import { recoilAtElapsed } from './presentation';

describe('recoilAtElapsed', () => {
  it('comeca no release e retorna suavemente a zero', () => {
    expect(recoilAtElapsed(49, 50)).toBe(0);
    expect(recoilAtElapsed(50, 50)).toBe(1);
    expect(recoilAtElapsed(110, 50, 120)).toBeCloseTo(0.25, 5);
    expect(recoilAtElapsed(170, 50, 120)).toBe(0);
  });

  it('nao vaza recoil entre ataques', () => {
    expect(recoilAtElapsed(500, 50)).toBe(0);
  });
});
